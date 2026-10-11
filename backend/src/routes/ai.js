import express from 'express';
import db from '../db/index.js';
import { geminiService } from '../services/geminiService.js';
import { store } from '../data/store.js';
import { getChallengeById } from '../data/seedChallenges.js';

const router = express.Router();

/**
 * GET /api/ai/health
 * Verifies Gemini service connectivity and responsiveness without exposing secrets.
 */
router.get('/health', async (req, res) => {
  try {
    const check = await geminiService.testConnection();

    if (check.status === 'healthy') {
      return res.status(200).json({
        success: true,
        service: 'gemini',
        status: 'healthy',
        model: check.model,
        latencyMs: check.latencyMs
      });
    }

    if (check.status === 'unconfigured') {
      return res.status(503).json({
        success: false,
        service: 'gemini',
        status: 'unconfigured',
        error: check.error
      });
    }

    return res.status(502).json({
      success: false,
      service: 'gemini',
      status: 'error',
      error: check.error
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      service: 'gemini',
      status: 'error',
      error: 'Unexpected server error while checking AI service health'
    });
  }
});

/**
 * POST /api/ai/feedback
 * Generates pedagogical diagnostic feedback after a learner submits code.
 *
 * Accepts either:
 * 1. { submissionId: string } -> looks up submission & public test results from DB/store
 * 2. Full direct payload:
 * {
 *   code: string,
 *   language: 'java' | 'javascript',
 *   challengeTitle?: string,
 *   challengeDescription?: string,
 *   executionResults: {
 *     status: 'passed' | 'wrong_output' | 'compile_error' | 'runtime_error' | 'timeout',
 *     passCount: number,
 *     failCount: number,
 *     totalTests?: number,
 *     testResults?: Array<{ testCaseId: string, isPublic: boolean, status: string, stdout?: string, stderr?: string }>
 *   }
 * }
 */
router.post('/feedback', async (req, res) => {
  try {
    let {
      submissionId,
      code,
      language,
      challengeTitle,
      challengeDescription,
      executionResults
    } = req.body || {};

    // 0. Resolve from submissionId if provided
    if (submissionId && (!code || !executionResults)) {
      const activeSubId = String(submissionId).trim();
      let dbSub = null;
      let dbChallenge = null;
      let dbPublicTests = [];

      try {
        dbSub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(activeSubId);
        if (dbSub) {
          dbChallenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(dbSub.challenge_id);
          dbPublicTests = db.prepare(`
            SELECT test_case_id as testCaseId, status, is_public as isPublic, stdout, stderr
            FROM test_results
            WHERE submission_id = ? AND is_public = 1
          `).all(activeSubId);
        }
      } catch (err) {
        // Non-fatal; will check in-memory store
      }

      if (!dbSub) {
        const storeSub = store.getSubmission(activeSubId);
        if (storeSub) {
          code = code || storeSub.code;
          language = language || storeSub.language;
          const seedChallenge = getChallengeById(storeSub.challengeId);
          challengeTitle = challengeTitle || seedChallenge?.title || 'Coding Challenge';
          challengeDescription = challengeDescription || seedChallenge?.description || 'Solve the challenge.';
          executionResults = executionResults || {
            status: storeSub.status || 'failed',
            passCount: storeSub.passCount || 0,
            failCount: storeSub.failCount || 1,
            totalTests: storeSub.totalTests || (storeSub.testResults?.length || 1),
            testResults: (storeSub.testResults || []).filter(t => t.isPublic !== false)
          };
        } else {
          return res.status(404).json({
            success: false,
            error: `Submission '${submissionId}' not found`
          });
        }
      } else {
        code = code || dbSub.code;
        language = language || dbSub.language;
        challengeTitle = challengeTitle || dbChallenge?.title || 'Coding Challenge';
        challengeDescription = challengeDescription || dbChallenge?.description || 'Solve the challenge.';

        const passCount = dbSub.pass_count ?? 0;
        const failCount = dbSub.fail_count ?? 0;
        const totalTests = passCount + failCount;
        const status = dbSub.status === 'passed' ? 'passed' : 'wrong_output';

        executionResults = executionResults || {
          status,
          passCount,
          failCount,
          totalTests,
          testResults: dbPublicTests.map(tr => ({
            testCaseId: tr.testCaseId,
            isPublic: true,
            status: tr.status,
            stdout: tr.stdout,
            stderr: tr.stderr
          }))
        };
      }
    }

    // 1. Validate code
    if (!code || typeof code !== 'string' || code.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Learner code must be a non-empty string'
      });
    }

    if (Buffer.byteLength(code, 'utf8') > 65536) {
      return res.status(413).json({
        success: false,
        error: 'Submitted code exceeds the 64KB maximum limit'
      });
    }

    // 2. Validate language
    if (!language || !['java', 'javascript'].includes(String(language).toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Programming language must be either "java" or "javascript"'
      });
    }

    // 3. Validate execution results
    if (!executionResults || typeof executionResults !== 'object' || Array.isArray(executionResults)) {
      return res.status(400).json({
        success: false,
        error: 'Authoritative executionResults object is required'
      });
    }

    // Authoritative execution metrics (AI is never permitted to override these)
    const passCount = Number(executionResults.passCount) || 0;
    const failCount = Number(executionResults.failCount) || 0;
    const totalTests = executionResults.totalTests !== undefined
      ? Number(executionResults.totalTests)
      : (passCount + failCount);
    const executionStatus = executionResults.status || (failCount > 0 ? 'wrong_output' : 'passed');

    // 4. Generate structured feedback via GeminiService (with strict hidden test protection & fallback)
    const feedback = await geminiService.generateSubmissionFeedback({
      code: code.trim(),
      language: String(language).toLowerCase(),
      challengeTitle: challengeTitle ? String(challengeTitle).trim() : 'Coding Challenge',
      challengeDescription: challengeDescription ? String(challengeDescription).trim() : 'Solve the challenge according to requirements.',
      executionResults: {
        ...executionResults,
        status: executionStatus,
        passCount,
        failCount,
        totalTests
      }
    });

    // 5. Return structured, validated response
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
  } catch (error) {
    console.error('Error in /api/ai/feedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while generating submission feedback'
    });
  }
});

export default router;
