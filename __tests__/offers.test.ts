/**
 * Integration tests: GET /v1/offers
 * Hits the real server at localhost:5001
 *
 * Coverage:
 * - Auth: missing apiKey → 401, invalid apiKey → 401
 * - With campaignId: returns offer shape (campaignId, campaignName, offers[])
 * - Without campaignId: resolves from active campaign (or returns valid shape)
 * - offers array may be empty but must be an array
 */

import supertest from 'supertest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5001';
const API_KEY = process.env.TEST_API_KEY || 'viaplay_api_key_0c611e983b314ff8';
const CAMPAIGN_ID = 35;

const request = supertest(BASE_URL);

describe('GET /v1/offers', () => {
  describe('Auth', () => {
    it('returns 401 when no apiKey is provided', async () => {
      const res = await request.get(`/v1/offers?campaignId=${CAMPAIGN_ID}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 when apiKey is invalid', async () => {
      const res = await request
        .get(`/v1/offers?campaignId=${CAMPAIGN_ID}`)
        .set('x-api-key', 'invalid_key_000');
      expect(res.status).toBe(401);
    });
  });

  describe('Response shape — with campaignId', () => {
    let res: supertest.Response;

    beforeAll(async () => {
      res = await request
        .get(`/v1/offers?campaignId=${CAMPAIGN_ID}`)
        .set('x-api-key', API_KEY);
    });

    it('returns 200', () => {
      expect(res.status).toBe(200);
    });

    it('returns campaignId as number', () => {
      expect(typeof res.body.campaignId).toBe('number');
      expect(res.body.campaignId).toBe(CAMPAIGN_ID);
    });

    it('returns campaignName as string', () => {
      expect(typeof res.body.campaignName).toBe('string');
    });

    it('returns offers as array (may be empty)', () => {
      expect(Array.isArray(res.body.offers)).toBe(true);
    });
  });

  describe('Response shape — without campaignId (resolves from active campaign)', () => {
    let res: supertest.Response;

    beforeAll(async () => {
      res = await request
        .get('/v1/offers')
        .set('x-api-key', API_KEY);
    });

    it('returns 200 or 404 (no active campaign)', () => {
      // Without campaignId, server resolves active campaign.
      // If none found → may return 404. Both are valid.
      expect([200, 404]).toContain(res.status);
    });

    it('if 200, returns offers array', () => {
      if (res.status === 200) {
        expect(Array.isArray(res.body.offers)).toBe(true);
      }
    });
  });
});
