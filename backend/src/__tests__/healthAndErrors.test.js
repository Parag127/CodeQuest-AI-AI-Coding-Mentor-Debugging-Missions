import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';

describe('Milestone 1 — Health Endpoint, Request Validation & Error Handling Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  describe('1. Health and Probes Endpoint (GET /api/health, GET /api/info)', () => {
    test('GET /api/health returns 200 with service metrics aligned with API contract', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.status, 'healthy');
      assert.strictEqual(data.service, 'codedna-api');
      assert.ok(data.timestamp, 'timestamp missing');
      assert.ok(typeof data.uptimeSeconds === 'number', 'uptimeSeconds must be number');
      assert.ok(data.memoryUsageMB, 'memoryUsageMB missing');
      assert.ok(typeof data.memoryUsageMB.rss === 'number');
      assert.ok(typeof data.memoryUsageMB.heapTotal === 'number');
      assert.ok(typeof data.memoryUsageMB.heapUsed === 'number');
    });

    test('GET /api/info returns runtime telemetry and hardware specifications', async () => {
      const res = await fetch(`${baseUrl}/api/info`);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.ok(data.hostname);
      assert.ok(data.platform);
      assert.ok(data.nodeVersion);
      assert.ok(typeof data.port === 'number' || typeof data.port === 'string');
    });
  });

  describe('2. Malformed Request Handling (SyntaxError / Invalid JSON)', () => {
    test('POST with malformed JSON body returns 400 with INVALID_JSON error code', async () => {
      const res = await fetch(`${baseUrl}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"title": "Unclosed JSON string, missing brace'
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error, 'data.error missing');
      assert.strictEqual(data.error.code, 'INVALID_JSON');
      assert.ok(data.message.includes('Malformed JSON'));
    });
  });

  describe('3. Request Body Size Limit Handling (100kb limit)', () => {
    test('POST with body exceeding 100kb limit returns 413 Payload Too Large', async () => {
      // Create a payload larger than 100 KB
      const largeTitle = 'A'.repeat(105 * 1024);
      const res = await fetch(`${baseUrl}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: largeTitle })
      });

      assert.strictEqual(res.status, 413);
      const data = await res.json();
      assert.ok(data.error, 'data.error missing');
      assert.strictEqual(data.error.code, 'PAYLOAD_TOO_LARGE');
      assert.ok(data.message.includes('100kb'));
    });
  });

  describe('4. 404 Unknown Route Handling', () => {
    test('GET on nonexistent endpoint returns 404 with NOT_FOUND error code', async () => {
      const res = await fetch(`${baseUrl}/api/nonexistent-route-endpoint`);
      assert.strictEqual(res.status, 404);

      const data = await res.json();
      assert.ok(data.error);
      assert.strictEqual(data.error.code, 'NOT_FOUND');
      assert.ok(data.path.includes('/api/nonexistent-route-endpoint'));
    });
  });

  describe('5. Input Validation Consistency', () => {
    test('POST /api/items without title returns 400 with validation error', async () => {
      const res = await fetch(`${baseUrl}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'DevOps' })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'Title is required');
    });

    test('POST /api/auth/login without credentials returns 400 with validation error', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'Email and password are required');
    });

    test('DELETE /api/items with nonexistent ID returns 404', async () => {
      const res = await fetch(`${baseUrl}/api/items/99999999`, {
        method: 'DELETE'
      });

      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'Item not found');
    });
  });
});
