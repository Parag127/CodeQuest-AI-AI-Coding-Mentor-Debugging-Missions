import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import hintsRouter from '../routes/hints.js';
import ebyfRouter from '../routes/explainBeforeFix.js';
import progressRouter from '../routes/progress.js';
import { store } from '../data/store.js';

function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/hints', hintsRouter);
  app.use('/api/explain-before-fix', ebyfRouter);
  app.use('/api/progress', progressRouter);
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

describe('Hints, EBYF & Progress Routes', () => {
  let app;

  beforeEach(() => {
    store.reset();
    app = createTestApp();
  });

  describe('POST /api/hints', () => {
    it('validates required fields (submissionId, hintLevel, learnerId)', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { hintLevel: 1, learnerId: 'learner-1' }
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /submissionId is required/);
    });

    it('rejects invalid hintLevel (must be 1, 2, or 3)', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: 'sub-1', hintLevel: 5, learnerId: 'learner-1' }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /hintLevel must be 1, 2, or 3/);
    });

    it('returns 404 if submission does not exist', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: 'non-existent', hintLevel: 1, learnerId: 'learner-1' }
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('enforces sequential progression and returns fallback hint when unconfigured', async () => {
      // 1. Create a submission in store
      const sub = store.saveSubmission({
        id: 'sub-test-hint-1',
        learnerId: 'learner-h1',
        challengeId: 'sum-array',
        language: 'javascript',
        code: 'for(let i=0; i<=arr.length; i++) sum+=arr[i];',
        testResults: [
          { isPublic: true, status: 'wrong_output', stdout: '12', expected_output: '10' },
          { isPublic: false, status: 'wrong_output', stdout: null }
        ]
      });

      // 2. Jumping to hint level 2 directly must fail
      const skipRes = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: sub.id, hintLevel: 2, learnerId: 'learner-h1' }
      });
      assert.equal(skipRes.status, 400);
      assert.match(skipRes.body.error, /Cannot skip hint levels/);

      // 3. Request Level 1 hint
      const level1Res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: sub.id, hintLevel: 1, learnerId: 'learner-h1' }
      });
      assert.equal(level1Res.status, 200);
      assert.equal(level1Res.body.success, true);
      assert.equal(level1Res.body.data.hintLevel, 1);
      assert.ok(level1Res.body.data.hint.length > 10);
      assert.equal(level1Res.body.data.isFallback, true);

      // 4. Now Level 2 can be requested
      const level2Res = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: { submissionId: sub.id, hintLevel: 2, learnerId: 'learner-h1' }
      });
      assert.equal(level2Res.status, 200);
      assert.equal(level2Res.body.data.hintLevel, 2);
    });
  });

  describe('POST /api/explain-before-fix', () => {
    it('validates explanation requirement', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: { submissionId: 'sub-1', learnerId: 'learner-1', explanation: 'tiny' }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /at least 5 characters/);
    });

    it('records reflection and returns non-evaluative feedback', async () => {
      const sub = store.saveSubmission({
        id: 'sub-test-ebyf',
        learnerId: 'learner-e1',
        challengeId: 'sum-array',
        language: 'javascript',
        code: 'for(let i=0; i<=arr.length; i++)'
      });

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: sub.id,
          learnerId: 'learner-e1',
          explanation: 'I think the loop condition checks one index too far',
          predictedVariable: 'i',
          predictedValue: 'arr.length'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.canProceedToHint, true);
      assert.ok(res.body.data.feedback.length > 10);

      // Ensure reflection is persisted
      const saved = store.getEbyf('learner-e1', sub.id);
      assert.ok(saved);
      assert.equal(saved.predictedVariable, 'i');
    });
  });

  describe('GET /api/progress/:learnerId', () => {
    it('returns learner summary with challenges and recurring mistake counts', async () => {
      const learnerId = 'learner-telemetry-1';

      // Record a bug fingerprint
      store.saveBugFingerprints([
        {
          learnerId,
          challengeId: 'sum-array',
          submissionId: 'sub-1',
          patternKey: 'loop_condition',
          language: 'javascript'
        },
        {
          learnerId,
          challengeId: 'sum-array',
          submissionId: 'sub-2',
          patternKey: 'loop_condition',
          language: 'javascript'
        },
        {
          learnerId,
          challengeId: 'sum-array',
          submissionId: 'sub-3',
          patternKey: 'off_by_one',
          language: 'javascript'
        }
      ]);

      store.updateProgress(learnerId, 'sum-array', {
        passCount: 2,
        totalTests: 5,
        hintUsed: true
      });

      const res = await dispatch(app, {
        method: 'GET',
        path: `/api/progress/${learnerId}`
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const data = res.body.data;
      assert.equal(data.learnerId, learnerId);
      assert.ok(Array.isArray(data.challenges));

      const chProg = data.challenges.find(c => c.challengeId === 'sum-array');
      assert.ok(chProg);
      assert.equal(chProg.hintsUsed, 1);

      const mistakes = data.recurringMistakes;
      assert.ok(Array.isArray(mistakes));
      const loopPattern = mistakes.find(m => m.patternKey === 'loop_condition');
      assert.ok(loopPattern);
      assert.equal(loopPattern.count, 2);
    });
  });
});
