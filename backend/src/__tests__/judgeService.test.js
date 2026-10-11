import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapJudgeStatus,
  normalizeOutput,
  prepareJavaCode,
  executeSubmission,
  executeMockSubmission,
  isRunnerConfigured,
  buildJudgeHeaders,
  pollSubmissionResult,
  STATUS,
  LANGUAGE_IDS
} from '../services/judgeService.js';

describe('Judge0 Service & Status Mapping Tests', () => {

  describe('mapJudgeStatus', () => {
    test('maps status 3 to passed', () => {
      assert.strictEqual(mapJudgeStatus(3), STATUS.PASSED);
    });

    test('maps status 4 to wrong_output', () => {
      assert.strictEqual(mapJudgeStatus(4), STATUS.WRONG_OUTPUT);
    });

    test('maps status 5 to timeout', () => {
      assert.strictEqual(mapJudgeStatus(5), STATUS.TIMEOUT);
    });

    test('maps status 6 to compile_error', () => {
      assert.strictEqual(mapJudgeStatus(6), STATUS.COMPILE_ERROR);
    });

    test('maps statuses 7 through 12 to runtime_error', () => {
      for (let id = 7; id <= 12; id++) {
        assert.strictEqual(mapJudgeStatus(id), STATUS.RUNTIME_ERROR, `Failed for status id ${id}`);
      }
    });

    test('maps status 13, 14, and unknown to internal_error', () => {
      assert.strictEqual(mapJudgeStatus(13), STATUS.INTERNAL_ERROR);
      assert.strictEqual(mapJudgeStatus(14), STATUS.INTERNAL_ERROR);
      assert.strictEqual(mapJudgeStatus(999), STATUS.INTERNAL_ERROR);
    });
  });

  describe('prepareJavaCode', () => {
    test('renames public class to Main', () => {
      const code = 'public class Solution { public static void main(String[] args) {} }';
      const prepared = prepareJavaCode(code);
      assert.ok(prepared.includes('public class Main'));
      assert.ok(!prepared.includes('public class Solution'));
    });

    test('wraps class body without class declaration into Main', () => {
      const body = 'public static void main(String[] args) { System.out.println("Hi"); }';
      const prepared = prepareJavaCode(body);
      assert.ok(prepared.includes('public class Main'));
      assert.ok(prepared.includes('import java.util.*;'));
    });

    test('handles empty code safely', () => {
      assert.strictEqual(prepareJavaCode(''), '');
      assert.strictEqual(prepareJavaCode(null), '');
    });
  });

  describe('normalizeOutput', () => {
    test('normalizes windows line endings and trailing whitespace', () => {
      assert.strictEqual(normalizeOutput('hello\r\n\r\n'), 'hello');
      assert.strictEqual(normalizeOutput('9\n'), '9');
      assert.strictEqual(normalizeOutput('   test   \n'), '   test');
      assert.strictEqual(normalizeOutput(null), '');
    });
  });

  describe('buildJudgeHeaders', () => {
    test('builds RapidAPI headers when JUDGE0_API_KEY is present', () => {
      const prevKey = process.env.JUDGE0_API_KEY;
      const prevHost = process.env.JUDGE0_API_HOST;

      process.env.JUDGE0_API_KEY = 'test-rapidapi-key';
      process.env.JUDGE0_API_HOST = 'custom-host.p.rapidapi.com';

      const headers = buildJudgeHeaders();
      assert.strictEqual(headers['Content-Type'], 'application/json');
      assert.strictEqual(headers['X-RapidAPI-Key'], 'test-rapidapi-key');
      assert.strictEqual(headers['X-RapidAPI-Host'], 'custom-host.p.rapidapi.com');

      if (prevKey) process.env.JUDGE0_API_KEY = prevKey; else delete process.env.JUDGE0_API_KEY;
      if (prevHost) process.env.JUDGE0_API_HOST = prevHost; else delete process.env.JUDGE0_API_HOST;
    });

    test('builds Self-hosted headers when JUDGE0_AUTH_TOKEN is present', () => {
      const prevToken = process.env.JUDGE0_AUTH_TOKEN;
      process.env.JUDGE0_AUTH_TOKEN = 'secret-auth-token';

      const headers = buildJudgeHeaders();
      assert.strictEqual(headers['X-Auth-Token'], 'secret-auth-token');

      if (prevToken) process.env.JUDGE0_AUTH_TOKEN = prevToken; else delete process.env.JUDGE0_AUTH_TOKEN;
    });
  });

  describe('Asynchronous Polling (pollSubmissionResult)', () => {
    test('polls until submission status reaches terminal accepted state', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;

      // Mock fetch: returns status 1 (In Queue), then status 2 (Processing), then status 3 (Accepted)
      globalThis.fetch = async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: { id: 1, description: 'In Queue' } })
          };
        } else if (callCount === 2) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: { id: 2, description: 'Processing' } })
          };
        } else {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: { id: 3, description: 'Accepted' },
              stdout: '42\n',
              time: '0.045',
              memory: 2048
            })
          };
        }
      };

      try {
        const result = await pollSubmissionResult('http://judge0.internal', 'fake-token-123', {}, 5000, 50);
        assert.strictEqual(callCount, 3);
        assert.strictEqual(result.status.id, 3);
        assert.strictEqual(result.stdout, '42\n');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('throws RUNNER_RATE_LIMITED if poll returns 429', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      });

      try {
        await assert.rejects(
          async () => {
            await pollSubmissionResult('http://judge0.internal', 'fake-token-123', {}, 2000, 20);
          },
          (err) => {
            assert.strictEqual(err.code, 'RUNNER_RATE_LIMITED');
            assert.strictEqual(err.statusCode, 429);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('returns timeout result when polling exceeds maxWaitMs', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: { id: 2, description: 'Processing' } })
      });

      try {
        const result = await pollSubmissionResult('http://judge0.internal', 'fake-token-123', {}, 150, 40);
        assert.strictEqual(result.status.id, 5);
        assert.ok(result.stderr.includes('timed out'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Live Provider Mocking & Error Scenarios (executeSubmission)', () => {
    test('throws RUNNER_AUTH_ERROR on HTTP 401 or 403', async () => {
      const prevUrl = process.env.JUDGE0_API_URL;
      const prevMock = process.env.JUDGE0_MOCK_RUNNER;
      process.env.JUDGE0_API_URL = 'http://judge0.mock';
      delete process.env.JUDGE0_MOCK_RUNNER;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      try {
        await assert.rejects(
          async () => {
            await executeSubmission({
              language: 'javascript',
              code: 'console.log(1);'
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'RUNNER_AUTH_ERROR');
            assert.strictEqual(err.statusCode, 503);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
        if (prevUrl) process.env.JUDGE0_API_URL = prevUrl; else delete process.env.JUDGE0_API_URL;
        if (prevMock) process.env.JUDGE0_MOCK_RUNNER = prevMock;
      }
    });

    test('throws RUNNER_RATE_LIMITED on HTTP 429', async () => {
      const prevUrl = process.env.JUDGE0_API_URL;
      const prevMock = process.env.JUDGE0_MOCK_RUNNER;
      process.env.JUDGE0_API_URL = 'http://judge0.mock';
      delete process.env.JUDGE0_MOCK_RUNNER;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: false,
        status: 429,
        text: async () => 'Too Many Requests'
      });

      try {
        await assert.rejects(
          async () => {
            await executeSubmission({
              language: 'javascript',
              code: 'console.log(1);'
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'RUNNER_RATE_LIMITED');
            assert.strictEqual(err.statusCode, 429);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
        if (prevUrl) process.env.JUDGE0_API_URL = prevUrl; else delete process.env.JUDGE0_API_URL;
        if (prevMock) process.env.JUDGE0_MOCK_RUNNER = prevMock;
      }
    });

    test('throws RUNNER_UNAVAILABLE on fetch network rejection', async () => {
      const prevUrl = process.env.JUDGE0_API_URL;
      const prevMock = process.env.JUDGE0_MOCK_RUNNER;
      process.env.JUDGE0_API_URL = 'http://judge0.mock';
      delete process.env.JUDGE0_MOCK_RUNNER;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new Error('ECONNREFUSED');
      };

      try {
        await assert.rejects(
          async () => {
            await executeSubmission({
              language: 'javascript',
              code: 'console.log(1);'
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'RUNNER_UNAVAILABLE');
            assert.strictEqual(err.statusCode, 503);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
        if (prevUrl) process.env.JUDGE0_API_URL = prevUrl; else delete process.env.JUDGE0_API_URL;
        if (prevMock) process.env.JUDGE0_MOCK_RUNNER = prevMock;
      }
    });

    test('throws RUNNER_MALFORMED_RESPONSE on invalid JSON from provider', async () => {
      const prevUrl = process.env.JUDGE0_API_URL;
      const prevMock = process.env.JUDGE0_MOCK_RUNNER;
      process.env.JUDGE0_API_URL = 'http://judge0.mock';
      delete process.env.JUDGE0_MOCK_RUNNER;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); }
      });

      try {
        await assert.rejects(
          async () => {
            await executeSubmission({
              language: 'javascript',
              code: 'console.log(1);'
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'RUNNER_MALFORMED_RESPONSE');
            assert.strictEqual(err.statusCode, 502);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
        if (prevUrl) process.env.JUDGE0_API_URL = prevUrl; else delete process.env.JUDGE0_API_URL;
        if (prevMock) process.env.JUDGE0_MOCK_RUNNER = prevMock;
      }
    });
  });

  describe('Task 2 & Milestone Acceptance Criteria: JavaScript & Java Simulation', () => {
    test('JavaScript: returns { status: passed } for correct Hello World code', async () => {
      const result = await executeMockSubmission({
        language: 'javascript',
        code: 'console.log("Hello World"); // hello_world_correct',
        stdin: '',
        expectedOutput: 'Hello World\n'
      });

      assert.strictEqual(result.status, STATUS.PASSED);
      assert.strictEqual(result.judgeStatusId, 3);
      assert.strictEqual(normalizeOutput(result.stdout), 'Hello World');
      assert.strictEqual(result.stderr, null);
    });

    test('JavaScript: returns { status: wrong_output } for incorrect output', async () => {
      const result = await executeMockSubmission({
        language: 'javascript',
        code: 'console.log("Goodbye World"); // hello_world_wrong',
        stdin: '',
        expectedOutput: 'Hello World\n'
      });

      assert.strictEqual(result.status, STATUS.WRONG_OUTPUT);
      assert.strictEqual(result.judgeStatusId, 4);
      assert.strictEqual(normalizeOutput(result.stdout), 'Goodbye World');
      assert.strictEqual(result.stderr, null);
    });

    test('JavaScript: returns { status: compile_error } for syntax error', async () => {
      const result = await executeMockSubmission({
        language: 'javascript',
        code: 'function broken() { syntax_error_test',
        stdin: '',
        expectedOutput: 'Hello World\n'
      });

      assert.strictEqual(result.status, STATUS.COMPILE_ERROR);
      assert.strictEqual(result.judgeStatusId, 6);
      assert.ok(result.stderr);
    });

    test('JavaScript: returns { status: timeout } for timed out code', async () => {
      const result = await executeMockSubmission({
        language: 'javascript',
        code: 'while (true) {} // timeout_test',
        stdin: '',
        expectedOutput: 'Hello World\n'
      });

      assert.strictEqual(result.status, STATUS.TIMEOUT);
      assert.strictEqual(result.judgeStatusId, 5);
    });

    test('JavaScript: returns { status: runtime_error } for thrown exception', async () => {
      const result = await executeMockSubmission({
        language: 'javascript',
        code: 'throw new Error("fail"); // runtime_error_test',
        stdin: '',
        expectedOutput: 'Hello World\n'
      });

      assert.strictEqual(result.status, STATUS.RUNTIME_ERROR);
      assert.strictEqual(result.judgeStatusId, 11);
      assert.ok(result.stderr);
    });

    test('Java: returns { status: passed } for correct output', async () => {
      const result = await executeMockSubmission({
        language: 'java',
        code: 'public class Main { public static void main(String[] args) { System.out.println("Hello World"); } } // hello_world_correct',
        stdin: '',
        expectedOutput: 'Hello World\n'
      });

      assert.strictEqual(result.status, STATUS.PASSED);
      assert.strictEqual(result.judgeStatusId, 3);
      assert.strictEqual(normalizeOutput(result.stdout), 'Hello World');
    });

    test('Java: returns { status: compile_error } for compilation error', async () => {
      const result = await executeMockSubmission({
        language: 'java',
        code: 'public class Main { syntax_error_test }',
        stdin: '',
        expectedOutput: 'Hello World\n'
      });

      assert.strictEqual(result.status, STATUS.COMPILE_ERROR);
      assert.strictEqual(result.judgeStatusId, 6);
      assert.ok(result.stderr.includes('Main.java'));
    });

    test('Java: returns { status: runtime_error } for NullPointerException', async () => {
      const result = await executeMockSubmission({
        language: 'java',
        code: 'public class Main { public static void main(String[] args) { throw new NullPointerException(); } }',
        stdin: '',
        expectedOutput: 'Hello World\n'
      });

      assert.strictEqual(result.status, STATUS.RUNTIME_ERROR);
      assert.strictEqual(result.judgeStatusId, 11);
      assert.ok(result.stderr.includes('NullPointerException'));
    });
  });

  describe('Unconfigured Runner Protection (API_CONTRACT.md & SECURITY.md compliance)', () => {
    test('throws RUNNER_NOT_CONFIGURED error with status 503 when no runner is active', async () => {
      const originalUrl = process.env.JUDGE0_API_URL;
      const originalMock = process.env.JUDGE0_MOCK_RUNNER;

      delete process.env.JUDGE0_API_URL;
      delete process.env.JUDGE0_MOCK_RUNNER;

      assert.strictEqual(isRunnerConfigured(), false);

      await assert.rejects(
        async () => {
          await executeSubmission({
            language: 'javascript',
            code: 'console.log(1);'
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'RUNNER_NOT_CONFIGURED');
          assert.strictEqual(err.statusCode, 503);
          return true;
        }
      );

      // Restore
      if (originalUrl) process.env.JUDGE0_API_URL = originalUrl;
      if (originalMock) process.env.JUDGE0_MOCK_RUNNER = originalMock;
    });

    test('rejects invalid language', async () => {
      await assert.rejects(
        async () => {
          await executeSubmission({
            language: 'python',
            code: 'print(1)'
          });
        },
        /Unsupported language/
      );
    });

    test('rejects empty code', async () => {
      await assert.rejects(
        async () => {
          await executeSubmission({
            language: 'javascript',
            code: ''
          });
        },
        /Code must be a non-empty string/
      );
    });
  });
});
