import express from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
import { executeSubmission, isRunnerConfigured, STATUS } from '../services/judgeService.js';
import { classifyBugFingerprint } from '../services/bugFingerprint.js';
import { store } from '../data/store.js';
import { parseLanguages } from '../models/challengeModel.js';

const router = express.Router();

const MAX_CODE_SIZE = 65536; // 64 KB

/**
 * POST /api/submissions
 * Executes submitted code against challenge test cases using the safe runner.
 * Enforces strict privacy: hidden test cases never leak stdin, expected, or actual output.
 */
router.post('/', async (req, res) => {
  try {
    // 0. Validate Request Body Structure (Guard against malformed/non-object payloads)
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body must be a valid JSON object'
        }
      });
    }

    const { challengeId, language, code, prediction, explanation, learnerId: bodyLearnerId } = req.body;

    // 1. Validate Challenge ID
    if (!challengeId || typeof challengeId !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_CHALLENGE_ID',
          message: 'challengeId is required and must be a string'
        }
      });
    }

    const trimmedChallengeId = challengeId.trim();
    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(trimmedChallengeId);
    if (!challenge) {
      return res.status(404).json({
        error: {
          code: 'CHALLENGE_NOT_FOUND',
          message: `Challenge '${challengeId}' not found`
        }
      });
    }

    // 2. Validate Platform Supported Languages
    if (!language || typeof language !== 'string' || !['javascript', 'java'].includes(language)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_LANGUAGE',
          message: 'Language must be either \'javascript\' or \'java\''
        }
      });
    }

    // 3. Validate Requested Language against Challenge Supported Languages
    const supportedLanguages = parseLanguages(challenge.languages);
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        error: {
          code: 'UNSUPPORTED_LANGUAGE',
          message: `Language '${language}' is not supported for challenge '${challengeId}'. Supported: ${supportedLanguages.join(', ')}`
        }
      });
    }

    // 4. Validate Code
    if (code === undefined || code === null || typeof code !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_CODE',
          message: 'Code is required and must be a string'
        }
      });
    }

    if (code.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_CODE',
          message: 'Code cannot be empty'
        }
      });
    }

    if (Buffer.byteLength(code, 'utf-8') > MAX_CODE_SIZE) {
      return res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Submitted code exceeds maximum size limit (64 KB)'
        }
      });
    }

    // 5. Verify Safe Runner Availability
    if (!isRunnerConfigured()) {
      return res.status(503).json({
        error: {
          code: 'RUNNER_NOT_CONFIGURED',
          message: 'Code execution is not configured. The submission was not executed.'
        }
      });
    }

    // 6. Load Test Cases
    const testCases = db.prepare(`
      SELECT id, is_public, stdin, expected_output, ordinal
      FROM test_cases
      WHERE challenge_id = ?
      ORDER BY ordinal ASC
    `).all(trimmedChallengeId);

    if (!testCases || testCases.length === 0) {
      return res.status(500).json({
        error: {
          code: 'NO_TEST_CASES',
          message: 'No test cases configured for this challenge'
        }
      });
    }

    // 7. Generate Submission Identity
    const submissionId = crypto.randomUUID();
    const learnerId = bodyLearnerId || req.headers['x-learner-id'] || 'anonymous-learner';

    // 8. Execute Test Cases
    const results = [];
    const internalResults = [];
    let passCount = 0;
    let failCount = 0;
    let hasCompileError = false;

    for (const tc of testCases) {
      let execResult;

      if (hasCompileError) {
        // If compilation failed on previous test, cascade compile_error
        execResult = {
          status: STATUS.COMPILE_ERROR,
          stdout: null,
          stderr: 'Compilation failed',
          timeMs: null,
          memoryKb: null
        };
      } else {
        try {
          execResult = await executeSubmission({
            language,
            code,
            stdin: tc.stdin || '',
            expectedOutput: tc.expected_output
          });

          if (execResult.status === STATUS.COMPILE_ERROR) {
            hasCompileError = true;
          }
        } catch (runnerErr) {
          // Handle rate limits from provider
          if (runnerErr.code === 'RUNNER_RATE_LIMITED' || runnerErr.statusCode === 429) {
            return res.status(429).json({
              error: {
                code: 'RUNNER_RATE_LIMITED',
                message: runnerErr.message || 'Execution provider rate limit exceeded'
              }
            });
          }

          // Handle execution service provider failures without crashing
          return res.status(503).json({
            error: {
              code: runnerErr.code || 'RUNNER_UNAVAILABLE',
              message: runnerErr.message || 'Execution service failure'
            }
          });
        }
      }

      const isPass = execResult.status === STATUS.PASSED;
      if (isPass) {
        passCount++;
      } else {
        failCount++;
      }

      // Store internal detailed result for fingerprint and DB
      internalResults.push({
        testCaseId: tc.id,
        isPublic: tc.is_public,
        status: execResult.status,
        stdin: tc.stdin,
        expected: tc.expected_output,
        actual: execResult.stdout,
        stderr: execResult.stderr,
        timeMs: execResult.timeMs,
        memoryKb: execResult.memoryKb
      });

      // Prepare client response with STRICT PRIVACY on hidden test cases
      if (tc.is_public === 1) {
        results.push({
          testId: tc.id,
          visibility: 'visible',
          status: execResult.status,
          expected: tc.expected_output,
          actual: execResult.stdout || ''
        });
      } else {
        // HIDDEN TEST: strictly omit stdin, expected, actual, stdout, stderr
        results.push({
          testId: tc.id,
          visibility: 'hidden',
          status: execResult.status
        });
      }
    }

    const overallStatus = failCount === 0 ? 'passed' : 'failed';

    // 8. Analyze Bug Fingerprint
    const fingerprintResult = classifyBugFingerprint({
      code,
      language,
      testResults: internalResults,
      concept: challenge.concept
    });
    const detectedPatterns = fingerprintResult.detectedPatterns || [];
    const feedback = fingerprintResult.feedback;

    // 9. Persist Submission & Results in Database (Wrapped in transaction)
    const saveSubmission = db.transaction(() => {
      // Insert submission
      db.prepare(`
        INSERT INTO submissions (
          id, learner_id, challenge_id, language, code, prediction, explanation, pass_count, fail_count, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        submissionId,
        learnerId,
        challengeId,
        language,
        code,
        prediction || null,
        explanation || null,
        passCount,
        failCount,
        overallStatus
      );

      // Insert per-test results
      const insertResult = db.prepare(`
        INSERT INTO test_results (
          id, submission_id, test_case_id, status, stdout, stderr, time_ms, memory_kb, is_public
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ir of internalResults) {
        insertResult.run(
          crypto.randomUUID(),
          submissionId,
          ir.testCaseId,
          ir.status,
          ir.actual,
          ir.stderr,
          ir.timeMs,
          ir.memoryKb,
          ir.isPublic
        );
      }

      // Insert detected bug fingerprints
      const insertFingerprint = db.prepare(`
        INSERT INTO bug_fingerprints (
          id, learner_id, challenge_id, submission_id, pattern_key, language, confidence, evidence, is_confirmed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pattern of detectedPatterns) {
        insertFingerprint.run(
          crypto.randomUUID(),
          learnerId,
          challengeId,
          submissionId,
          pattern,
          language,
          fingerprintResult.confidence || 'high',
          fingerprintResult.evidence || null,
          fingerprintResult.isConfirmed ? 1 : 0
        );
      }

      // Sync into in-memory store for adaptive recommendations and progress tracking
      if (detectedPatterns.length > 0) {
        store.saveBugFingerprints(
          detectedPatterns.map(pattern => ({
            learnerId,
            challengeId,
            submissionId,
            patternKey: pattern,
            language,
            confidence: fingerprintResult.confidence || 'high',
            evidence: fingerprintResult.evidence || null,
            isConfirmed: Boolean(fingerprintResult.isConfirmed)
          }))
        );
      }

      // Upsert learner progress
      db.prepare(`
        INSERT INTO learner_progress (
          id, learner_id, challenge_id, attempts, hints_used, best_pass_count, solved, last_attempt_at
        ) VALUES (?, ?, ?, 1, 0, ?, ?, datetime('now'))
        ON CONFLICT(learner_id, challenge_id) DO UPDATE SET
          attempts = attempts + 1,
          best_pass_count = MAX(best_pass_count, excluded.best_pass_count),
          solved = MAX(solved, excluded.solved),
          last_attempt_at = datetime('now')
      `).run(
        crypto.randomUUID(),
        learnerId,
        challengeId,
        passCount,
        overallStatus === 'passed' ? 1 : 0
      );
    });

    saveSubmission();

    // 10. Return Response per API_CONTRACT.md (Dual compatibility for root and data wrappers)
    const responseData = {
      submissionId,
      status: overallStatus,
      results,
      feedback,
      bugFingerprints: detectedPatterns,
      fingerprint: fingerprintResult.category !== 'unknown' ? {
        category: fingerprintResult.category,
        confidence: fingerprintResult.confidence,
        isConfirmed: fingerprintResult.isConfirmed,
        reason: fingerprintResult.reason,
        evidence: fingerprintResult.evidence
      } : null
    };

    res.json({
      success: true,
      data: responseData,
      ...responseData
    });

  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during submission evaluation'
      }
    });
  }
});

export default router;
