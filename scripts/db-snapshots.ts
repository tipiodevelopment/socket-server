#!/usr/bin/env tsx
/**
 * List all DB snapshots available in Azure Blob Storage.
 * Usage: yarn db:snapshots
 */

import { BlobServiceClient } from "@azure/storage-blob";
import "../server/env.js";

const CONTAINER = "db-snapshots";
const CONN_STR = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!CONN_STR) {
  console.error("❌  AZURE_STORAGE_CONNECTION_STRING not set");
  process.exit(1);
}

const blobService = BlobServiceClient.fromConnectionString(CONN_STR);
const containerClient = blobService.getContainerClient(CONTAINER);

const snapshots: { name: string; size: number; createdOn: Date; author: string }[] = [];

for await (const blob of containerClient.listBlobsFlat({ includeMetadata: true })) {
  snapshots.push({
    name: blob.name,
    size: blob.properties.contentLength ?? 0,
    createdOn: blob.properties.createdOn!,
    author: blob.metadata?.author ?? "unknown",
  });
}

if (snapshots.length === 0) {
  console.log("No snapshots found. Run `yarn db:push` to create one.");
  process.exit(0);
}

snapshots.sort((a, b) => b.createdOn.getTime() - a.createdOn.getTime());

console.log(`\n${"Snapshot".padEnd(45)} ${"Author".padEnd(15)} ${"Date".padEnd(22)} Size`);
console.log("─".repeat(95));
for (const s of snapshots) {
  const size = s.size > 1024 * 1024
    ? `${(s.size / 1024 / 1024).toFixed(1)} MB`
    : `${(s.size / 1024).toFixed(0)} KB`;
  const date = s.createdOn.toISOString().slice(0, 16).replace("T", " ");
  console.log(`${s.name.padEnd(45)} ${s.author.padEnd(15)} ${date.padEnd(22)} ${size}`);
}
console.log();
console.log(`To restore: yarn db:pull <snapshot-name>`);
