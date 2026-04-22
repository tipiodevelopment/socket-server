/**
 * Integration tests: Shoppable Ad Activations
 *
 * Hits the live server at localhost:5001 (against the Neon feature DB branch).
 *
 * Coverage:
 * - Auth matrix on each entry point:
 *   - POST /api/broadcasts/:id/shoppable-ad → 401 without Bearer
 *   - POST /api/sdk/tv/broadcasts/:id/shoppable-ad → 401 without/invalid apiKey
 *   - POST /api/broadcasts/:id/trigger-shoppable-ad → 200 (no auth)
 * - Happy path per source:
 *   - dashboard: activationId returned, row persisted with source='dashboard'
 *   - tv-sdk: activationId returned, row persisted with source='tv-sdk' + clientAppId
 * - Input validation:
 *   - Missing productId → 400
 *   - Invalid broadcastId → 404
 * - Read endpoint:
 *   - Returns rows sorted by triggeredAt desc
 *   - source filter works
 *   - limit/offset pagination works
 *
 * Requires:
 *   - Backend running on TEST_BASE_URL (default http://localhost:5001)
 *   - TEST_API_KEY (client_app apiKey for TV SDK tests; default = VG demo key)
 *   - A live broadcast exists at BROADCAST_ID on campaign CAMPAIGN_ID
 *   - DB is expected to already have the `shoppable_ad_activations` table
 */

import supertest from 'supertest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5001';
const API_KEY = process.env.TEST_API_KEY || 'vg_api_key_87cce71a18c9f942';
const BROADCAST_ID = process.env.TEST_BROADCAST_ID || 'paris-saint-germain-vs-chelsea-2026-03-11';
const CAMPAIGN_ID = Number(process.env.TEST_CAMPAIGN_ID || 35);

const request = supertest(BASE_URL);

