#!/usr/bin/env tsx
/**
 * Upload a pg_dump of your local DB to Azure Blob Storage.
 * Usage: yarn db:push [snapshot-name]
 *
 * Requires: pg_dump in PATH, AZURE_STORAGE_CONNECTION_STRING in .env
 */

import { execSync, spawnSync } from "child_process";
import { BlobServiceClient } from "@azure/storage-blob";
import { readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import "../server/env.js";

const CONTAINER = "db-snapshots";
const DATABASE_URL = process.env.DATABASE_URL;
const CONN_STR = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL not set");
  process.exit(1);
}
if (!CONN_STR) {
  console.error(
    "❌  AZURE_STORAGE_CONNECTION_STRING not set.\n" +
    "    Run: az storage account show-connection-string --name saapivio --resource-group rg-vio-shared -o tsv"
  );
  process.exit(1);
}

const author =
  process.env.DB_SNAPSHOT_AUTHOR ||
  execSync("git config user.name", { encoding: "utf8" }).trim().replace(/\s+/g, "-").toLowerCase() ||
  "dev";

const date = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
const snapshotName = process.argv[2] || `${author}-${date}.sql`;
const tmpFile = join(tmpdir(), snapshotName);

console.log(`📦  Dumping local database...`);
const dump = spawnSync("pg_dump", ["--no-owner", "--no-acl", DATABASE_URL], {
  encoding: "buffer",
  maxBuffer: 512 * 1024 * 1024,
});

if (dump.status !== 0) {
  console.error("❌  pg_dump failed:", dump.stderr?.toString());
  process.exit(1);
}

console.log(`☁️   Uploading ${snapshotName} to Azure Blob...`);
const blobService = BlobServiceClient.fromConnectionString(CONN_STR);
const containerClient = blobService.getContainerClient(CONTAINER);
await containerClient.createIfNotExists();

const blockBlob = containerClient.getBlockBlobClient(snapshotName);
await blockBlob.uploadData(dump.stdout, {
  blobHTTPHeaders: { blobContentType: "application/sql" },
  metadata: { author, createdAt: new Date().toISOString() },
});

console.log(`✅  Uploaded: ${snapshotName}`);
console.log(`    Share with: yarn db:pull ${snapshotName}`);
