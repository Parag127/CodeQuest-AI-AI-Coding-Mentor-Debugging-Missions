import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import db from '../db/index.js';
import { initDb } from '../db/init.js';
import submissionsRouter from '../routes/submissions.js';

describe('POST /api/submissions Route Tests', () => {
  let app;
  let server;
  let baseUrl;

  before(async () => {
    initDb();

    app = express();
    app.use(express.json());
    app.use('/api/submissions', submissionsRouter);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  describe('Validation & Security Guards', () => {
    test('returns 503 RUNNER_NOT_CONFIGURED when no runner is configured', async () => {
      const prevUrl = process.env.JUDGE0_API_URL;
      const prevMock = process.env.JUDGE0_MOCK_RUNNER;
      delete process.env.JUDGE0_API_URL;
      delete process.env.JUDGE0_MOCK_RUNNER;

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: 'console.log(1);'
        })
      });

      assert.strictEqual(res.status, 503);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'RUNNER_NOT_CONFIGURED');
      assert.strictEqual(body.error?.message, 'Code execution is not configured. The submission was not executed.');

      if (prevUrl) process.env.JUDGE0_API_URL = prevUrl;
      if (prevMock) process.env.JUDGE0_MOCK_RUNNER = prevMock;
    });

    test('returns 400 for missing challengeId', async () => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'javascript',
          code: 'console.log(1);'
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'INVALID_CHALLENGE_ID');
    });

    test('returns 404 for non-existent challengeId', async () => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'unknown-challenge',
          language: 'javascript',
          code: 'console.log(1);'
        })
      });

      assert.strictEqual(res.status, 404);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'CHALLENGE_NOT_FOUND');
    });

    test('returns 400 for unsupported language', async () => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'python',
          code: 'print(1)'
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'INVALID_LANGUAGE');
    });

    test('returns 400 for empty code', async () => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: '   '
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'INVALID_CODE');
    });

    test('returns 413 for code exceeding 64 KB limit', async () => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';

      const oversizedCode = 'a'.repeat(70000);
      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: oversizedCode
        })
      });

      assert.strictEqual(res.status, 413);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'PAYLOAD_TOO_LARGE');
    });
  });

  describe('Execution, Results Shaping & Strict Hidden Test Privacy', () => {
    before(() => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';
    });

    test('evaluates buggy submission, generates feedback, and protects hidden tests', async () => {
      const challenge = db.prepare('SELECT starter_code_javascript FROM challenges WHERE id = ?').get('largest-number');
      const buggyCode = challenge.starter_code_javascript;

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Learner-Id': 'test-learner-1'
        },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: buggyCode,
          prediction: 'The loop visits all array elements.',
          explanation: 'I think the loop ends after the last index.'
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.ok(body.submissionId, 'submissionId missing');
      assert.strictEqual(body.status, 'failed');
      assert.ok(Array.isArray(body.results));
      assert.strictEqual(body.results.length, 5); // 3 visible + 2 hidden

      // Visible tests shape
      const visibleResults = body.results.filter(r => r.visibility === 'visible');
      assert.strictEqual(visibleResults.length, 3);
      for (const vr of visibleResults) {
        assert.ok(vr.testId);
        assert.strictEqual(vr.visibility, 'visible');
        assert.ok(vr.status);
        assert.ok(vr.expected !== undefined);
        assert.ok(vr.actual !== undefined);
      }

      // Hidden tests shape (STRICT PRIVACY: opaque testId, visibility: "hidden", status ONLY)
      const hiddenResults = body.results.filter(r => r.visibility === 'hidden');
      assert.strictEqual(hiddenResults.length, 2);
      for (const hr of hiddenResults) {
        assert.ok(hr.testId);
        assert.strictEqual(hr.visibility, 'hidden');
        assert.ok(hr.status);
        assert.strictEqual(hr.expected, undefined, 'Hidden test MUST NOT include expected output');
        assert.strictEqual(hr.actual, undefined, 'Hidden test MUST NOT include actual output');
        assert.strictEqual(hr.stdin, undefined, 'Hidden test MUST NOT include stdin');
        assert.strictEqual(hr.stdout, undefined, 'Hidden test MUST NOT include stdout');
        assert.strictEqual(hr.stderr, undefined, 'Hidden test MUST NOT include stderr');
      }

      // Bug Fingerprint feedback
      assert.ok(body.feedback);
      assert.strictEqual(body.feedback.bugCategory, 'loop_boundary');
      assert.ok(body.feedback.summary.includes('loop'));
      assert.strictEqual(body.feedback.hintLevelAvailable, 1);

      // Verify DB persistence
      const savedSubmission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(body.submissionId);
      assert.ok(savedSubmission);
      assert.strictEqual(savedSubmission.challenge_id, 'largest-number');
      assert.strictEqual(savedSubmission.learner_id, 'test-learner-1');
      assert.strictEqual(savedSubmission.status, 'failed');

      const savedResults = db.prepare('SELECT * FROM test_results WHERE submission_id = ?').all(body.submissionId);
      assert.strictEqual(savedResults.length, 5);

      const savedFingerprints = db.prepare('SELECT * FROM bug_fingerprints WHERE submission_id = ?').all(body.submissionId);
      assert.ok(savedFingerprints.length >= 1);
      assert.strictEqual(savedFingerprints[0].pattern_key, 'loop_boundary');
    });

    test('evaluates correct submission and marks status passed', async () => {
      // Fixed solution for largest-number
      const fixedCode = `
const fs = require('fs');
function findLargest(numbers) {
  let max = numbers[0];
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] > max) { max = numbers[i]; }
  }
  return max;
}
const input = fs.readFileSync(0, 'utf-8').trim();
if (input.length > 0) {
  const lines = input.split('\\n');
  const numbers = (lines[1] || lines[0]).trim().split(/\\s+/).map(Number);
  console.log(findLargest(numbers));
}
`;

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Learner-Id': 'test-learner-1'
        },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: fixedCode
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.status, 'passed');
      assert.strictEqual(body.feedback, null);

      // Verify all tests passed
      for (const r of body.results) {
        assert.strictEqual(r.status, 'passed');
      }

      // Verify learner progress updated
      const progress = db.prepare('SELECT * FROM learner_progress WHERE learner_id = ? AND challenge_id = ?').get(
        'test-learner-1',
        'largest-number'
      );
      assert.ok(progress);
      assert.strictEqual(progress.solved, 1);
      assert.ok(progress.attempts >= 2);
    });
  });

  after(() => {
    if (server) server.close();
  });
});