describe('Shoppable Ad Activations', () => {
  describe('Auth matrix', () => {
    it('POST /api/broadcasts/:id/shoppable-ad (admin) → 401 without Bearer', async () => {
      const res = await request
        .post(`/api/broadcasts/${BROADCAST_ID}/shoppable-ad`)
        .send({ productId: '1' });
      expect(res.status).toBe(401);
    });

    it('POST /api/sdk/tv/broadcasts/:id/shoppable-ad → 401 without apiKey', async () => {
      const res = await request
        .post(`/api/sdk/tv/broadcasts/${BROADCAST_ID}/shoppable-ad`)
        .send({ productId: '1' });
      expect(res.status).toBe(401);
    });

    it('POST /api/sdk/tv/broadcasts/:id/shoppable-ad → 401 with invalid apiKey', async () => {
      const res = await request
        .post(`/api/sdk/tv/broadcasts/${BROADCAST_ID}/shoppable-ad`)
        .set('x-api-key', 'bogus_key_000')
        .send({ productId: '1' });
      expect(res.status).toBe(401);
    });

    it('POST /api/broadcasts/:id/trigger-shoppable-ad (dashboard) → accepts request without auth', async () => {
      const res = await request
        .post(`/api/broadcasts/${BROADCAST_ID}/trigger-shoppable-ad`)
        .send({ productId: 'auth-check' });
      // may be 200 (success) — not 401
      expect(res.status).not.toBe(401);
    });
  });

  describe('Input validation', () => {
    it('returns 400 when productId is missing (dashboard)', async () => {
      const res = await request
        .post(`/api/broadcasts/${BROADCAST_ID}/trigger-shoppable-ad`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/productId/i);
    });

    it('returns 400 when productId is missing (tv-sdk)', async () => {
      const res = await request
        .post(`/api/sdk/tv/broadcasts/${BROADCAST_ID}/shoppable-ad`)
        .set('x-api-key', API_KEY)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/productId/i);
    });

    it('returns 404 for unknown broadcastId (dashboard)', async () => {
      const res = await request
        .post(`/api/broadcasts/broadcast-that-does-not-exist/trigger-shoppable-ad`)
        .send({ productId: '1' });
      expect(res.status).toBe(404);
    });
  });

  describe('Happy path — dashboard source', () => {
    let res: supertest.Response;
    const productId = `test-dashboard-${Date.now()}`;

    beforeAll(async () => {
      res = await request
        .post(`/api/broadcasts/${BROADCAST_ID}/trigger-shoppable-ad`)
        .send({ productId });
    });

    it('returns 200', () => {
      expect(res.status).toBe(200);
    });

    it('returns activationId (number)', () => {
      expect(typeof res.body.activationId).toBe('number');
      expect(res.body.activationId).toBeGreaterThan(0);
    });

    it('returns product with fallback fields', () => {
      expect(res.body.product).toBeDefined();
      expect(res.body.product.id).toBe(productId);
      expect(res.body.product.currency).toBe('NOK');
    });

    it('row appears in list endpoint with source=dashboard', async () => {
      const list = await request
        .get(`/api/broadcasts/${BROADCAST_ID}/shoppable-ads?source=dashboard&limit=5`);
      expect(list.status).toBe(200);
      expect(Array.isArray(list.body.activations)).toBe(true);
      const found = list.body.activations.find((a: any) => a.id === res.body.activationId);
      expect(found).toBeDefined();
      expect(found.source).toBe('dashboard');
      expect(found.productId).toBe(productId);
      expect(found.broadcastId).toBe(BROADCAST_ID);
      expect(found.campaignId).toBe(CAMPAIGN_ID);
      expect(found.wsEventSent).toBe(true);
      expect(found.clientAppId).toBeNull();
    });
  });

  describe('Happy path — tv-sdk source', () => {
    let res: supertest.Response;
    const productId = `test-tvsdk-${Date.now()}`;

    beforeAll(async () => {
      res = await request
        .post(`/api/sdk/tv/broadcasts/${BROADCAST_ID}/shoppable-ad`)
        .set('x-api-key', API_KEY)
        .send({ productId });
    });

    it('returns 200', () => {
      expect(res.status).toBe(200);
    });

    it('returns activationId', () => {
      expect(typeof res.body.activationId).toBe('number');
    });

    it('row has source=tv-sdk and a non-null clientAppId', async () => {
      const list = await request
        .get(`/api/broadcasts/${BROADCAST_ID}/shoppable-ads?source=tv-sdk&limit=5`);
      const found = list.body.activations.find((a: any) => a.id === res.body.activationId);
      expect(found).toBeDefined();
      expect(found.source).toBe('tv-sdk');
      expect(typeof found.clientAppId).toBe('number');
    });

    it('accepts apiKey via query param too', async () => {
      const r = await request
        .post(`/api/sdk/tv/broadcasts/${BROADCAST_ID}/shoppable-ad?apiKey=${API_KEY}`)
        .send({ productId: `test-tvsdk-query-${Date.now()}` });
      expect(r.status).toBe(200);
      expect(typeof r.body.activationId).toBe('number');
    });
  });

  describe('Read endpoint — GET /api/broadcasts/:id/shoppable-ads', () => {
    it('returns { activations, limit, offset, count } shape', async () => {
      const res = await request.get(`/api/broadcasts/${BROADCAST_ID}/shoppable-ads`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.activations)).toBe(true);
      expect(typeof res.body.limit).toBe('number');
      expect(typeof res.body.offset).toBe('number');
      expect(typeof res.body.count).toBe('number');
    });

    it('sorts by triggeredAt descending (newest first)', async () => {
      const res = await request.get(`/api/broadcasts/${BROADCAST_ID}/shoppable-ads?limit=20`);
      const times = res.body.activations.map((a: any) => new Date(a.triggeredAt).getTime());
      for (let i = 1; i < times.length; i++) {
        expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
      }
    });

    it('honours limit', async () => {
      const res = await request.get(`/api/broadcasts/${BROADCAST_ID}/shoppable-ads?limit=2`);
      expect(res.body.activations.length).toBeLessThanOrEqual(2);
      expect(res.body.limit).toBe(2);
    });

    it('source filter excludes other sources', async () => {
      const res = await request.get(`/api/broadcasts/${BROADCAST_ID}/shoppable-ads?source=tv-sdk`);
      for (const row of res.body.activations) {
        expect(row.source).toBe('tv-sdk');
      }
    });

    it('clamps limit to max 200', async () => {
      const res = await request.get(`/api/broadcasts/${BROADCAST_ID}/shoppable-ads?limit=9999`);
      expect(res.body.limit).toBe(200);
    });
  });
});
