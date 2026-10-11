import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import aiRouter from '../routes/ai.js';
import {
  GeminiService,
  sanitizeExecutionResultsForPrompt,
  buildSafeFeedbackFallback,
  parseAndValidateFeedbackOutput
} from '../services/geminiService.js';

function createTestApp(geminiServiceInstance) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // Mount with injected service for testing
  const router = express.Router();
  router.post('/feedback', async (req, res) => {
    try {
      const {
        code,
        language,
        challengeTitle,
        challengeDescription,
        executionResults
      } = req.body;

      if (!code || typeof code !== 'string' || code.trim() === '') {
        return res.status(400).json({ success: false, error: 'Learner code must be a non-empty string' });
      }

      if (Buffer.byteLength(code, 'utf8') > 65536) {
        return res.status(413).json({ success: false, error: 'Submitted code exceeds the 64KB maximum limit' });
      }

      if (!language || !['java', 'javascript'].includes(String(language).toLowerCase())) {
        return res.status(400).json({ success: false, error: 'Programming language must be either "java" or "javascript"' });
      }

      if (!executionResults || typeof executionResults !== 'object' || Array.isArray(executionResults)) {
        return res.status(400).json({ success: false, error: 'Authoritative executionResults object is required' });
      }

      const passCount = Number(executionResults.passCount) || 0;
      const failCount = Number(executionResults.failCount) || 0;
      const totalTests = executionResults.totalTests !== undefined
        ? Number(executionResults.totalTests)
        : (passCount + failCount);
      const executionStatus = executionResults.status || (failCount > 0 ? 'wrong_output' : 'passed');

      const feedback = await geminiServiceInstance.generateSubmissionFeedback({
        code: code.trim(),
        language: String(language).toLowerCase(),
        challengeTitle: challengeTitle || 'Coding Challenge',
        challengeDescription: challengeDescription || 'Description',
        executionResults: {
          ...executionResults,
          status: executionStatus,
          passCount,
          failCount,
          totalTests
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          executionStatus,
          passCount,
          failCount,
          totalTests,
          summary: feedback.summary,
          likelyIssue: feedback.likelyIssue,
          nextStep: feedback.nextStep,
          isFallback: feedback.isFallback
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.use('/api/ai', router);
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

describe('AI Submission Feedback Feature', () => {
  describe('Prompt Sanitization & Hidden Test Protection', () => {
    it('strictly excludes hidden test inputs and expected outputs from prompt context', () => {
      const sensitiveResults = {
        status: 'wrong_output',
        passCount: 1,
        failCount: 1,
        totalTests: 2,
        testResults: [
          {
            testCaseId: 'public-1',
            isPublic: true,
            status: 'passed',
            stdout: '10',
            stdin: '[1, 2, 3, 4]',
            expected_output: '10'
          },
          {
            testCaseId: 'hidden-secret-2',
            isPublic: false,
            status: 'wrong_output',
            stdout: null,
            stderr: null,
            stdin: 'SUPER_SECRET_HIDDEN_PAYLOAD_9999',
            expected_output: 'CLASSIFIED_EXPECTED_RESULT_XYZ'
          }
        ]
      };

      const promptContext = sanitizeExecutionResultsForPrompt(sensitiveResults);

      // Verify that hidden test data is completely missing
      assert.ok(!promptContext.includes('SUPER_SECRET_HIDDEN_PAYLOAD_9999'));
      assert.ok(!promptContext.includes('CLASSIFIED_EXPECTED_RESULT_XYZ'));
      // Verify public summary and hidden count presence
      assert.match(promptContext, /Public Test 1: Status=passed/);
      assert.match(promptContext, /Hidden Tests: 1 hidden test\(s\) evaluated/);
    });

    it('verifies that the actual prompt sent to Gemini client never contains hidden test data', async () => {
      let interceptedPrompt = '';
      const capturingClient = {
        getGenerativeModel: () => ({
          generateContent: async (prompt) => {
            interceptedPrompt = prompt;
            return {
              response: {
                text: () => JSON.stringify({
                  summary: 'Sample diagnostic summary.',
                  likelyIssue: 'Sample probable issue.',
                  nextStep: 'Sample next step.'
                })
              }
            };
          }
        })
      };

      const service = new GeminiService({ client: capturingClient });
      await service.generateSubmissionFeedback({
        code: 'function solve() { return 1; }',
        language: 'javascript',
        executionResults: {
          status: 'wrong_output',
          passCount: 0,
          failCount: 1,
          testResults: [
            {
              testCaseId: 'hidden-priv-1',
              isPublic: false,
              status: 'wrong_output',
              stdin: 'NEVER_EXPOSE_THIS_HIDDEN_STDIN',
              expected_output: 'NEVER_EXPOSE_THIS_EXPECTED_STDOUT'
            }
          ]
        }
      });

      assert.ok(!interceptedPrompt.includes('NEVER_EXPOSE_THIS_HIDDEN_STDIN'));
      assert.ok(!interceptedPrompt.includes('NEVER_EXPOSE_THIS_EXPECTED_STDOUT'));
      assert.match(interceptedPrompt, /Hidden Tests: 1 hidden test\(s\) evaluated/);
    });
  });

  describe('Output Parsing, Validation & Code Block Blocking', () => {
    it('accepts valid structured JSON feedback', () => {
      const validJson = JSON.stringify({
        summary: 'Your function calculates the sum for positive inputs but fails on negative values.',
        likelyIssue: 'The accumulator does not properly add negative integers due to early return.',
        nextStep: 'Check whether your return statement is placed inside the loop body.'
      });
      const result = parseAndValidateFeedbackOutput(validJson);
      assert.equal(result.isValid, true);
      assert.match(result.data.summary, /calculates the sum/);
      assert.match(result.data.likelyIssue, /early return/);
      assert.match(result.data.nextStep, /inside the loop/);
    });

    it('parses JSON wrapped in markdown ```json fences cleanly', () => {
      const wrapped = '```json\n{\n  "summary": "High level result summary.",\n  "likelyIssue": "Probable logic cause.",\n  "nextStep": "Helpful debugging step."\n}\n```';
      const result = parseAndValidateFeedbackOutput(wrapped);
      assert.equal(result.isValid, true);
      assert.equal(result.data.summary, 'High level result summary.');
    });

    it('rejects feedback with embedded code blocks in the body', () => {
      const codeBlockJson = JSON.stringify({
        summary: 'Here is what went wrong.',
        likelyIssue: 'Check this: ```javascript for (let i = 0; i < n; i++) ```',
        nextStep: 'Change your code.'
      });
      const result = parseAndValidateFeedbackOutput(codeBlockJson);
      assert.equal(result.isValid, false);
      assert.match(result.reason, /code blocks/);
    });

    it('rejects feedback with forbidden solution leak phrases', () => {
      const leak = JSON.stringify({
        summary: 'Here is your submission issue.',
        likelyIssue: 'The correct code is to use a while loop.',
        nextStep: 'Change the loop.'
      });
      const result = parseAndValidateFeedbackOutput(leak);
      assert.equal(result.isValid, false);
      assert.match(result.reason, /forbidden solution phrase/);
    });

    it('rejects malformed non-JSON output', () => {
      const plainText = 'I think you should check your loop index because it goes past the array.';
      const result = parseAndValidateFeedbackOutput(plainText);
      assert.equal(result.isValid, false);
      assert.match(result.reason, /Invalid JSON format/);
    });

    it('rejects JSON with missing required keys', () => {
      const missingKey = JSON.stringify({
        summary: 'Only summary is present.'
      });
      const result = parseAndValidateFeedbackOutput(missingKey);
      assert.equal(result.isValid, false);
      assert.match(result.reason, /Missing or too short/);
    });
  });

  describe('Safe Fallback Generation', () => {
    it('produces tailored fallback feedback for all status types', () => {
      const compile = buildSafeFeedbackFallback({ status: 'compile_error' });
      assert.match(compile.summary, /Compilation failed/);
      assert.match(compile.nextStep, /compiler error message/);

      const timeout = buildSafeFeedbackFallback({ status: 'timeout' });
      assert.match(timeout.summary, /time limit/);
      assert.match(timeout.likelyIssue, /infinite loop/);

      const runtime = buildSafeFeedbackFallback({ status: 'runtime_error' });
      assert.match(runtime.summary, /runtime error/);
      assert.match(runtime.nextStep, /traceback/);

      const wrong = buildSafeFeedbackFallback({ status: 'wrong_output' });
      assert.match(wrong.summary, /did not match what was expected/);

      const passed = buildSafeFeedbackFallback({ status: 'passed' });
      assert.match(passed.summary, /passed successfully/);
    });
  });

  describe('Route Integration (POST /api/ai/feedback)', () => {
    it('successfully returns structured feedback using a mocked Gemini client', async () => {
      const mockClient = {
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              text: () => JSON.stringify({
                summary: 'Your code handled 2 public tests but failed on the empty array test.',
                likelyIssue: 'Accessing index 0 when the array is empty produces undefined.',
                nextStep: 'Add a check at the beginning of the function for array length 0.'
              })
            }
          })
        })
      };

      const service = new GeminiService({ client: mockClient });
      const app = createTestApp(service);

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/ai/feedback',
        body: {
          code: 'function sum(arr) { return arr[0]; }',
          language: 'javascript',
          challengeTitle: 'Sum Array',
          challengeDescription: 'Return sum of elements or 0 for empty.',
          executionResults: {
            status: 'wrong_output',
            passCount: 2,
            failCount: 1,
            totalTests: 3
          }
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const data = res.body.data;
      assert.equal(data.executionStatus, 'wrong_output');
      assert.equal(data.passCount, 2);
      assert.equal(data.failCount, 1);
      assert.equal(data.totalTests, 3);
      assert.equal(data.isFallback, false);
      assert.match(data.summary, /empty array test/);
      assert.match(data.likelyIssue, /undefined/);
      assert.match(data.nextStep, /array length 0/);
    });

    it('preserves authoritative execution metrics and never allows AI to override them', async () => {
      const mockClient = {
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              text: () => JSON.stringify({
                summary: 'AI thinks everything is fine.',
                likelyIssue: 'None at all.',
                nextStep: 'Continue.'
              })
            }
          })
        })
      };

      const service = new GeminiService({ client: mockClient });
      const app = createTestApp(service);

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/ai/feedback',
        body: {
          code: 'broken code',
          language: 'javascript',
          executionResults: {
            status: 'compile_error',
            passCount: 0,
            failCount: 3,
            totalTests: 3
          }
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.executionStatus, 'compile_error');
      assert.equal(res.body.data.passCount, 0);
      assert.equal(res.body.data.failCount, 3);
    });

    it('rejects invalid inputs (missing code, invalid language, missing executionResults, oversized code)', async () => {
      const service = new GeminiService({ apiKey: '' });
      const app = createTestApp(service);

      // 1. Missing code
      const r1 = await dispatch(app, {
        method: 'POST',
        path: '/api/ai/feedback',
        body: { language: 'javascript', executionResults: { status: 'passed' } }
      });
      assert.equal(r1.status, 400);
      assert.match(r1.body.error, /Learner code must be a non-empty string/);

      // 2. Invalid language
      const r2 = await dispatch(app, {
        method: 'POST',
        path: '/api/ai/feedback',
        body: { code: 'print(1)', language: 'python', executionResults: { status: 'passed' } }
      });
      assert.equal(r2.status, 400);
      assert.match(r2.body.error, /Programming language must be either "java" or "javascript"/);

      // 3. Missing executionResults
      const r3 = await dispatch(app, {
        method: 'POST',
        path: '/api/ai/feedback',
        body: { code: 'return 1;', language: 'javascript' }
      });
      assert.equal(r3.status, 400);
      assert.match(r3.body.error, /Authoritative executionResults object is required/);

      // 4. Oversized code (> 64KB)
      const hugeCode = 'x'.repeat(66000);
      const r4 = await dispatch(app, {
        method: 'POST',
        path: '/api/ai/feedback',
        body: { code: hugeCode, language: 'javascript', executionResults: { status: 'passed' } }
      });
      assert.equal(r4.status, 413);
      assert.match(r4.body.error, /exceeds the 64KB maximum limit/);
    });

    it('falls back safely when Gemini is unconfigured', async () => {
      const unconfiguredService = new GeminiService({ apiKey: '' });
      const app = createTestApp(unconfiguredService);

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/ai/feedback',
        body: {
          code: 'for(let i=0; i<=arr.length; i++) sum+=arr[i];',
          language: 'javascript',
          executionResults: {
            status: 'runtime_error',
            passCount: 0,
            failCount: 1,
            totalTests: 1
          }
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const data = res.body.data;
      assert.equal(data.isFallback, true);
      assert.equal(data.executionStatus, 'runtime_error');
      assert.match(data.summary, /runtime error halted/);
      assert.match(data.nextStep, /error traceback/);
    });

    it('falls back safely when Gemini API produces malformed output or throws', async () => {
      const failingClient = {
        getGenerativeModel: () => ({
          generateContent: async () => {
            throw new Error('503 Service Unavailable upstream error');
          }
        })
      };

      const failingService = new GeminiService({ client: failingClient });
      const app = createTestApp(failingService);

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/ai/feedback',
        body: {
          code: 'while(true){}',
          language: 'javascript',
          executionResults: {
            status: 'timeout',
            passCount: 0,
            failCount: 1,
            totalTests: 1
          }
        }
      });

      assert.equal(res.status, 200);
      const data = res.body.data;
      assert.equal(data.isFallback, true);
      assert.equal(data.executionStatus, 'timeout');
      assert.match(data.summary, /allowable time limit/);
    });
  });
});
