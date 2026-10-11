import express from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
import { generateProgressiveHint, generateEbyfFeedback } from '../services/geminiService.js';

const router = express.Router();

/**
 * POST /api/hints
 * Requests a progressive hint (level 1, 2, or 3) for a submission.
 * Validates requested level, queries public tests only, generates AI hint or static fallback,
 * and records hint history.
 */
router.post('/', async (req, res) => {
  try {
    const { submissionId, hintLevel = 1, learnerId: bodyLearnerId } = req.body || {};

    if (!submissionId || typeof submissionId !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_SUBMISSION_ID',
          message: 'submissionId is required'
        }
      });
    }

    const level = parseInt(hintLevel, 10);
    if (![1, 2, 3].includes(level)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_HINT_LEVEL',
          message: 'hintLevel must be 1, 2, or 3'
        }
      });
    }

    // 1. Fetch Submission
    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
    if (!submission) {
      return res.status(404).json({
        error: {
          code: 'SUBMISSION_NOT_FOUND',
          message: `Submission '${submissionId}' not found`
        }
      });
    }

    const learnerId = bodyLearnerId || req.headers['x-learner-id'] || submission.learner_id;

    // 2. Fetch Challenge
    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(submission.challenge_id);
    if (!challenge) {
      return res.status(404).json({
        error: {
          code: 'CHALLENGE_NOT_FOUND',
          message: 'Associated challenge not found'
        }
      });
    }

    // 3. Prevent skipping levels (cannot request level 3 if level 2 was never viewed for this submission)
    if (level > 1) {
      const priorHint = db.prepare(`
        SELECT id FROM hint_history
        WHERE submission_id = ? AND hint_level = ?
      `).get(submissionId, level - 1);

      if (!priorHint) {
        return res.status(400).json({
          error: {
            code: 'CANNOT_SKIP_HINT_LEVELS',
            message: `You must view Level ${level - 1} before unlocking Level ${level}`
          }
        });
      }
    }

    // 4. Fetch PUBLIC Test Results Only (Privacy Rule: Never pass hidden tests to AI)
    const publicResults = db.prepare(`
      SELECT status, stdout, stderr, is_public
      FROM test_results
      WHERE submission_id = ? AND is_public = 1
    `).all(submissionId);

    // 5. Generate AI Hint or Static Fallback
    const hintResult = await generateProgressiveHint({
      challenge,
      submission,
      publicTestResults: publicResults,
      hintLevel: level
    });

    // 6. Record Hint History & Update Progress in Transaction
    const saveHint = db.transaction(() => {
      const hintId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO hint_history (
          id, learner_id, submission_id, challenge_id, hint_level, hint_text, is_fallback
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        hintId,
        learnerId,
        submissionId,
        challenge.id,
        level,
        hintResult.hint,
        hintResult.isFallback ? 1 : 0
      );

      // Increment hints_used in learner_progress
      db.prepare(`
        UPDATE learner_progress
        SET hints_used = hints_used + 1
        WHERE learner_id = ? AND challenge_id = ?
      `).run(learnerId, challenge.id);
    });

    saveHint();

    res.json({
      hintLevel: hintResult.hintLevel,
      hint: hintResult.hint,
      isFallback: hintResult.isFallback
    });
  } catch (error) {
    console.error('Error generating hint:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate hint'
      }
    });
  }
});

/**
 * POST /api/hints/explain-before-fix
 * Handles the Explain Before You Fix (EBYF) reflection step.
 */
router.post('/explain-before-fix', async (req, res) => {
  try {
    const { submissionId, explanation = '', prediction = '' } = req.body || {};

    let challenge = null;
    if (submissionId) {
      const sub = db.prepare('SELECT challenge_id FROM submissions WHERE id = ?').get(submissionId);
      if (sub) {
        challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(sub.challenge_id);
      }
    }

    const feedbackResult = await generateEbyfFeedback({
      explanation,
      prediction,
      challenge
    });

    res.json(feedbackResult);
  } catch (err) {
    console.error('EBYF error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process explanation'
      }
    });
  }
});

export default router;
