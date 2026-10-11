import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapJudgeStatus,
  normalizeOutput,
  prepareJavaCode,
  executeSubmission,
  executeMockSubmission,
  isRunnerConfigured,
  STATUS
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

    test('maps status 13 and unknown to internal_error', () => {
      assert.strictEqual(mapJudgeStatus(13), STATUS.INTERNAL_ERROR);
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
  });

  describe('normalizeOutput', () => {
    test('normalizes windows line endings and trailing whitespace', () => {
      assert.strictEqual(normalizeOutput('hello\r\n\r\n'), 'hello');
      assert.strictEqual(normalizeOutput('9\n'), '9');
      assert.strictEqual(normalizeOutput('   test   \n'), '   test');
    });
  });

  describe('Task 2 Acceptance Criteria: Correct vs Incorrect Code Execution', () => {
    test('returns { status: passed } for correct Hello World code', async () => {
      // Correct Hello World submission
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

    test('returns { status: wrong_output } for incorrect output', async () => {
      // Incorrect Hello World submission
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

    test('returns { status: compile_error } for syntax error', async () => {
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

    test('returns { status: timeout } for timed out code', async () => {
      const result = await executeMockSubmission({
        language: 'javascript',
        code: 'while (true) {} // timeout_test',
        stdin: '',
        expectedOutput: 'Hello World\n'
      });

      assert.strictEqual(result.status, STATUS.TIMEOUT);
      assert.strictEqual(result.judgeStatusId, 5);
    });

    test('returns { status: runtime_error } for thrown exception', async () => {
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
  });

  describe('Unconfigured Runner Protection (API_CONTRACT.md compliance)', () => {
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
  });
});
