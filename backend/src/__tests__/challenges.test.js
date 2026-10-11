import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import db from '../db/index.js';
import { initDb } from '../db/init.js';
import challengesRouter from '../routes/challenges.js';

describe('Challenges and Database Seed Tests (aligned with API_CONTRACT.md)', () => {
  let app;
  let server;
  let baseUrl;

  before(async () => {
    // Ensure DB is initialized with updated schema and seed data
    initDb();

    // Create test app instance
    app = express();
    app.use(express.json());
    app.use('/api/challenges', challengesRouter);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  test('Database contains largest-number and reverse-string challenges', () => {
    const challenges = db.prepare('SELECT * FROM challenges').all();
    assert.ok(challenges.length >= 2, `Expected >= 2 challenges, got ${challenges.length}`);
    const ids = challenges.map(c => c.id);
    assert.ok(ids.includes('largest-number'), 'largest-number challenge missing');
    assert.ok(ids.includes('reverse-string'), 'reverse-string challenge missing');
  });

  test('Each challenge has visible (public) and hidden test cases', () => {
    for (const challengeId of ['largest-number', 'reverse-string']) {
      const publicTests = db.prepare(
        'SELECT * FROM test_cases WHERE challenge_id = ? AND is_public = 1'
      ).all(challengeId);
      const hiddenTests = db.prepare(
        'SELECT * FROM test_cases WHERE challenge_id = ? AND is_public = 0'
      ).all(challengeId);

      assert.strictEqual(publicTests.length, 3, `Challenge ${challengeId} should have 3 public test cases`);
      assert.strictEqual(hiddenTests.length, 2, `Challenge ${challengeId} should have 2 hidden test cases`);
    }
  });

  test('GET /api/challenges returns { challenges: [...] } without test cases', async () => {
    const res = await fetch(`${baseUrl}/api/challenges`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.ok(Array.isArray(body.challenges), 'Expected body.challenges array');
    assert.strictEqual(body.challenges.length >= 2, true);

    const largest = body.challenges.find(c => c.id === 'largest-number');
    assert.ok(largest, 'largest-number not found in challenges array');
    assert.strictEqual(largest.title, 'Find the largest number');
    assert.strictEqual(largest.difficulty, 'easy');
    assert.strictEqual(largest.concept, 'loop_boundary');
    assert.ok(Array.isArray(largest.languages));
    assert.strictEqual(largest.testCases, undefined, 'Test cases must not leak into challenge list');
    assert.strictEqual(largest.visibleTests, undefined, 'Visible tests must not leak into challenge list');
  });

  test('GET /api/challenges/:id returns { challenge: { ... } } with visibleTests only', async () => {
    const res = await fetch(`${baseUrl}/api/challenges/largest-number`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.ok(body.challenge, 'Expected body.challenge object');
    assert.strictEqual(body.challenge.id, 'largest-number');
    assert.strictEqual(body.challenge.concept, 'loop_boundary');
    assert.ok(body.challenge.starterCode.javascript);
    assert.ok(body.challenge.starterCode.java);

    // Verify visibleTests are present
    assert.strictEqual(body.challenge.visibleTests.length, 3);
    const visible1 = body.challenge.visibleTests[0];
    assert.strictEqual(visible1.id, 'visible-1');
    assert.ok(visible1.stdin !== undefined);
    assert.ok(visible1.expectedStdout !== undefined);

    // Verify hidden tests are NEVER returned
    const bodyStr = JSON.stringify(body);
    assert.ok(!bodyStr.includes('hidden-1'), 'Hidden test case hidden-1 leaked!');
    assert.ok(!bodyStr.includes('hidden-2'), 'Hidden test case hidden-2 leaked!');
  });

  test('GET /api/challenges/:id returns 404 for unknown challenge', async () => {
    const res = await fetch(`${baseUrl}/api/challenges/non-existent-challenge-id`);
    assert.strictEqual(res.status, 404);

    const body = await res.json();
    assert.ok(body.error);
    assert.strictEqual(body.error.code, 'CHALLENGE_NOT_FOUND');
  });

  test.after(() => {
    if (server) {
      server.close();
    }
  });
});
