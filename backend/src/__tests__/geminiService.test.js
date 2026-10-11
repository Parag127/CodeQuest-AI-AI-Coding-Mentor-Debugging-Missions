import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
import { initDb } from '../db/init.js';
import hintsRouter from '../routes/hints.js';
import aiRouter from '../routes/ai.js';
import {
  GeminiService,
  sanitizeErrorMessage,
  validateAiHintOutput,
  validateEbyfOutput,
  validateHintOutput,
  getStaticFallbackHint,
  DEFAULT_GEMINI_MODEL
} from '../services/geminiService.js';

describe('Gemini Service & Safety Validators', () => {
  describe('Configuration & Validation', () => {
    it('reports isConfigured() = false when API key is missing or default placeholder', () => {
      const serviceNoKey = new GeminiService({ apiKey: '' });
      assert.equal(serviceNoKey.isConfigured(), false);

      const servicePlaceholder = new GeminiService({ apiKey: 'your_gemini_api_key_here' });
      assert.equal(servicePlaceholder.isConfigured(), false);
    });

    it('reports isConfigured() = true when a non-empty API key is set', () => {
      const serviceWithKey = new GeminiService({ apiKey: 'test-api-key-12345' });
      assert.equal(serviceWithKey.isConfigured(), true);
    });

    it('throws error if prompt is empty or not a string', async () => {
      const service = new GeminiService({ apiKey: 'test-key' });
      await assert.rejects(
        () => service.generateText(''),
        /Prompt must be a non-empty string/
      );
      await assert.rejects(
        () => service.generateText(null),
        /Prompt must be a non-empty string/
      );
    });

    it('throws when calling generateText without configured API key', async () => {
      const unconfiguredService = new GeminiService({ apiKey: '' });
      await assert.rejects(
        () => unconfiguredService.generateText('Hello'),
        /GEMINI_API_KEY is not configured/
      );
    });
  });

  describe('Mocked Client Interactions', () => {
    function createMockClient({ textResponse = 'Hello from mock Gemini', shouldFail = false, delayMs = 0, errorMessage = 'Simulated upstream error' } = {}) {
      return {
        getGenerativeModel: ({ model }) => ({
          generateContent: async (_prompt) => {
            if (delayMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
            if (shouldFail) {
              throw new Error(errorMessage);
            }
            return {
              response: {
                text: () => textResponse
              }
            };
          }
        })
      };
    }

    it('successfully generates text with a mocked client without requiring real network/API key', async () => {
      const mockClient = createMockClient({ textResponse: 'OK, this is a response.' });
      const service = new GeminiService({ client: mockClient });

      const result = await service.generateText('Ping');
      assert.equal(result.text, 'OK, this is a response.');
      assert.equal(result.model, DEFAULT_GEMINI_MODEL);
    });

    it('handles simulated upstream Gemini API failure gracefully', async () => {
      const mockClient = createMockClient({
        shouldFail: true,
        errorMessage: 'Quota exceeded or invalid credentials'
      });
      const service = new GeminiService({ client: mockClient });

      await assert.rejects(
        () => service.generateText('Test failure'),
        /Quota exceeded or invalid credentials/
      );
    });

    it('enforces request timeout when API response is delayed', async () => {
      const slowClient = createMockClient({
        textResponse: 'Too late',
        delayMs: 200
      });
      const service = new GeminiService({
        client: slowClient,
        timeoutMs: 50
      });

      await assert.rejects(
        () => service.generateText('Prompt with short timeout'),
        /Gemini API request timed out after 50ms/
      );
    });

    it('handles malformed API response object', async () => {
      const malformedClient = {
        getGenerativeModel: () => ({
          generateContent: async () => ({ response: null })
        })
      };
      const service = new GeminiService({ client: malformedClient });

      await assert.rejects(
        () => service.generateText('Check malformed'),
        /Invalid response structure received from Gemini API/
      );
    });
  });

  describe('Hint & EBYF Output Validators', () => {
    it('accepts clean pedagogical hints of proper word count', () => {
      const hint = 'Take a close look at the condition in your loop header. Notice how your loop variable compares to the array length, and consider whether the last index is being accessed properly.';
      const result = validateAiHintOutput(hint);
      assert.equal(result.isValid, true);
    });

    it('rejects hints containing markdown code fences', () => {
      const codeHint = 'Here is what you should write:\n```javascript\nfor (let i = 0; i < arr.length; i++)\n```\nTry this!';
      const result = validateAiHintOutput(codeHint);
      assert.equal(result.isValid, false);
      assert.equal(result.reason, 'Contains code blocks');
    });

    it('rejects hints with forbidden solution leak phrases', () => {
      const phrases = [
        'The correct code is to use a while loop instead.',
        'Here is the fix for your index boundary.',
        'The answer is to initialize the sum to zero.'
      ];
      for (const p of phrases) {
        assert.equal(validateAiHintOutput(p).isValid, false);
      }
    });

    it('rejects hints that are too short (< 10 words) or empty', () => {
      assert.equal(validateAiHintOutput('Look at your loop.').isValid, false);
      assert.equal(validateAiHintOutput('').isValid, false);
      assert.equal(validateAiHintOutput(null).isValid, false);
    });

    it('validates EBYF feedback length and rejects code fences', () => {
      const valid = 'Thinking about variable state transitions is a crucial debugging skill. Great reflection.';
      assert.equal(validateEbyfOutput(valid).isValid, true);

      const withCode = 'Check your ```count``` variable carefully.';
      assert.equal(validateEbyfOutput(withCode).isValid, false);
    });
  });

  describe('validateHintOutput Anti-Leak Validator', () => {
    it('accepts valid pedagogical hints within length limits', () => {
      const goodHint = 'Take a close look at the condition in your while loop. Notice that you may need to compare the index with the length of the list minus one.';
      assert.strictEqual(validateHintOutput(goodHint), true);
    });

    it('rejects hints that are too short (< 10 words)', () => {
      assert.strictEqual(validateHintOutput('Check your loop variable.'), false);
    });

    it('rejects hints containing code fences or backticks', () => {
      const leakyHint = 'Here is the fix: ```javascript let i = 0; while (i < arr.length) ``` This should work for your test cases.';
      assert.strictEqual(validateHintOutput(leakyHint), false);
    });

    it('rejects hints containing forbidden answer giveaway phrases', () => {
      const giveaway1 = 'The correct code is to change i <= n to i < n in your condition.';
      assert.strictEqual(validateHintOutput(giveaway1), false);

      const giveaway2 = 'Here is the fix for the boundary bug you encountered in the array.';
      assert.strictEqual(validateHintOutput(giveaway2), false);

      const giveaway3 = 'The answer is that the index should start at 0 instead of 1.';
      assert.strictEqual(validateHintOutput(giveaway3), false);
    });
  });

  describe('getStaticFallbackHint Unit Tests', () => {
    it('returns generic fallback if challenge is null', () => {
      const fallback = getStaticFallbackHint(null, 1);
      assert.ok(typeof fallback === 'string' && fallback.length > 0);
    });

    it('retrieves correct fallback level for challenge', () => {
      initDb();
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

  describe('generateHint & generateEbyfFeedback with Mock Client', () => {
    it('returns generated hint when AI response passes validation', async () => {
      const mockClient = {
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              text: () => 'Think carefully about the value of your loop index when the loop exits and whether it reaches the last element of the collection.'
            }
          })
        })
      };
      const service = new GeminiService({ client: mockClient });
      const hint = await service.generateHint({
        challengeTitle: 'Sum Array',
        challengeDescription: 'Sum array elements',
        language: 'javascript',
        hintLevel: 1,
        code: 'for(let i=0; i<=arr.length; i++) sum+=arr[i];',
        fallbackHint: 'Curated static fallback'
      });

      assert.equal(hint.isFallback, false);
      assert.match(hint.hintText, /loop index/);
    });

    it('falls back to static hint when AI response contains code block', async () => {
      const leakingClient = {
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              text: () => 'Here is the fix:\n```javascript\nfor (let i = 0; i < len; i++)\n```'
            }
          })
        })
      };
      const service = new GeminiService({ client: leakingClient });
      const hint = await service.generateHint({
        challengeTitle: 'Sum Array',
        challengeDescription: 'Sum array elements',
        hintLevel: 2,
        fallbackHint: 'Check your loop boundary condition carefully.'
      });

      assert.equal(hint.isFallback, true);
      assert.equal(hint.hintText, 'Check your loop boundary condition carefully.');
    });

    it('falls back to static hint when service is unconfigured', async () => {
      const unconfigured = new GeminiService({ apiKey: '' });
      const hint = await unconfigured.generateHint({
        challengeTitle: 'Sum Array',
        challengeDescription: 'Sum array elements',
        hintLevel: 1,
        fallbackHint: 'Curated fallback 1'
      });

      assert.equal(hint.isFallback, true);
      assert.equal(hint.hintText, 'Curated fallback 1');
    });

    it('generates EBYF feedback or falls back cleanly', async () => {
      const mockClient = {
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              text: () => 'Your hypothesis regarding the loop bound is thoughtful. Test how it behaves on the boundary case.'
            }
          })
        })
      };
      const service = new GeminiService({ client: mockClient });
      const ebyf = await service.generateEbyfFeedback({
        explanation: 'Loop index goes past end',
        predictedVariable: 'i',
        predictedValue: 'arr.length'
      });

      assert.equal(ebyf.isFallback, false);
      assert.match(ebyf.feedback, /boundary case/);
    });
  });

  describe('Secret Sanitization', () => {
    it('redacts potential API keys from error messages', () => {
      const rawError = 'Failed request to https://generativelanguage.googleapis.com?key=AIzaSyD_fakeSecret1234567890abcdefgh';
      const clean = sanitizeErrorMessage(rawError);

      assert.ok(!clean.includes('AIzaSyD_fakeSecret1234567890abcdefgh'));
      assert.match(clean, /key=\[REDACTED\]/);
    });

    it('redacts API_KEY= variable patterns', () => {
      const raw = 'Unauthorized with API_KEY=secret_key_12345 in header';
      const clean = sanitizeErrorMessage(raw);

      assert.ok(!clean.includes('secret_key_12345'));
      assert.match(clean, /API_KEY=\[REDACTED\]/);
    });
  });

  describe('GET /api/ai/health Route Integration', () => {
    it('returns 503 when service is unconfigured', async () => {
      const app = express();
      app.use('/api/ai', aiRouter);

      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/ai/health`);
        const json = await res.json();

        assert.equal(res.status, 503);
        assert.equal(json.success, false);
        assert.equal(json.status, 'unconfigured');
        assert.ok(!JSON.stringify(json).includes('AIza'));
      } finally {
        server.close();
        if (originalKey) process.env.GEMINI_API_KEY = originalKey;
      }
    });
  });

  describe('POST /api/hints Route & SQLite DB Acceptance Criteria', () => {
    let app;
    let server;
    let baseUrl;
    let testSubmissionId;

    before(async () => {
      initDb();

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

    after(() => {
      if (server) server.close();
    });

    test('rejects missing or invalid submissionId', async () => {
      const res = await fetch(`${baseUrl}/api/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hintLevel: 1 })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.ok(body.error?.code === 'INVALID_SUBMISSION_ID' || (typeof body.error === 'string' && body.error.includes('submissionId')));
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
      assert.ok(body.error?.code === 'INVALID_HINT_LEVEL' || (typeof body.error === 'string' && body.error.includes('hintLevel')));
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
      assert.ok(body.error?.code === 'CANNOT_SKIP_HINT_LEVELS' || (typeof body.error === 'string' && body.error.includes('skip')));
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
});
