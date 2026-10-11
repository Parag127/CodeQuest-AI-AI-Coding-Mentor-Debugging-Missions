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

    test('returns 400 for malformed non-object JSON body (e.g. array)', async () => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(['not-an-object'])
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'INVALID_REQUEST');
      assert.strictEqual(body.error?.message, 'Request body must be a valid JSON object');
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

    test('returns 400 for platform-unsupported language (e.g. python)', async () => {
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

    test('returns 400 UNSUPPORTED_LANGUAGE when requested language is not supported by challenge', async () => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';

      const original = db.prepare('SELECT languages FROM challenges WHERE id = ?').get('largest-number');
      db.prepare('UPDATE challenges SET languages = ? WHERE id = ?').run('["javascript"]', 'largest-number');

      try {
        const res = await fetch(`${baseUrl}/api/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: 'largest-number',
            language: 'java',
            code: 'public class Main { public static void main(String[] args) {} }'
          })
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'UNSUPPORTED_LANGUAGE');
        assert.ok(body.error?.message.includes('not supported for challenge'));
      } finally {
        db.prepare('UPDATE challenges SET languages = ? WHERE id = ?').run(original.languages, 'largest-number');
      }
    });

    test('returns 400 for non-string code (e.g. numeric)', async () => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: 12345
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error?.code, 'INVALID_CODE');
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

  describe('Execution Scenarios: Java, JavaScript, Wrong Output, Errors & Privacy', () => {
    before(() => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';
    });

    test('1. Successful Java submission: passes all tests and returns status passed', async () => {
      const javaCorrectCode = `
import java.util.Scanner;

public class Main {
    public static int findLargest(int[] numbers) {
        int max = numbers[0];
        for (int i = 1; i < numbers.length; i++) {
            if (numbers[i] > max) {
                max = numbers[i];
            }
        }
        return max;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int n = scanner.nextInt();
            int[] numbers = new int[n];
            for (int i = 0; i < n; i++) {
                numbers[i] = scanner.nextInt();
            }
            System.out.println(findLargest(numbers));
        }
    }
}
`;

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Learner-Id': 'java-learner'
        },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'java',
          code: javaCorrectCode
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.status, 'passed');
      assert.strictEqual(body.feedback, null);
      assert.strictEqual(body.results.length, 5);

      for (const r of body.results) {
        assert.strictEqual(r.status, 'passed');
      }

      // Check DB record
      const saved = db.prepare('SELECT * FROM submissions WHERE id = ?').get(body.submissionId);
      assert.ok(saved);
      assert.strictEqual(saved.language, 'java');
      assert.strictEqual(saved.pass_count, 5);
      assert.strictEqual(saved.fail_count, 0);
      assert.strictEqual(saved.status, 'passed');
    });

    test('2. Successful JavaScript submission: passes all tests and returns status passed', async () => {
      const jsCorrectCode = `
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
          'X-Learner-Id': 'js-learner'
        },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: jsCorrectCode
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.status, 'passed');
      assert.strictEqual(body.feedback, null);
      assert.strictEqual(body.results.length, 5);

      for (const r of body.results) {
        assert.strictEqual(r.status, 'passed');
      }
    });

    test('3. Wrong output: reports failure, visible tests show expected and actual', async () => {
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

      assert.ok(body.submissionId);
      assert.strictEqual(body.status, 'failed');
      assert.ok(Array.isArray(body.results));
      assert.strictEqual(body.results.length, 5);

      // Visible tests include expected and actual
      const wrongResults = body.results.filter(r => r.status === 'wrong_output' && r.visibility === 'visible');
      assert.ok(wrongResults.length >= 1);
      for (const wr of wrongResults) {
        assert.ok(wr.expected !== undefined);
        assert.ok(wr.actual !== undefined);
      }

      // Feedback is populated
      assert.ok(body.feedback);
      assert.strictEqual(body.feedback.bugCategory, 'loop_boundary');
    });

    test('4. Java compilation error: reports compile_error and cascades to remaining tests', async () => {
      const javaBrokenCode = `
public class Main {
    public static void main(String[] args) {
        syntax_error_test
    }
}
`;

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'java',
          code: javaBrokenCode
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.status, 'failed');
      assert.strictEqual(body.results.length, 5);

      for (const r of body.results) {
        assert.strictEqual(r.status, 'compile_error');
      }
    });

    test('5. Runtime error: reports runtime_error on thrown exception', async () => {
      const runtimeErrorCode = `
const fs = require('fs');
function findLargest(numbers) {
  runtime_error_test;
  throw new Error("Simulated array index out of bounds");
}
`;

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: runtimeErrorCode
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.status, 'failed');
      assert.strictEqual(body.results.length, 5);

      for (const r of body.results) {
        assert.strictEqual(r.status, 'runtime_error');
      }
    });

    test('6. Timeout: reports timeout status on long-running code', async () => {
      const timeoutCode = `
const fs = require('fs');
function findLargest(numbers) {
  timeout_test;
  while(true) {}
}
`;

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: timeoutCode
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.status, 'failed');
      assert.strictEqual(body.results.length, 5);

      for (const r of body.results) {
        assert.strictEqual(r.status, 'timeout');
      }
    });

    test('7. Execution-provider failure: returns 503 without crashing the API server', async () => {
      // Temporarily simulate provider unreachable by pointing to a dead port
      const prevUrl = process.env.JUDGE0_API_URL;
      const prevMock = process.env.JUDGE0_MOCK_RUNNER;

      delete process.env.JUDGE0_MOCK_RUNNER;
      process.env.JUDGE0_API_URL = 'http://127.0.0.1:59999'; // Dead port

      try {
        const res = await fetch(`${baseUrl}/api/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: 'largest-number',
            language: 'javascript',
            code: 'console.log("hello");'
          })
        });

        assert.strictEqual(res.status, 503);
        const body = await res.json();
        assert.strictEqual(body.error?.code, 'RUNNER_UNAVAILABLE');
        assert.ok(body.error?.message);

        // Verify the server is still healthy and did not crash
        process.env.JUDGE0_MOCK_RUNNER = 'true';
        const healthCheck = await fetch(`${baseUrl}/api/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: 'largest-number',
            language: 'javascript',
            code: 'console.log("recovery");'
          })
        });
        assert.strictEqual(healthCheck.status, 200);
      } finally {
        if (prevUrl) process.env.JUDGE0_API_URL = prevUrl;
        else delete process.env.JUDGE0_API_URL;
        if (prevMock) process.env.JUDGE0_MOCK_RUNNER = prevMock;
        else delete process.env.JUDGE0_MOCK_RUNNER;
      }
    });

    test('8. Attempted hidden-test disclosure: strictly zero leak of hidden inputs or expected outputs', async () => {
      process.env.JUDGE0_MOCK_RUNNER = 'true';

      // Load the actual hidden tests from SQLite to know what values must NEVER appear
      const hiddenTestCases = db.prepare(`
        SELECT stdin, expected_output FROM test_cases WHERE challenge_id = ? AND is_public = 0
      `).all('largest-number');

      assert.ok(hiddenTestCases.length > 0, 'No hidden test cases found in DB to test');

      const challenge = db.prepare('SELECT starter_code_javascript FROM challenges WHERE id = ?').get('largest-number');
      const buggyCode = challenge.starter_code_javascript;

      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'largest-number',
          language: 'javascript',
          code: buggyCode
        })
      });

      assert.strictEqual(res.status, 200);
      const rawText = await res.text();
      const body = JSON.parse(rawText);

      // Verify serialized JSON string does not disclose ANY hidden input or expected output
      for (const htc of hiddenTestCases) {
        if (htc.stdin && htc.stdin.trim().length > 0) {
          assert.strictEqual(
            rawText.includes(htc.stdin.trim()),
            false,
            `Hidden test stdin leaked in response: ${htc.stdin}`
          );
        }
        if (htc.expected_output && htc.expected_output.trim().length > 0) {
          // Check that expected_output is not associated with hidden test results
          const hiddenResults = body.results.filter(r => r.visibility === 'hidden');
          for (const hr of hiddenResults) {
            assert.strictEqual(hr.expected, undefined, 'Hidden test must NOT contain expected');
            assert.strictEqual(hr.actual, undefined, 'Hidden test must NOT contain actual');
            assert.strictEqual(hr.stdin, undefined, 'Hidden test must NOT contain stdin');
            assert.strictEqual(hr.stdout, undefined, 'Hidden test must NOT contain stdout');
            assert.strictEqual(hr.stderr, undefined, 'Hidden test must NOT contain stderr');
            
            // Strictly check allowed keys on hidden test objects
            const allowedKeys = ['testId', 'visibility', 'status'];
            const actualKeys = Object.keys(hr).sort();
            assert.deepStrictEqual(actualKeys, allowedKeys.sort());
          }
        }
      }
    });
  });

  after(() => {
    try {
      db.prepare("DELETE FROM test_cases WHERE challenge_id = 'js-only-challenge'").run();
      db.prepare("DELETE FROM challenges WHERE id = 'js-only-challenge'").run();
    } catch {}
    if (server) server.close();
  });
});
