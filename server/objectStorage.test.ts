import { ObjectStorageService, blobServiceClient } from './objectStorage';
import { generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';

jest.mock('@azure/storage-blob', () => {
  const original = jest.requireActual('@azure/storage-blob');
  return {
    ...original,
    generateBlobSASQueryParameters: jest.fn().mockReturnValue({ toString: () => 'mock-sas-token' }),
    StorageSharedKeyCredential: jest.fn(),
    BlobServiceClient: {
      fromConnectionString: jest.fn().mockReturnValue({
        getContainerClient: jest.fn().mockReturnValue({
          getBlobClient: jest.fn().mockReturnValue({
            exists: jest.fn().mockResolvedValue(true),
            getProperties: jest.fn().mockResolvedValue({ contentType: 'image/png', contentLength: 1024 }),
            download: jest.fn().mockResolvedValue({ readableStreamBody: { pipe: jest.fn(), on: jest.fn() } }),
            url: 'https://testaccount.blob.core.windows.net/public/uploads/uuid'
          })
        })
      })
    }
  };
});

describe('ObjectStorageService', () => {
  let service: ObjectStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ObjectStorageService();

    // Mock env vars
    process.env.PUBLIC_OBJECT_SEARCH_PATHS = 'public';
    process.env.AZURE_CONTAINER = 'public';
    process.env.AZURE_STORAGE_ACCOUNT = 'testaccount';
    process.env.AZURE_STORAGE_KEY = 'testkey';
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net';
  });

  test('getObjectEntityUploadURL returns a signed URL (SAS)', async () => {
    const url = await service.getObjectEntityUploadURL('image/jpeg');
    expect(url).toContain('https://testaccount.blob.core.windows.net/public/uploads/');
    expect(url).toContain('mock-sas-token');
    expect(generateBlobSASQueryParameters).toHaveBeenCalled();
  });

  test('normalizeObjectEntityPath handles Azure Blob URLs', () => {
    const rawUrl = 'https://testaccount.blob.core.windows.net/public/uploads/uuid';
    const normalized = service.normalizeObjectEntityPath(rawUrl);
    expect(normalized).toBe('/objects/uploads/uuid');
  });

  test('normalizeObjectEntityPath handles non-Azure URLs', () => {
    const rawUrl = 'https://example.com/some/path';
    const normalized = service.normalizeObjectEntityPath(rawUrl);
    expect(normalized).toBe(rawUrl);
  });
});

