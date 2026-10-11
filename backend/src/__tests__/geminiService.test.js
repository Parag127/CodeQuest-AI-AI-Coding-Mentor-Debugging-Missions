import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
import { initDb } from '../db/init.js';
import hintsRouter from '../routes/hints.js';
import {
  validateHintOutput,
  getStaticFallbackHint,
  generateProgressiveHint
} from '../services/geminiService.js';

describe('Gemini Service & Progressive Hints Tests', () => {
  let app;
  let server;
  let baseUrl;
  let testSubmissionId;

  before(async () => {
    initDb();

    // Create a dummy submission in db for hint testing
    testSubmissionId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO submissions (
        id, learner_id, challenge_id, language, code, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      testSubmissionId,
      'learner-hint-test',
      'largest-number',
      'javascript',
      'function findLargest(n) { return n[0]; }',
      'failed'
    );

    app = express();
    app.use(express.json());
    app.use('/api/hints', hintsRouter);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  describe('validateHintOutput Anti-Leak Validator', () => {
    test('accepts valid pedagogical hints without code', () => {
      const goodHint = 'Think about how many elements exist in the array and whether your loop counter actually visits the last one.';
      assert.strictEqual(validateHintOutput(goodHint), true);
    });

    test('rejects hints that are too short (< 10 words)', () => {
      assert.strictEqual(validateHintOutput('Check your loop variable.'), false);
    });

    test('rejects hints with code blocks or backticks', () => {
      const leakyHint = 'Look at your loop condition: change it to `i < numbers.length` so that it visits all elements.';
      assert.strictEqual(validateHintOutput(leakyHint), false);
    });

    test('rejects hints containing solution giveaway phrases', () => {
      const giveaway1 = 'The correct code for this loop requires using the less than comparison operator across all elements.';
      assert.strictEqual(validateHintOutput(giveaway1), false);

      const giveaway2 = 'Here is the fix: make sure the boundary condition reaches the end of the collection.';
      assert.strictEqual(validateHintOutput(giveaway2), false);

      const giveaway3 = 'The answer is to increase your loop boundary by one index position.';
      assert.strictEqual(validateHintOutput(giveaway3), false);
    });
  });

  describe('getStaticFallbackHint', () => {
    test('retrieves correct fallback level for challenge', () => {
      const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get('largest-number');
      assert.ok(challenge);

      const h1 = getStaticFallbackHint(challenge, 1);
      const h2 = getStaticFallbackHint(challenge, 2);
      const h3 = getStaticFallbackHint(challenge, 3);

      assert.strictEqual(h1, challenge.hint_level_1);
      assert.strictEqual(h2, challenge.hint_level_2);
      assert.strictEqual(h3, challenge.hint_level_3);
    });
  });

  describe('POST /api/hints Route & Acceptance Criteria', () => {
    test('rejects missing or invalid submissionId', async () => {
      const res = await fetch(`${baseUrl}/api/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hintLevel: 1 })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'INVALID_SUBMISSION_ID');
    });

    test('rejects invalid hintLevel', async () => {
      const res = await fetch(`${baseUrl}/api/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: testSubmissionId,
          hintLevel: 99
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'INVALID_HINT_LEVEL');
    });

    test('rejects skipping hint levels before unlocking level 1', async () => {
      const res = await fetch(`${baseUrl}/api/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: testSubmissionId,
          hintLevel: 2
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'CANNOT_SKIP_HINT_LEVELS');
    });

    test('Task 5 Acceptance: Returns static fallback hint with isFallback: true when GEMINI_API_KEY is not set', async () => {
      const prevKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const res = await fetch(`${baseUrl}/api/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: testSubmissionId,
          hintLevel: 1,
          learnerId: 'learner-hint-test'
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.hintLevel, 1);
      assert.ok(typeof body.hint === 'string' && body.hint.length > 0, 'Hint text must be non-empty');
      assert.strictEqual(body.isFallback, true, 'isFallback must be true when GEMINI_API_KEY is not set');

      // Verify hint history recorded in database
      const saved = db.prepare('SELECT * FROM hint_history WHERE submission_id = ? AND hint_level = 1').get(testSubmissionId);
      assert.ok(saved, 'Hint must be recorded in hint_history table');
      assert.strictEqual(saved.is_fallback, 1);

      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    });

    test('Unlocks hint level 2 sequentially after level 1', async () => {
      const res = await fetch(`${baseUrl}/api/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: testSubmissionId,
          hintLevel: 2,
          learnerId: 'learner-hint-test'
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.hintLevel, 2);
      assert.ok(body.hint.length > 0);
    });

    test('POST /api/hints/explain-before-fix provides non-evaluative feedback', async () => {
      const res = await fetch(`${baseUrl}/api/hints/explain-before-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: testSubmissionId,
          prediction: 'The loop visits all items except the last',
          explanation: 'Because the index is stopping at length - 1 with strictly less than'
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.feedback);
      assert.strictEqual(body.canProceedToHint, true);
    });
  });

  after(() => {
    if (server) server.close();
  });
});
