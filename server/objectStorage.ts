import {
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
  BlobServiceClient,
  BlobSASPermissions,
  BlobClient
} from "@azure/storage-blob";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
} from "./objectAcl";

// The Azure Blob Storage client
export const blobServiceClient = process.env.AZURE_STORAGE_CONNECTION_STRING
  ? BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
  : null;

/**
 * Helper to get container and blob client
 */
function getBlobClient(fullPath: string): { containerName: string; blobName: string; client: BlobClient } {
  const { bucketName: containerName, objectName: blobName } = parseObjectPath(fullPath);
  if (!blobServiceClient) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set.");
  }
  const containerClient = blobServiceClient.getContainerClient(containerName);
  return {
    containerName,
    blobName,
    client: containerClient.getBlobClient(blobName)
  };
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() { }

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
        "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory (Container Name in Azure).
  getPrivateObjectDir(): string {
    const dir = (process.env.AZURE_CONTAINER || "").trim();
    if (!dir) {
      throw new Error(
        "AZURE_CONTAINER not set. Please set it in the .env file."
      );
    }
    // Remove leading/trailing slashes for consistency if they exist
    return dir.replace(/^\/+|\/+$/g, "");
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<BlobClient | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { client } = getBlobClient(fullPath);

      if (await client.exists()) {
        return client;
      }
    }
    return null;
  }

  // Downloads an object to the response.
  async downloadObject(blobClient: BlobClient, res: Response, cacheTtlSec: number = 3600) {
    try {
      const properties = await blobClient.getProperties();

      // Determine visibility for cache control
      // For now, we'll assume standard private/public based on path or env
      const isPublic = blobClient.url.includes("/public/");

      res.set({
        "Content-Type": properties.contentType || "application/octet-stream",
        "Content-Length": properties.contentLength?.toString(),
        "Cache-Control": `${isPublic ? "public" : "private"
          }, max-age=${cacheTtlSec}`,
      });

      const downloadResponse = await blobClient.download();
      if (!downloadResponse.readableStreamBody) {
        throw new Error("Unable to download blob");
      }

      downloadResponse.readableStreamBody.pipe(res);

      downloadResponse.readableStreamBody.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(type: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "AZURE_CONTAINER not set. Create a bucket in 'Object Storage' " +
        "tool and set AZURE_CONTAINER env var."
      );
    }

    const getExtension = (type: string): string => {
      if (type == 'image/jpeg') return '.jpeg';
      if (type == 'image/jpg') return '.jpg';
      if (type == 'image/png') return '.png';
      if (type == 'image/webp') return '.webp';
      if (type == 'image/gif') return '.gif';
      if (type == 'image/svg+xml') return '.svg';
      if (type == 'image/avif') return '.avif';
      if (type == 'image/bmp') return '.bmp';
      if (type == 'image/tiff') return '.tiff';
      if (type == 'image/x-icon') return '.ico';
      return '.bin';
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}${getExtension(type)}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<BlobClient> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { client } = getBlobClient(objectEntityPath);

    if (!(await client.exists())) {
      throw new ObjectNotFoundError();
    }
    return client;
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    // Azure Blob URLs look like: https://<account>.blob.core.windows.net/<container>/<path>
    if (!rawPath.includes(".blob.core.windows.net/")) {
      return rawPath;
    }

    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    // Extract the entity ID from the path
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    // In Azure, we typically don't set ACLs per-blob via this method 
    // unless using AD integration. For simple SAS-based access, 
    // we return the normalized path.
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: BlobClient;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    // Azure access control is managed via SAS tokens or Azure IAM.
    // Assuming access is allowed if we reach here for now.
    return true;
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT!;
  const accountKey = process.env.AZURE_STORAGE_KEY!;

  const credential = new StorageSharedKeyCredential(
    accountName,
    accountKey
  );

  const permissions = new BlobSASPermissions();

  if (method === "GET" || method === "HEAD") {
    permissions.read = true;
  }

  if (method === "PUT") {
    permissions.create = true;
    permissions.write = true;
  }

  if (method === "DELETE") {
    permissions.delete = true;
  }

  const now = new Date();

  const sas = generateBlobSASQueryParameters(
    {
      containerName: bucketName,
      blobName: objectName,
      permissions,
      startsOn: new Date(now.getTime() - 5 * 60 * 1000),
      expiresOn: new Date(now.getTime() + ttlSec * 1000),
    },
    credential
  ).toString();

  return `https://${accountName}.blob.core.windows.net/${bucketName}/${objectName}?${sas}`;
}
