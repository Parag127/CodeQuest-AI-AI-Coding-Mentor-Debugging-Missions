import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import hintsRouter from '../routes/hints.js';
import { GeminiService } from '../services/geminiService.js';
import { store } from '../data/store.js';

function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/hints', hintsRouter);
  return app;
}

async function dispatch(app, { method, path, body = null }) {
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const url = `http://127.0.0.1:${port}${path}`;
      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined
        });
        const json = await response.json().catch(() => null);
        server.close(() => {
          resolve({ status: response.status, body: json });
        });
      } catch (err) {
        server.close(() => {
          resolve({ status: 500, error: err.message });
        });
      }
    });
  });
}

describe('DebugMate Progressive Hints Feature', () => {
  let app;

  beforeEach(() => {
    store.reset();
    app = createTestApp();
  });

  describe('Sequential Progression (Levels 1, 2, 3)', () => {
    it('successfully requests hints 1, 2, and 3 in proper sequence', async () => {
      const sub = store.saveSubmission({
        id: 'sub-seq-test',
        learnerId: 'learner-seq-1',
        challengeId: 'sum-array',
        language: 'javascript',
        code: 'function sumArray(arr) { let sum = 0; for(let i=0; i<arr.length-1; i++) sum += arr[i]; return sum; }',
        testResults: [
          { isPublic: true, status: 'wrong_output', stdout: '9', expected_output: '10' }
        ]
      });

      // 1. Level 1 (Conceptual nudge)
      const res1 = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: {
          submissionId: sub.id,
          hintLevel: 1,
          learnerId: 'learner-seq-1'
        }
      });
      assert.equal(res1.status, 200);
      assert.equal(res1.body.success, true);
      assert.equal(res1.body.data.hintLevel, 1);
      assert.ok(res1.body.data.hint.length > 10);

      // 2. Level 2 (Logic & boundary pointer)
      const res2 = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: {
          submissionId: sub.id,
          hintLevel: 2,
          learnerId: 'learner-seq-1'
        }
      });
      assert.equal(res2.status, 200);
      assert.equal(res2.body.data.hintLevel, 2);
      assert.ok(res2.body.data.hint.length > 10);

      // 3. Level 3 (Specific debugging direction)
      const res3 = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: {
          submissionId: sub.id,
          hintLevel: 3,
          learnerId: 'learner-seq-1'
        }
      });
      assert.equal(res3.status, 200);
      assert.equal(res3.body.data.hintLevel, 3);
      assert.ok(res3.body.data.hint.length > 10);
    });
  });

  describe('Level Skipping Prevention', () => {
    it('rejects jumping to Level 2 without requesting Level 1 first', async () => {
      const sub = store.saveSubmission({
        id: 'sub-skip-1',
        learnerId: 'learner-skip',
        challengeId: 'sum-array',
        code: 'let sum = 0;'
      });

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: {
          submissionId: sub.id,
          hintLevel: 2,
          learnerId: 'learner-skip'
        }
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /Cannot skip hint levels\. Next available hint level is 1/);
    });

    it('rejects jumping to Level 3 when only Level 1 has been unlocked', async () => {
      const sub = store.saveSubmission({
        id: 'sub-skip-2',
        learnerId: 'learner-skip-2',
        challengeId: 'sum-array',
        code: 'let sum = 0;'
      });

      // Unlock Level 1
      await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: sub.id, hintLevel: 1, learnerId: 'learner-skip-2' }
      });

      // Try skipping to Level 3
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: sub.id, hintLevel: 3, learnerId: 'learner-skip-2' }
      });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Cannot skip hint levels\. Next available hint level is 2/);
    });
  });

  describe('Repeated Requests for Already Unlocked Levels', () => {
    it('returns the previously stored hint without error or counter inflation on repeated request', async () => {
      const sub = store.saveSubmission({
        id: 'sub-repeat-1',
        learnerId: 'learner-rep',
        challengeId: 'sum-array',
        code: 'let sum = 0;'
      });

      // 1. Initial Level 1 request
      const firstRes = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: sub.id, hintLevel: 1, learnerId: 'learner-rep' }
      });
      assert.equal(firstRes.status, 200);
      const originalHint = firstRes.body.data.hint;

      // 2. Repeated Level 1 request
      const repeatRes = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: sub.id, hintLevel: 1, learnerId: 'learner-rep' }
      });
      assert.equal(repeatRes.status, 200);
      assert.equal(repeatRes.body.data.hintLevel, 1);
      assert.equal(repeatRes.body.data.hint, originalHint);
      assert.equal(repeatRes.body.data.isRepeated, true);

      // Verify that hint history didn't record a duplicate entry
      const history = store.getHintsForSubmission(sub.id);
      assert.equal(history.length, 1);
    });
  });

  describe('Invalid Levels & Missing Data Validation', () => {
    it('rejects invalid hint levels (< 1, > 3, non-integers)', async () => {
      const sub = store.saveSubmission({
        id: 'sub-invalid-lvl',
        learnerId: 'l1',
        challengeId: 'sum-array',
        code: 'return 1;'
      });

      for (const badLevel of [0, 4, -1, 2.5, 'two', null]) {
        const res = await dispatch(app, {
          method: 'POST',
          path: '/api/hints',
          body: { submissionId: sub.id, hintLevel: badLevel, learnerId: 'l1' }
        });
        assert.equal(res.status, 400);
        assert.match(res.body.error, /hintLevel/);
      }
    });

    it('rejects missing learnerId', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: 'sub-1', hintLevel: 1 }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /learnerId is required/);
    });

    it('rejects request when neither submissionId nor code is provided', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { hintLevel: 1, learnerId: 'l-test' }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /submissionId is required/);
    });

    it('returns 404 when unknown submissionId is given without code', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: 'does-not-exist', hintLevel: 1, learnerId: 'l-test' }
      });
      assert.equal(res.status, 404);
      assert.match(res.body.error, /Submission not found/);
    });

    it('rejects oversized code payloads (> 64KB) with 413', async () => {
      const hugeCode = 'let a = 1;\n'.repeat(6000); // > 65,536 bytes
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: {
          code: hugeCode,
          hintLevel: 1,
          learnerId: 'learner-oversized'
        }
      });
      assert.equal(res.status, 413);
      assert.match(res.body.error, /64KB maximum limit/);
    });
  });

  describe('Protection of Hidden Test Data', () => {
    it('verifies that hidden test inputs and expected outputs are never sent to Gemini', async () => {
      let interceptedPrompt = '';
      const capturingClient = {
        getGenerativeModel: () => ({
          generateContent: async (prompt) => {
            interceptedPrompt = prompt;
            return {
              response: {
                text: () => 'Think carefully about how each index is accessed.'
              }
            };
          }
        })
      };

      const testService = new GeminiService({ client: capturingClient });

      await testService.generateHint({
        challengeTitle: 'Sum Array',
        challengeDescription: 'Sum integers',
        hintLevel: 1,
        code: 'for(let i=0; i<arr.length; i++) sum+=arr[i];',
        publicTestResults: [
          { testCaseId: 'pub-1', isPublic: true, status: 'passed' },
          { testCaseId: 'hidden-secret-1', isPublic: false, status: 'wrong_output', stdin: 'TOP_SECRET_STDIN_12345', expected_output: 'TOP_SECRET_EXP_99999' }
        ],
        publicExamples: [
          { stdin: '[1, 2, 3]', expected_output: '6', isPublic: true },
          { stdin: 'HIDDEN_EXAMPLE_INPUT', expected_output: 'HIDDEN_EXAMPLE_OUT', isPublic: false }
        ]
      });

      // Verify that hidden inputs and outputs are NOT in the prompt
      assert.ok(!interceptedPrompt.includes('TOP_SECRET_STDIN_12345'));
      assert.ok(!interceptedPrompt.includes('TOP_SECRET_EXP_99999'));
      assert.ok(!interceptedPrompt.includes('HIDDEN_EXAMPLE_INPUT'));
      assert.ok(!interceptedPrompt.includes('HIDDEN_EXAMPLE_OUT'));
      // Public example is present
      assert.ok(interceptedPrompt.includes('[1, 2, 3]'));
    });
  });

  describe('Gemini Failure & Fallbacks', () => {
    it('returns static fallback when Gemini is unconfigured or fails', async () => {
      const sub = store.saveSubmission({
        id: 'sub-fallback-test',
        learnerId: 'l-fallback',
        challengeId: 'sum-array',
        code: 'for(let i=0; i<=arr.length; i++) sum+=arr[i];'
      });

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: {
          submissionId: sub.id,
          hintLevel: 1,
          learnerId: 'l-fallback'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.isFallback, true);
      assert.ok(res.body.data.hint.length > 15);
    });
  });
});
