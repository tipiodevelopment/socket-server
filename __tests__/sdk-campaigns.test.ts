/**
 * Integration tests: GET /v1/sdk/campaigns
 * Hits the real server at localhost:5001
 *
 * Coverage:
 * - Auth: missing apiKey → 401, invalid apiKey → 401
 * - Valid apiKey returns 200 with campaigns array
 * - Campaign shape: campaignId (number), campaignName, isActive, components[]
 * - Each component has: id, type, name, config, status, locationId
 * - broadcastId param: returns same campaigns (no error), filtered or full list
 * - No auth via x-api-key header also works
 */

import supertest from 'supertest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5001';
const API_KEY = process.env.TEST_API_KEY || 'viaplay_api_key_0c611e983b314ff8';

const request = supertest(BASE_URL);

describe('GET /v1/sdk/campaigns', () => {
  describe('Auth', () => {
    it('returns 401 when no apiKey is provided', async () => {
      const res = await request.get('/v1/sdk/campaigns');
      expect(res.status).toBe(401);
    });

    it('returns 401 when apiKey is invalid', async () => {
      const res = await request
        .get('/v1/sdk/campaigns')
        .set('x-api-key', 'invalid_key_000');
      expect(res.status).toBe(401);
    });

    it('accepts apiKey via x-api-key header', async () => {
      const res = await request
        .get('/v1/sdk/campaigns')
        .set('x-api-key', API_KEY);
      expect(res.status).toBe(200);
    });

    it('accepts apiKey via query param', async () => {
      const res = await request.get(`/v1/sdk/campaigns?apiKey=${API_KEY}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Response shape (valid apiKey)', () => {
    let res: supertest.Response;

    beforeAll(async () => {
      res = await request
        .get('/v1/sdk/campaigns')
        .set('x-api-key', API_KEY);
    });

    it('returns 200', () => {
      expect(res.status).toBe(200);
    });

    it('returns a campaigns array', () => {
      expect(res.body).toHaveProperty('campaigns');
      expect(Array.isArray(res.body.campaigns)).toBe(true);
    });

    it('each campaign has required fields', () => {
      res.body.campaigns.forEach((c: any) => {
        expect(typeof c.campaignId).toBe('number');
        expect(typeof c.campaignName).toBe('string');
        expect(typeof c.isActive).toBe('boolean');
        expect(typeof c.isPaused).toBe('boolean');
        expect(Array.isArray(c.components)).toBe(true);
      });
    });

    it('each component has id, type, name, config, status, locationId', () => {
      res.body.campaigns.forEach((c: any) => {
        c.components.forEach((comp: any) => {
          expect(typeof comp.id).toBe('string');
          expect(typeof comp.type).toBe('string');
          expect(typeof comp.name).toBe('string');
          expect(comp.config).toBeDefined();
          expect(typeof comp.status).toBe('string');
          expect(typeof comp.locationId).toBe('string');
        });
      });
    });
  });

  describe('broadcastId param', () => {
    it('does not error when broadcastId is provided', async () => {
      const res = await request
        .get('/v1/sdk/campaigns?broadcastId=real-madrid-barcelona-2025-01-24')
        .set('x-api-key', API_KEY);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('campaigns');
    });

    it('broadcastId response contains campaigns array', async () => {
      const res = await request
        .get('/v1/sdk/campaigns?broadcastId=real-madrid-barcelona-2025-01-24')
        .set('x-api-key', API_KEY);
      expect(Array.isArray(res.body.campaigns)).toBe(true);
    });
  });
});
