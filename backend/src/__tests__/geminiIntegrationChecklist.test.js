import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
import { initDb } from '../db/init.js';
import submissionsRouter from '../routes/submissions.js';
import aiRouter from '../routes/ai.js';
import hintsRouter from '../routes/hints.js';
import {
  geminiService,
  GeminiService,
  DEFAULT_GEMINI_MODEL
} from '../services/geminiService.js';

describe('CodeDNA Step 7 — Gemini AI Integration Checklist', () => {
  let app;
  let server;
  let baseUrl;
  let submissionId;

  before(async () => {
    initDb();
    process.env.JUDGE0_MOCK_RUNNER = 'true';

    app = express();
    app.use(express.json({ limit: '100kb' }));
    app.use('/api/submissions', submissionsRouter);
    app.use('/api/ai', aiRouter);
    app.use('/api/hints', hintsRouter);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    // Create a real failed submission via the submissions endpoint
    const res = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: 'largest-number',
        language: 'javascript',
        code: 'function findLargest(n) { return n[0]; }', // Fails on non-first largest
        learnerId: 'checklist-learner-007'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    submissionId = body.submissionId;
    assert.ok(submissionId);
    assert.equal(body.status, 'failed');
  });

  after(() => {
    if (server) server.close();
  });

  it('Checklist 1: The existing Gemini service is reused, not duplicated', () => {
    assert.ok(geminiService instanceof GeminiService);
    assert.equal(typeof geminiService.generateSubmissionFeedback, 'function');
    assert.equal(typeof geminiService.generateHint, 'function');
    assert.equal(typeof geminiService.testConnection, 'function');
  });

  it('Checklist 2: A real failed submission can request an AI explanation', async () => {
    const res = await fetch(`${baseUrl}/api/ai/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data);
    assert.equal(body.data.executionStatus, 'wrong_output');
    assert.ok(typeof body.data.summary === 'string' && body.data.summary.length > 5);
    assert.ok(typeof body.data.likelyIssue === 'string' && body.data.likelyIssue.length > 5);
    assert.ok(typeof body.data.nextStep === 'string' && body.data.nextStep.length > 5);
  });

  it('Checklist 3: Progressive hints work at the intended levels', async () => {
    // 1. Level 1
    const res1 = await fetch(`${baseUrl}/api/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId,
        hintLevel: 1,
        learnerId: 'checklist-learner-007'
      })
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.success, true);
    assert.equal(body1.data.hintLevel, 1);
    assert.ok(body1.data.hint && body1.data.hint.length > 10);

    // 2. Reject skipping to Level 3 before Level 2
    const resSkip = await fetch(`${baseUrl}/api/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId,
        hintLevel: 3,
        learnerId: 'checklist-learner-007'
      })
    });
    assert.equal(resSkip.status, 400);

    // 3. Level 2
    const res2 = await fetch(`${baseUrl}/api/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId,
        hintLevel: 2,
        learnerId: 'checklist-learner-007'
      })
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.data.hintLevel, 2);
    assert.ok(body2.data.hint && body2.data.hint.length > 10);

    // 4. Level 3
    const res3 = await fetch(`${baseUrl}/api/hints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId,
        hintLevel: 3,
        learnerId: 'checklist-learner-007'
      })
    });
    assert.equal(res3.status, 200);
    const body3 = await res3.json();
    assert.equal(body3.data.hintLevel, 3);
    assert.ok(body3.data.hint && body3.data.hint.length > 10);
  });

  it('Checklist 4: The frontend receives the documented response format', async () => {
    const res = await fetch(`${baseUrl}/api/ai/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId })
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok('data' in body);
    const d = body.data;
    assert.ok('executionStatus' in d);
    assert.ok('passCount' in d);
    assert.ok('failCount' in d);
    assert.ok('totalTests' in d);
    assert.ok('summary' in d);
    assert.ok('likelyIssue' in d);
    assert.ok('nextStep' in d);
    assert.ok('isFallback' in d);
  });

  it('Checklist 5: The Gemini key remains on the backend', async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    const res = await fetch(`${baseUrl}/api/ai/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId })
    });
    const text = await res.text();

    if (apiKey && apiKey.length > 8) {
      assert.equal(text.includes(apiKey), false, 'API key must never appear in response body');
    }

    const healthRes = await fetch(`${baseUrl}/api/ai/health`);
    const healthText = await healthRes.text();
    if (apiKey && apiKey.length > 8) {
      assert.equal(healthText.includes(apiKey), false, 'API key must never appear in health telemetry');
    }
  });

  it('Checklist 6: Hidden tests are never sent to Gemini', async () => {
    // Look up hidden test cases from DB for largest-number
    const hiddenCases = db.prepare('SELECT stdin, expected_output FROM test_cases WHERE challenge_id = ? AND is_public = 0').all('largest-number');
    assert.ok(hiddenCases.length > 0, 'Challenge must have hidden test cases');

    let capturedPrompt = '';
    const capturingClient = {
      getGenerativeModel: () => ({
        generateContent: async (content) => {
          capturedPrompt = typeof content === 'string' ? content : JSON.stringify(content);
          return {
            response: {
              text: () => JSON.stringify({
                summary: 'Pedagogical diagnostic summary',
                likelyIssue: 'Logic boundary issue',
                nextStep: 'Check loop boundary'
              })
            }
          };
        }
      })
    };

    const customSvc = new GeminiService({ client: capturingClient });
    const subRow = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
    const publicTests = db.prepare('SELECT * FROM test_results WHERE submission_id = ? AND is_public = 1').all(submissionId);

    await customSvc.generateSubmissionFeedback({
      code: subRow.code,
      language: subRow.language,
      challengeTitle: 'Find Largest',
      challengeDescription: 'Return largest number',
      executionResults: {
        status: 'wrong_output',
        passCount: subRow.pass_count,
        failCount: subRow.fail_count,
        testResults: publicTests
      }
    });

    for (const hc of hiddenCases) {
      if (hc.stdin) {
        assert.equal(capturedPrompt.includes(hc.stdin), false, `Hidden stdin "${hc.stdin}" was leaked to prompt!`);
      }
      if (hc.expected_output) {
        assert.equal(capturedPrompt.includes(hc.expected_output), false, `Hidden output "${hc.expected_output}" was leaked to prompt!`);
      }
    }
  });

  it('Checklist 7: If Gemini fails, the original test results remain correct', async () => {
    const failingClient = {
      getGenerativeModel: () => ({
        generateContent: async () => {
          throw new Error('503 Service Unavailable / Rate Limit');
        }
      })
    };

    const failingService = new GeminiService({ client: failingClient });
    const feedback = await failingService.generateSubmissionFeedback({
      code: 'function test() {}',
      language: 'javascript',
      executionResults: {
        status: 'wrong_output',
        passCount: 3,
        failCount: 2,
        totalTests: 5
      }
    });

    assert.equal(feedback.isFallback, true);
    assert.ok(feedback.summary);
    assert.ok(feedback.likelyIssue);
    assert.ok(feedback.nextStep);
  });

  it('Checklist 8: Live API check reports healthy connectivity', async () => {
    const check = await geminiService.testConnection();
    if (geminiService.isConfigured()) {
      assert.equal(check.ok, true);
      assert.equal(check.status, 'healthy');
      assert.ok(check.latencyMs > 0);
    } else {
      assert.equal(check.status, 'unconfigured');
    }
  });
});
