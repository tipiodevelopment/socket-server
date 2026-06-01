#!/usr/bin/env tsx
/**
 * Download a snapshot from Azure Blob and restore it to your local DB.
 * Usage:
 *   yarn db:pull                       # restores the latest snapshot
 *   yarn db:pull angelo-2026-06-01.sql # restores a specific snapshot
 *
 * Requires: psql in PATH, AZURE_STORAGE_CONNECTION_STRING in .env
 */

import { spawnSync } from "child_process";
import { BlobServiceClient } from "@azure/storage-blob";
import "../server/env.js";

const CONTAINER = "db-snapshots";
const DATABASE_URL = process.env.DATABASE_URL;
const CONN_STR = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL not set");
  process.exit(1);
}
if (!CONN_STR) {
  console.error("❌  AZURE_STORAGE_CONNECTION_STRING not set");
  process.exit(1);
}

const blobService = BlobServiceClient.fromConnectionString(CONN_STR);
const containerClient = blobService.getContainerClient(CONTAINER);

// Resolve snapshot name
let snapshotName = process.argv[2];
if (!snapshotName) {
  console.log("🔍  Looking for latest snapshot...");
  let latest: { name: string; createdOn: Date } | null = null;
  for await (const blob of containerClient.listBlobsFlat()) {
    if (!latest || blob.properties.createdOn! > latest.createdOn) {
      latest = { name: blob.name, createdOn: blob.properties.createdOn! };
    }
  }
  if (!latest) {
    console.error("❌  No snapshots found. Run `yarn db:push` first.");
    process.exit(1);
  }
  snapshotName = latest.name;
  console.log(`📌  Latest: ${snapshotName}`);
}

console.log(`⬇️   Downloading ${snapshotName}...`);
const blockBlob = containerClient.getBlockBlobClient(snapshotName);
const downloadResponse = await blockBlob.download(0);
const chunks: Buffer[] = [];
for await (const chunk of downloadResponse.readableStreamBody as AsyncIterable<Buffer>) {
  chunks.push(chunk);
}
const sqlBuffer = Buffer.concat(chunks);

console.log(`🔄  Restoring to local database...`);

// Drop and recreate the database for a clean restore
const dbName = new URL(DATABASE_URL).pathname.slice(1);
const baseUrl = DATABASE_URL.replace(`/${dbName}`, "/postgres");

spawnSync("psql", [baseUrl, "-c", `DROP DATABASE IF EXISTS ${dbName};`], { stdio: "inherit" });
spawnSync("psql", [baseUrl, "-c", `CREATE DATABASE ${dbName};`], { stdio: "inherit" });

const restore = spawnSync("psql", [DATABASE_URL], {
  input: sqlBuffer,
  stdio: ["pipe", "inherit", "inherit"],
});

if (restore.status !== 0) {
  console.error("❌  psql restore failed");
  process.exit(1);
}

console.log(`✅  Restored: ${snapshotName}`);
