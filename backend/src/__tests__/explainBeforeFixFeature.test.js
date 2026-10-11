import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { GeminiService } from '../services/geminiService.js';
import { store } from '../data/store.js';
import db from '../db/index.js';
import explainBeforeFixRouter from '../routes/explainBeforeFix.js';
import hintsRouter from '../routes/hints.js';
import progressRouter from '../routes/progress.js';

// Helper to dispatch HTTP requests to Express app without external network
function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/explain-before-fix', explainBeforeFixRouter);
  app.use('/api/hints', hintsRouter);
  app.use('/api/progress', progressRouter);
  return app;
}

function dispatch(app, { method, path, body = null, query = null }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      let fullPath = path;
      if (query) {
        const q = new URLSearchParams(query).toString();
        fullPath += `?${q}`;
      }

      const postData = body ? JSON.stringify(body) : '';
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: fullPath,
          method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        },
        res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            server.close(() => {
              try {
                const parsed = data ? JSON.parse(data) : {};
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
              } catch {
                resolve({ status: res.statusCode, headers: res.headers, body: data });
              }
            });
          });
        }
      );

      req.on('error', err => {
        server.close();
        reject(err);
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  });
}

describe('CodeDNA Explain Before You Fix (EBYF) Feature', () => {
  let app;

  beforeEach(() => {
    store.reset();
    app = createTestApp();
  });

  describe('1. Question Generation', () => {
    it('generates a targeted condition question for loop boundary failures', async () => {
      const sub = store.saveSubmission({
        id: 'sub-loop-1',
        learnerId: 'learner-q1',
        challengeId: 'sum-array',
        language: 'javascript',
        code: 'for(let i=0; i<=arr.length; i++) sum += arr[i];',
        executionResults: {
          status: 'wrong_output',
          failCount: 1,
          passCount: 1,
          totalTests: 2,
          testResults: [
            { isPublic: true, status: 'wrong_output', stdout: 'NaN', expected_output: '10' },
            { isPublic: false, status: 'wrong_output', stdout: null }
          ]
        }
      });
      store.saveBugFingerprints([
        { learnerId: 'learner-q1', challengeId: 'sum-array', submissionId: sub.id, patternKey: 'loop_condition' }
      ]);

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix/question',
        body: {
          submissionId: sub.id,
          learnerId: 'learner-q1'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.questionId);
      assert.equal(res.body.data.questionType, 'explain_condition');
      assert.match(res.body.data.question, /loop/i);
      assert.ok(res.body.data.context.length > 5);

      // Verify question is persisted in store
      const stored = store.getEbyfQuestion('learner-q1', sub.id);
      assert.ok(stored);
      assert.equal(stored.question, res.body.data.question);
    });

    it('generates question for array index errors via direct code payload', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix/question',
        body: {
          learnerId: 'learner-q2',
          code: 'int val = arr[arr.length];',
          language: 'java',
          challengeTitle: 'Array Element Access',
          bugFingerprints: ['array_index_error'],
          executionResults: {
            status: 'runtime_error',
            testResults: [
              { isPublic: true, status: 'runtime_error', stderr: 'ArrayIndexOutOfBoundsException: Index 5 out of bounds' }
            ]
          }
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.questionType, 'predict_value');
      assert.match(res.body.data.question, /index/i);
    });

    it('can retrieve generated question via GET /api/explain-before-fix/question', async () => {
      store.saveSubmission({
        id: 'sub-get-q',
        learnerId: 'learner-get',
        code: 'return arr[0];',
        executionResults: { status: 'wrong_output' }
      });

      // 1. Initial GET generates and saves
      const res1 = await dispatch(app, {
        method: 'GET',
        path: '/api/explain-before-fix/question',
        query: { submissionId: 'sub-get-q', learnerId: 'learner-get' }
      });
      assert.equal(res1.status, 200);
      assert.ok(res1.body.data.question);

      // 2. Second GET returns cached question
      const res2 = await dispatch(app, {
        method: 'GET',
        path: '/api/explain-before-fix/question',
        query: { submissionId: 'sub-get-q', learnerId: 'learner-get' }
      });
      assert.equal(res2.status, 200);
      assert.equal(res2.body.data.questionId, res1.body.data.questionId);
      assert.equal(res2.body.data.question, res1.body.data.question);
    });

    it('generates question using mocked Gemini client when configured', async () => {
      const mockClient = {
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              text: () => JSON.stringify({
                question: 'What is the index accessed on the very last iteration of your loop?',
                questionType: 'explain_condition',
                context: 'Public test example failed with unexpected boundary value.'
              })
            }
          })
        })
      };

      const customService = new GeminiService({ client: mockClient });
      const q = await customService.generateEbyfQuestion({
        code: 'for(let i=0; i<=arr.length; i++)',
        language: 'javascript',
        challengeTitle: 'Sum Array',
        executionResults: { status: 'wrong_output' },
        bugFingerprints: ['loop_condition']
      });

      assert.equal(q.isFallback, false);
      assert.equal(q.questionType, 'explain_condition');
      assert.match(q.question, /very last iteration/);
    });
  });

  describe('2. Hidden Test Data Protection', () => {
    it('strictly excludes hidden test inputs and outputs from Gemini question generation prompt', async () => {
      let promptSent = '';
      const mockClient = {
        getGenerativeModel: () => ({
          generateContent: async (prompt) => {
            promptSent = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
            return {
              response: {
                text: () => JSON.stringify({
                  question: 'Does your loop include the final index?',
                  questionType: 'explain_condition',
                  context: 'Public test failed.'
                })
              }
            };
          }
        })
      };

      const customService = new GeminiService({ client: mockClient });
      await customService.generateEbyfQuestion({
        code: 'return a + b;',
        language: 'javascript',
        challengeTitle: 'Add Numbers',
        executionResults: {
          status: 'wrong_output',
          passCount: 1,
          failCount: 1,
          testResults: [
            { isPublic: true, status: 'passed', stdout: '4', stdin: '2, 2', expected_output: '4' },
            { isPublic: false, status: 'wrong_output', stdout: '99', stdin: 'SUPER_SECRET_INPUT_XYZ', expected_output: 'CONFIDENTIAL_RESULT_ABC' }
          ]
        }
      });

      assert.ok(!promptSent.includes('SUPER_SECRET_INPUT_XYZ'), 'Hidden input must NOT appear in prompt');
      assert.ok(!promptSent.includes('CONFIDENTIAL_RESULT_ABC'), 'Hidden output must NOT appear in prompt');
      assert.ok(promptSent.includes('Hidden Tests: 1 hidden test(s) evaluated'), 'Private status summary preserved without leaking data');
    });
  });

  describe('3. Explanation Evaluation: Correct, Partially Correct, Incorrect', () => {
    it('evaluates a correct explanation identifying the loop boundary', async () => {
      const sub = store.saveSubmission({
        id: 'sub-eval-1',
        learnerId: 'learner-e1',
        challengeId: 'sum-array',
        language: 'javascript',
        code: 'for(let i=0; i<=arr.length; i++) sum += arr[i];'
      });
      store.saveBugFingerprints([
        { learnerId: 'learner-e1', challengeId: 'sum-array', submissionId: sub.id, patternKey: 'loop_condition' }
      ]);

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: sub.id,
          learnerId: 'learner-e1',
          explanation: 'I think the loop condition checks <= arr.length which goes one past the end of the array',
          predictedVariable: 'i',
          predictedValue: 'arr.length'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.evaluation, 'correct');
      assert.ok(res.body.data.understoodCorrectly.length > 10);
      assert.ok(res.body.data.toReconsider.length > 10);
      assert.ok(res.body.data.feedback.length > 15);
      assert.equal(res.body.data.canProceedToHint, true);

      // Verify reflection record in store
      const saved = store.getEbyf('learner-e1', sub.id);
      assert.ok(saved);
      assert.equal(saved.evaluation, 'correct');
      assert.equal(saved.canProceedToHint, true);
    });

    it('accepts varied, non-exact phrasing for correct explanations', async () => {
      const sub = store.saveSubmission({
        id: 'sub-eval-phrasing',
        learnerId: 'learner-phrasing',
        code: 'for(let i=0; i<=arr.length; i++)',
        language: 'javascript'
      });
      store.saveBugFingerprints([
        { learnerId: 'learner-phrasing', challengeId: 'sum-array', submissionId: sub.id, patternKey: 'loop_condition' }
      ]);

      // Phrasing with alternative wording
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: sub.id,
          learnerId: 'learner-phrasing',
          explanation: 'The stopping condition has an off by one boundary mistake because arrays are 0-indexed',
          predictedVariable: 'i',
          predictedValue: 'out of bounds'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.evaluation, 'correct');
      assert.equal(res.body.data.canProceedToHint, true);
    });

    it('evaluates a partially correct explanation focusing on loop generally', async () => {
      const sub = store.saveSubmission({
        id: 'sub-eval-partial',
        learnerId: 'learner-e2',
        code: 'for(let i=0; i<=arr.length; i++)'
      });
      store.saveBugFingerprints([
        { learnerId: 'learner-e2', challengeId: 'sum-array', submissionId: sub.id, patternKey: 'loop_condition' }
      ]);

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: sub.id,
          learnerId: 'learner-e2',
          explanation: 'Something is wrong with my loop iteration counter'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.evaluation, 'partially_correct');
      assert.ok(res.body.data.understoodCorrectly.includes('loop'));
      assert.ok(res.body.data.toReconsider.length > 10);
      assert.equal(res.body.data.canProceedToHint, true);
    });

    it('evaluates an incorrect or off-topic explanation constructively', async () => {
      const sub = store.saveSubmission({
        id: 'sub-eval-wrong',
        learnerId: 'learner-e3',
        code: 'for(let i=0; i<=arr.length; i++)'
      });
      store.saveBugFingerprints([
        { learnerId: 'learner-e3', challengeId: 'sum-array', submissionId: sub.id, patternKey: 'loop_condition' }
      ]);

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: sub.id,
          learnerId: 'learner-e3',
          explanation: 'The css background styling is broken and the server database dropped'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.evaluation, 'incorrect');
      assert.match(res.body.data.toReconsider, /external factors|loop/i);
      assert.equal(res.body.data.canProceedToHint, true);
    });

    it('evaluates explanation using mocked Gemini AI client when configured', async () => {
      const mockClient = {
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              text: () => JSON.stringify({
                evaluation: 'correct',
                understoodCorrectly: 'You accurately recognized the off-by-one loop boundary.',
                toReconsider: 'Verify whether changing <= to < resolves all tests.',
                feedback: 'Excellent debugging analysis! You caught the off-by-one condition.'
              })
            }
          })
        })
      };

      const customService = new GeminiService({ client: mockClient });
      const result = await customService.evaluateEbyfExplanation({
        explanation: 'Loop index goes past end',
        code: 'for(let i=0; i<=arr.length; i++)',
        language: 'javascript',
        challengeTitle: 'Sum Array',
        bugFingerprints: ['loop_condition']
      });

      assert.equal(result.isFallback, false);
      assert.equal(result.evaluation, 'correct');
      assert.equal(result.understoodCorrectly, 'You accurately recognized the off-by-one loop boundary.');
      assert.equal(result.toReconsider, 'Verify whether changing <= to < resolves all tests.');
    });
  });

  describe('4. Invalid Requests & Input Boundaries', () => {
    it('rejects missing learnerId with 400', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: { submissionId: 'sub-1', explanation: 'Valid length explanation here' }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /learnerId is required/);
    });

    it('rejects missing submissionId with 400', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: { learnerId: 'learner-1', explanation: 'Valid length explanation here' }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /submissionId is required/);
    });

    it('rejects explanation that is too short (< 5 chars) with 400', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: { submissionId: 'sub-1', learnerId: 'learner-1', explanation: 'oops' }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /at least 5 characters/);
    });

    it('rejects explanation that exceeds 4000 chars with 413', async () => {
      const oversized = 'a'.repeat(4001);
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: { submissionId: 'sub-1', learnerId: 'learner-1', explanation: oversized }
      });
      assert.equal(res.status, 413);
      assert.match(res.body.error, /exceeds maximum allowable length/);
    });

    it('rejects code payload exceeding 64KB with 413', async () => {
      const bigCode = 'x'.repeat(65537);
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: 'sub-1',
          learnerId: 'learner-1',
          explanation: 'Valid explanation text here',
          code: bigCode
        }
      });
      assert.equal(res.status, 413);
      assert.match(res.body.error, /64KB maximum limit/);
    });

    it('returns 404 if submissionId is not found and no code provided', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: 'non-existent-sub',
          learnerId: 'learner-1',
          explanation: 'Valid explanation text here'
        }
      });
      assert.equal(res.status, 404);
      assert.match(res.body.error, /Submission not found/);
    });
  });

  describe('5. AI Failure & Safe Fallbacks', () => {
    it('falls back to rule-based evaluation when Gemini client throws upstream error', async () => {
      const mockClient = {
        getGenerativeModel: () => ({
          generateContent: async () => {
            throw new Error('503 Service Unavailable upstream error');
          }
        })
      };

      const customService = new GeminiService({ client: mockClient });
      const result = await customService.evaluateEbyfExplanation({
        explanation: 'Loop goes past end of array <= arr.length',
        code: 'for(let i=0; i<=arr.length; i++)',
        bugFingerprints: ['loop_condition']
      });

      assert.equal(result.isFallback, true);
      assert.equal(result.evaluation, 'correct');
      assert.ok(result.feedback.length > 10);
    });

    it('falls back to rule-based evaluation when Gemini response contains markdown code block', async () => {
      const mockClient = {
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              text: () => JSON.stringify({
                evaluation: 'correct',
                understoodCorrectly: 'Fix it by doing: ```i < arr.length```',
                toReconsider: 'None',
                feedback: 'Here is the fix: ```js code```'
              })
            }
          })
        })
      };

      const customService = new GeminiService({ client: mockClient });
      const result = await customService.evaluateEbyfExplanation({
        explanation: 'Loop index goes past end',
        bugFingerprints: ['loop_condition']
      });

      assert.equal(result.isFallback, true);
      assert.ok(!result.feedback.includes('```'), 'Code fences must be stripped / rejected');
    });
  });

  describe('6. Complete End-to-End Learning Flow', () => {
    it('executes the full journey: question generation -> explanation evaluation -> unlock progressive hint', async () => {
      // Step 1: Learner has a failed submission
      const sub = store.saveSubmission({
        id: 'sub-journey-1',
        learnerId: 'learner-journey',
        challengeId: 'sum-array',
        language: 'javascript',
        code: 'function sum(arr) { let s=0; for(let i=0; i<=arr.length; i++) s+=arr[i]; return s; }',
        executionResults: {
          status: 'wrong_output',
          failCount: 1,
          passCount: 1,
          totalTests: 2,
          testResults: [
            { isPublic: true, status: 'wrong_output', stdout: 'NaN', expected_output: '6' }
          ]
        }
      });
      store.saveBugFingerprints([
        { learnerId: 'learner-journey', challengeId: 'sum-array', submissionId: sub.id, patternKey: 'loop_condition' }
      ]);

      // Step 2: System generates targeted question
      const qRes = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix/question',
        body: {
          submissionId: sub.id,
          learnerId: 'learner-journey'
        }
      });
      assert.equal(qRes.status, 200);
      assert.ok(qRes.body.data.question);
      assert.equal(qRes.body.data.questionType, 'explain_condition');

      // Step 3: Learner submits explanation
      const eRes = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: sub.id,
          learnerId: 'learner-journey',
          explanation: 'My loop condition i<=arr.length reaches an index outside the array bounds',
          predictedVariable: 'i',
          predictedValue: 'arr.length'
        }
      });
      assert.equal(eRes.status, 200);
      assert.equal(eRes.body.data.evaluation, 'correct');
      assert.equal(eRes.body.data.canProceedToHint, true);

      // Verify EBYF status endpoint confirms completion
      const statusRes = await dispatch(app, {
        method: 'GET',
        path: `/api/explain-before-fix/status/learner-journey/${sub.id}`
      });
      assert.equal(statusRes.status, 200);
      assert.equal(statusRes.body.data.hasCompletedEbyf, true);

      // Step 4: Learner unlocks Hint Level 1
      const hintRes = await dispatch(app, {
        method: 'POST',
        path: '/api/hints',
        body: {
          submissionId: sub.id,
          learnerId: 'learner-journey',
          hintLevel: 1
        }
      });
      assert.equal(hintRes.status, 200);
      assert.equal(hintRes.body.success, true);
      assert.equal(hintRes.body.data.hintLevel, 1);
      assert.ok(hintRes.body.data.hint.length > 10);
    });
  });

  describe('7. SQLite Persistence, Security & Learner Progress', () => {
    it('persists reflection in SQLite ebyf_reflections table and updates submissions table', async () => {
      const testSubId = `sub-sql-${Date.now()}`;
      const testLearnerId = `learner-sql-${Date.now()}`;

      // Seed submission in SQLite
      db.prepare(`
        INSERT INTO submissions (id, learner_id, challenge_id, language, code, pass_count, fail_count, status)
        VALUES (?, ?, 'sum-positive', 'javascript', 'for(let i=0; i<=arr.length; i++) sum += arr[i];', 0, 1, 'failed')
      `).run(testSubId, testLearnerId);

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: testSubId,
          learnerId: testLearnerId,
          explanation: 'My loop condition i<=arr.length reads past the end of the array',
          predictedVariable: 'i',
          predictedValue: 'arr.length'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.evaluation, 'correct');

      // Check SQLite ebyf_reflections table directly
      const reflection = db.prepare('SELECT * FROM ebyf_reflections WHERE submission_id = ?').get(testSubId);
      assert.ok(reflection, 'Record must exist in SQLite ebyf_reflections table');
      assert.equal(reflection.learner_id, testLearnerId);
      assert.equal(reflection.evaluation, 'correct');
      assert.equal(reflection.can_proceed_to_hint, 1);
      assert.equal(reflection.predicted_variable, 'i');
      assert.equal(reflection.predicted_value, 'arr.length');

      // Check that submissions row has explanation and prediction recorded
      const updatedSub = db.prepare('SELECT explanation, prediction FROM submissions WHERE id = ?').get(testSubId);
      assert.equal(updatedSub.explanation, 'My loop condition i<=arr.length reads past the end of the array');
      assert.match(updatedSub.prediction, /arr\.length/);

      // Reset in-memory store to prove GET status reads from SQLite directly
      store.reset();
      const statusRes = await dispatch(app, {
        method: 'GET',
        path: `/api/explain-before-fix/status/${testLearnerId}/${testSubId}`
      });
      assert.equal(statusRes.status, 200);
      assert.equal(statusRes.body.data.hasCompletedEbyf, true);
      assert.equal(statusRes.body.data.record.evaluation, 'correct');
    });

    it('rejects cross-learner reflection attempts with 403 Forbidden', async () => {
      const ownerSubId = `sub-owner-${Date.now()}`;
      db.prepare(`
        INSERT INTO submissions (id, learner_id, challenge_id, language, code, pass_count, fail_count, status)
        VALUES (?, 'legitimate-owner', 'sum-positive', 'javascript', 'let x = 1;', 0, 1, 'failed')
      `).run(ownerSubId);

      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: ownerSubId,
          learnerId: 'malicious-attacker',
          explanation: 'Attempting to reflect on another learners code'
        }
      });

      assert.equal(res.status, 403);
      assert.match(res.body.error, /permission|Unauthorized/i);
    });

    it('makes EBYF interactions available in progress telemetry via GET /api/progress/:learnerId', async () => {
      const learnerId = `learner-prog-${Date.now()}`;
      const subId = `sub-prog-${Date.now()}`;

      db.prepare(`
        INSERT INTO submissions (id, learner_id, challenge_id, language, code, pass_count, fail_count, status)
        VALUES (?, ?, 'sum-positive', 'javascript', 'for(let i=0; i<=arr.length; i++)', 0, 1, 'failed')
      `).run(subId, learnerId);

      await dispatch(app, {
        method: 'POST',
        path: '/api/explain-before-fix',
        body: {
          submissionId: subId,
          learnerId,
          explanation: 'Off by one loop boundary error on <= arr.length',
          predictedVariable: 'i',
          predictedValue: 'arr.length'
        }
      });

      const progRes = await dispatch(app, {
        method: 'GET',
        path: `/api/progress/${learnerId}`
      });

      assert.equal(progRes.status, 200);
      assert.equal(progRes.body.success, true);
      assert.ok(progRes.body.data.ebyf);
      assert.ok(progRes.body.data.ebyf.totalReflections >= 1);
      assert.equal(progRes.body.data.ebyf.evaluations.correct >= 1, true);
    });
  });
});

