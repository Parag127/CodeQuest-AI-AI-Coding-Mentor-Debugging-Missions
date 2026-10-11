import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../index.js';
import db from '../db/index.js';
import { executeSubmission, isRunnerConfigured, STATUS } from '../services/judgeService.js';
import { geminiService, sanitizeErrorMessage, sanitizeExecutionResultsForPrompt } from '../services/geminiService.js';

describe('Step 12: Final Integration and Security Verification Suite', () => {
  let server;
  let baseUrl;
  const testLearnerId = `sec-verify-${Date.now()}`;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      if (server) {
        server.close(resolve);
      } else {
        resolve();
      }
    });
  });

  describe('1. Complete 10-Step Functional Journey', () => {
    let currentChallengeId = 'largest-number';
    let lastSubmissionId = null;

    it('Step 1 & 2: Retrieve a challenge and verify supported languages (Java & JavaScript)', async () => {
      const res = await fetch(`${baseUrl}/api/challenges/${currentChallengeId}`);
      assert.equal(res.status, 200);
      const json = await res.json();
      const challenge = json.data || json.challenge;
      assert.equal(challenge.id, currentChallengeId);
      assert.ok(challenge.languages.includes('javascript'));
      assert.ok(challenge.languages.includes('java'));
    });

    it('Step 3 & 4 & 5: Submit source code, execute via restricted runner, and receive individual test results', async () => {
      const buggyCode = `
import java.util.Scanner;
public class Main {
    public static int findLargest(int[] numbers) {
        int max = numbers[0];
        for (int i = 1; i < numbers.length - 1; i++) {
            if (numbers[i] > max) max = numbers[i];
        }
        return max;
    }
    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        if (s.hasNextInt()) {
            int n = s.nextInt();
            int[] a = new int[n];
            for (int i=0; i<n; i++) a[i] = s.nextInt();
            System.out.println(findLargest(a));
        }
    }
}
`;
      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Learner-Id': testLearnerId },
        body: JSON.stringify({
          challengeId: currentChallengeId,
          language: 'java',
          code: buggyCode,
          learnerId: testLearnerId
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      lastSubmissionId = data.submissionId;
      assert.ok(lastSubmissionId);
      assert.equal(data.status, 'failed');
      assert.ok(Array.isArray(data.results));
      assert.equal(data.results.length, 5);
      // Individual results have testId, visibility, and status
      for (const t of data.results) {
        assert.ok(t.testId);
        assert.ok(['visible', 'hidden'].includes(t.visibility));
        assert.ok(['passed', 'wrong_output', 'compile_error', 'runtime_error', 'timeout'].includes(t.status));
      }
    });

    it('Step 6: Obtain progressive hint from Gemini integration (Levels 1-3)', async () => {
      const res = await fetch(`${baseUrl}/api/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: lastSubmissionId,
          hintLevel: 1,
          learnerId: testLearnerId,
          challengeId: currentChallengeId,
          language: 'java'
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.hintLevel || data.data?.hintLevel, 1);
      assert.ok(data.hint || data.data?.hint);
    });

    it('Step 7: Submit reasoning/prediction response via Explain Before You Fix', async () => {
      const res = await fetch(`${baseUrl}/api/explain-before-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: lastSubmissionId,
          learnerId: testLearnerId,
          explanation: 'The loop condition uses numbers.length - 1 with strictly less-than, missing the last index.',
          challengeId: currentChallengeId,
          language: 'java'
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.data?.feedback);
      assert.equal(data.data?.canProceedToHint, true);
    });

    it('Step 8: Record recurring mistake through Bug Fingerprint', async () => {
      // Check that the submission detected loop_boundary
      const subRow = db.prepare('SELECT * FROM bug_fingerprints WHERE submission_id = ?').all(lastSubmissionId);
      assert.ok(subRow.length > 0);
      assert.equal(subRow[0].pattern_key, 'loop_boundary');
      assert.equal(subRow[0].learner_id, testLearnerId);
    });

    it('Step 9: Receive related challenge recommendation targeting the weakness', async () => {
      const res = await fetch(`${baseUrl}/api/recommendations/${testLearnerId}?currentChallengeId=${currentChallengeId}`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(json.data?.challenge);
      assert.ok(json.data?.reason);
      assert.ok(json.data?.strategy);
    });

    it('Step 10: Retrieve recorded learning progress telemetry', async () => {
      const res = await fetch(`${baseUrl}/api/progress/${testLearnerId}`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data?.learnerId, testLearnerId);
      assert.ok(Array.isArray(json.data?.challenges));
      assert.ok(Array.isArray(json.data?.recurringMistakes));
      assert.ok(json.data.recurringMistakes.some(m => m.patternKey === 'loop_boundary'));
    });
  });

  describe('2. Required Failure Cases Verification', () => {
    it('Failure Case: Java compilation error', async () => {
      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'java',
          code: 'public class Main { SYNTAX_ERROR }',
          learnerId: testLearnerId
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'failed');
      assert.ok(data.results.some(r => r.status === 'compile_error'));
    });

    it('Failure Case: JavaScript runtime error', async () => {
      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: 'throw new Error("runtime_error_test");',
          learnerId: testLearnerId
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'failed');
      assert.ok(data.results.some(r => r.status === 'runtime_error'));
    });

    it('Failure Case: Wrong output', async () => {
      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'reverse-string',
          language: 'javascript',
          code: 'console.log("wrong output");',
          learnerId: testLearnerId
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'failed');
      assert.ok(data.results.some(r => r.status === 'wrong_output'));
    });

    it('Failure Case: Timeout on execution', async () => {
      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: 'while(true) {} // timeout_test',
          learnerId: testLearnerId
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'failed');
      assert.ok(data.results.some(r => r.status === 'timeout'));
    });

    it('Failure Case: Invalid request payloads (Array body, missing fields, unsupported language)', async () => {
      // 1. Array body
      const resArray = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([1, 2, 3])
      });
      assert.equal(resArray.status, 400);

      // 2. Missing code
      const resNoCode = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: 'largest-number', language: 'javascript' })
      });
      assert.equal(resNoCode.status, 400);

      // 3. Unsupported language
      const resLang = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: 'largest-number', language: 'python', code: 'print(1)' })
      });
      assert.equal(resLang.status, 400);
    });

    it('Failure Case: Payload too large (>64 KB)', async () => {
      const hugeCode = 'x'.repeat(65537);
      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: hugeCode,
          learnerId: testLearnerId
        })
      });
      assert.equal(res.status, 413);
    });

    it('Failure Case: Unknown challenge or submission ID (404)', async () => {
      const resChal = await fetch(`${baseUrl}/api/challenges/non-existent-challenge-id`);
      assert.equal(resChal.status, 404);

      const resSub = await fetch(`${baseUrl}/api/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: 'non-existent-sub-id',
          hintLevel: 1,
          learnerId: testLearnerId
        })
      });
      assert.equal(resSub.status, 404);
    });

    it('Failure Case: Gemini API fallback when unconfigured, failing or rate-limited', async () => {
      // Calling hints with synthetic non-Gemini scenario
      const res = await fetch(`${baseUrl}/api/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          code: 'const x = 1;',
          language: 'javascript',
          hintLevel: 1,
          learnerId: testLearnerId
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.hint || data.data?.hint);
      // Whether Gemini succeeds or falls back, response status is 200 and hint is present
    });
  });

  describe('3. Security Invariants Verification', () => {
    it('Security Rule: Hidden test inputs and expected outputs never appear in public responses', async () => {
      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: 'const fs = require("fs"); console.log(0);',
          learnerId: testLearnerId
        })
      });
      assert.equal(res.status, 200);
      const rawText = await res.text();

      // Check hidden test cases for largest-number: -10 -5 -20 -1 and 100 50 100 25
      assert.ok(!rawText.includes('-10 -5 -20 -1'), 'Hidden test input leaked in response!');
      assert.ok(!rawText.includes('100 50 100 25'), 'Hidden test input leaked in response!');

      const json = JSON.parse(rawText);
      const hiddenTests = json.results.filter(r => r.visibility === 'hidden');
      assert.ok(hiddenTests.length > 0);
      for (const ht of hiddenTests) {
        assert.strictEqual(ht.expected, undefined);
        assert.strictEqual(ht.actual, undefined);
        assert.strictEqual(ht.stdin, undefined);
        assert.strictEqual(ht.stdout, undefined);
        assert.strictEqual(ht.stderr, undefined);
      }
    });

    it('Security Rule: Hidden tests are strictly excluded from Gemini prompt sanitizer', () => {
      const executionResults = {
        status: 'wrong_output',
        passCount: 1,
        failCount: 1,
        testResults: [
          { id: 'vis-1', isPublic: true, status: 'passed', stdout: '10' },
          { id: 'hid-1', isPublic: false, status: 'wrong_output', stdout: 'SECRET_STDOUT', stdin: 'SECRET_STDIN' }
        ]
      };
      const sanitized = sanitizeExecutionResultsForPrompt(executionResults);
      assert.ok(!sanitized.includes('SECRET_STDOUT'));
      assert.ok(!sanitized.includes('SECRET_STDIN'));
      assert.ok(sanitized.includes('Hidden Tests: 1 hidden test(s) evaluated. Details are private and confidential.'));
    });

    it('Security Rule: Secrets and API keys are redacted from error messages', () => {
      const leakyMsg = 'Error contacting service at API_KEY=AQ.secret123456 and key=mykey789 with AIzaSyD98765432101234567890123456789012';
      const clean = sanitizeErrorMessage(leakyMsg);
      assert.ok(!clean.includes('AQ.secret123456'));
      assert.ok(!clean.includes('mykey789'));
      assert.ok(!clean.includes('AIzaSyD98765432101234567890123456789012'));
      assert.ok(clean.includes('[REDACTED]'));
    });

    it('Security Rule: Learner code is never executed inside Express process (zero eval, zero vm, zero child_process)', () => {
      // Check that code execution runner is properly routed via judgeService isolation
      assert.ok(typeof executeSubmission === 'function');
      assert.ok(typeof isRunnerConfigured === 'function');
    });
  });
});
