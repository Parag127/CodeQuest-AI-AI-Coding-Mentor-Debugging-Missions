import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import db from '../db/index.js';
import { initDb } from '../db/init.js';
import challengesRouter from '../routes/challenges.js';
import {
  validateChallengeId,
  toPublicChallengeSummary,
  toPublicChallengeDetail
} from '../models/challengeModel.js';

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

  after(() => {
    if (server) {
      server.close();
    }
  });

  describe('1. Database Seed & Challenge Coverage', () => {
    test('Database contains beginner-level challenges covering loop boundaries, array conditions, and empty inputs', () => {
      const challenges = db.prepare('SELECT * FROM challenges').all();
      assert.ok(challenges.length >= 3, `Expected >= 3 challenges, got ${challenges.length}`);

      const ids = challenges.map(c => c.id);
      assert.ok(ids.includes('largest-number'), 'largest-number challenge missing');
      assert.ok(ids.includes('reverse-string'), 'reverse-string challenge missing');
      assert.ok(ids.includes('sum-positive'), 'sum-positive challenge missing');

      // Verify concept tags
      const largest = challenges.find(c => c.id === 'largest-number');
      assert.strictEqual(largest.concept, 'loop_boundary');

      const sumPos = challenges.find(c => c.id === 'sum-positive');
      assert.strictEqual(sumPos.concept, 'array_conditions');
    });

    test('Each challenge supports both JavaScript and Java starter code', () => {
      const challenges = db.prepare('SELECT * FROM challenges').all();
      for (const challenge of challenges) {
        assert.ok(challenge.starter_code_javascript, `${challenge.id} missing JavaScript starter code`);
        assert.ok(challenge.starter_code_java, `${challenge.id} missing Java starter code`);
        assert.ok(challenge.starter_code_javascript.length > 20, `${challenge.id} JS starter code too short`);
        assert.ok(challenge.starter_code_java.includes('public class Main'), `${challenge.id} Java starter code missing Main class`);
      }
    });

    test('Each challenge has at least 3 visible (public) and 2 hidden test cases', () => {
      for (const challengeId of ['largest-number', 'reverse-string', 'sum-positive']) {
        const publicTests = db.prepare(
          'SELECT * FROM test_cases WHERE challenge_id = ? AND is_public = 1'
        ).all(challengeId);
        const hiddenTests = db.prepare(
          'SELECT * FROM test_cases WHERE challenge_id = ? AND is_public = 0'
        ).all(challengeId);

        assert.ok(publicTests.length >= 3, `Challenge ${challengeId} should have >= 3 public test cases, got ${publicTests.length}`);
        assert.ok(hiddenTests.length >= 2, `Challenge ${challengeId} should have >= 2 hidden test cases, got ${hiddenTests.length}`);
      }
    });
  });

  describe('2. Public Model Serializers & Privacy Guarantees', () => {
    test('validateChallengeId validates lowercase slugs and rejects malformed values', () => {
      assert.strictEqual(validateChallengeId('largest-number').valid, true);
      assert.strictEqual(validateChallengeId('sum-positive').valid, true);
      assert.strictEqual(validateChallengeId('').valid, false);
      assert.strictEqual(validateChallengeId('INVALID_UPPERCASE').valid, false);
      assert.strictEqual(validateChallengeId('../traversal').valid, false);
      assert.strictEqual(validateChallengeId('has spaces').valid, false);
    });

    test('toPublicChallengeSummary strips internal hints, starter code, and DB timestamps', () => {
      const raw = {
        id: 'largest-number',
        title: 'Find the largest number',
        difficulty: 'easy',
        concept: 'loop_boundary',
        languages: '["javascript", "java"]',
        starter_code_javascript: 'console.log(1)',
        starter_code_java: 'System.out.println(1)',
        hint_level_1: 'Secret hint 1',
        hint_level_2: 'Secret hint 2',
        hint_level_3: 'Secret hint 3',
        created_at: '2026-10-11 12:00:00'
      };

      const summary = toPublicChallengeSummary(raw);
      assert.deepStrictEqual(Object.keys(summary).sort(), ['concept', 'difficulty', 'id', 'languages', 'title'].sort());
      assert.strictEqual(summary.hint_level_1, undefined);
      assert.strictEqual(summary.starter_code_javascript, undefined);
      assert.strictEqual(summary.created_at, undefined);
    });

    test('toPublicChallengeDetail never serializes hidden tests or internal hints', () => {
      const rawChallenge = {
        id: 'test-challenge',
        title: 'Test Title',
        difficulty: 'easy',
        concept: 'test_concept',
        description: 'Test Description',
        languages: '["javascript", "java"]',
        starter_code_javascript: 'js code',
        starter_code_java: 'java code',
        hint_level_1: 'secret 1'
      };

      const visibleTests = [
        { id: 'v-1', stdin: '1\n', expectedStdout: '1\n' }
      ];

      const detail = toPublicChallengeDetail(rawChallenge, visibleTests);
      assert.strictEqual(detail.id, 'test-challenge');
      assert.strictEqual(detail.visibleTests.length, 1);
      assert.strictEqual(detail.visibleTests[0].id, 'v-1');
      assert.strictEqual(detail.hint_level_1, undefined);
      assert.strictEqual(detail.hint_level_2, undefined);
    });
  });

  describe('3. REST API Endpoints', () => {
    test('GET /api/challenges returns { challenges: [...] } catalog without test cases or hints', async () => {
      const res = await fetch(`${baseUrl}/api/challenges`);
      assert.strictEqual(res.status, 200);

      const body = await res.json();
      assert.ok(Array.isArray(body.challenges), 'Expected body.challenges array');
      assert.ok(body.challenges.length >= 3, `Expected at least 3 challenges in catalog, got ${body.challenges.length}`);

      for (const item of body.challenges) {
        assert.ok(item.id);
        assert.ok(item.title);
        assert.ok(item.difficulty);
        assert.ok(item.concept);
        assert.ok(Array.isArray(item.languages));
        assert.strictEqual(item.testCases, undefined, 'Test cases must not leak into catalog');
        assert.strictEqual(item.visibleTests, undefined, 'Visible tests must not leak into catalog');
        assert.strictEqual(item.starterCode, undefined, 'Starter code must not leak into catalog');
        assert.strictEqual(item.hint_level_1, undefined, 'Hints must not leak into catalog');
      }
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
      assert.ok(body.challenge.visibleTests.length >= 3);
      const visible1 = body.challenge.visibleTests[0];
      assert.strictEqual(visible1.id, 'visible-1');
      assert.ok(visible1.stdin !== undefined);
      assert.ok(visible1.expectedStdout !== undefined);

      // Verify hidden tests are NEVER returned
      const bodyStr = JSON.stringify(body);
      assert.ok(!bodyStr.includes('hidden-1'), 'Hidden test case hidden-1 leaked!');
      assert.ok(!bodyStr.includes('hidden-2'), 'Hidden test case hidden-2 leaked!');
      assert.ok(!bodyStr.includes('hint_level_'), 'Internal hint field leaked!');
    });

    test('GET /api/challenges/sum-positive returns challenge with array condition concept', async () => {
      const res = await fetch(`${baseUrl}/api/challenges/sum-positive`);
      assert.strictEqual(res.status, 200);

      const body = await res.json();
      assert.strictEqual(body.challenge.id, 'sum-positive');
      assert.strictEqual(body.challenge.concept, 'array_conditions');
      assert.ok(body.challenge.visibleTests.length >= 3);

      const bodyStr = JSON.stringify(body);
      assert.ok(!bodyStr.includes('sum-pos-4-h'), 'Hidden test leaked!');
      assert.ok(!bodyStr.includes('sum-pos-5-h'), 'Hidden test leaked!');
    });

    test('GET /api/challenges/:id returns 400 for malformed challenge ID', async () => {
      const res = await fetch(`${baseUrl}/api/challenges/INVALID_SLUG!!`);
      assert.strictEqual(res.status, 400);

      const body = await res.json();
      assert.ok(body.error);
      assert.strictEqual(body.error.code, 'INVALID_CHALLENGE_ID');
    });

    test('GET /api/challenges/:id returns 404 for unknown challenge', async () => {
      const res = await fetch(`${baseUrl}/api/challenges/non-existent-challenge-id`);
      assert.strictEqual(res.status, 404);

      const body = await res.json();
      assert.ok(body.error);
      assert.strictEqual(body.error.code, 'CHALLENGE_NOT_FOUND');
      assert.strictEqual(body.error.message, "Challenge 'non-existent-challenge-id' not found");
    });
  });
});
