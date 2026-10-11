import express from 'express';
import { geminiService } from '../services/geminiService.js';

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
 * Request Body:
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
    const {
      code,
      language,
      challengeTitle,
      challengeDescription,
      executionResults
    } = req.body;

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
