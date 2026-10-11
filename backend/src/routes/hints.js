import express from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
import { geminiService, generateEbyfFeedback } from '../services/geminiService.js';
import { store } from '../data/store.js';
import { getChallengeById } from '../data/seedChallenges.js';

const router = express.Router();

/**
 * POST /api/hints
 * Progressive 3-level hinting endpoint.
 *
 * Supports both CodeDNA DB submission workflow and in-memory store sessions.
 */
router.post('/', async (req, res) => {
  try {
    const {
      hintLevel,
      learnerId: bodyLearnerId,
      submissionId,
      code,
      language,
      challengeId,
      challengeTitle,
      challengeDescription,
      publicExamples,
      executionSummary
    } = req.body || {};

    // 1. Validate hintLevel
    if (hintLevel === undefined || hintLevel === null) {
      return res.status(400).json({ success: false, error: 'hintLevel is required', code: 'INVALID_HINT_LEVEL' });
    }
    const level = Number(hintLevel);
    if (!Number.isInteger(level) || level < 1 || level > 3) {
      return res.status(400).json({ success: false, error: 'hintLevel must be 1, 2, or 3', code: 'INVALID_HINT_LEVEL' });
    }

    let activeSubmissionId = submissionId ? String(submissionId).trim() : null;

    // Check DB for existing submission
    let dbSubmission = null;
    let dbChallenge = null;
    if (activeSubmissionId) {
      try {
        dbSubmission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(activeSubmissionId);
        if (dbSubmission) {
          dbChallenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(dbSubmission.challenge_id);
        }
      } catch {
        // Fall back to store
      }
    }

    // Resolve store submission
    let storeSubmission = null;
    if (activeSubmissionId) {
      storeSubmission = store.getSubmission(activeSubmissionId);
    }

    // Validate code if passed
    let activeCode = '';
    if (code !== undefined) {
      if (typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'code must be a string' });
      }
      if (Buffer.byteLength(code, 'utf8') > 65536) {
        return res.status(413).json({ success: false, error: 'code exceeds the 64KB maximum limit' });
      }
      activeCode = code.trim();
    } else if (storeSubmission?.code) {
      activeCode = storeSubmission.code;
    } else if (dbSubmission?.code) {
      activeCode = dbSubmission.code;
    }

    // If no submissionId and no code provided, reject with submissionId is required
    if (!storeSubmission && !dbSubmission && !activeCode && !activeSubmissionId) {
      return res.status(400).json({ success: false, error: 'submissionId is required', code: 'INVALID_SUBMISSION_ID' });
    }

    // 2. Resolve active learnerId
    let activeLearnerId = (bodyLearnerId && typeof bodyLearnerId === 'string' && bodyLearnerId.trim() !== '')
      ? bodyLearnerId.trim()
      : (req.headers['x-learner-id'] || dbSubmission?.learner_id || null);

    if (!activeLearnerId) {
      return res.status(400).json({ success: false, error: 'learnerId is required' });
    }

    // If submissionId was provided but not found anywhere and no code was provided
    if (activeSubmissionId && !storeSubmission && !dbSubmission && !activeCode) {
      return res.status(404).json({ success: false, error: 'Submission not found', code: 'SUBMISSION_NOT_FOUND' });
    }

    // Create session entry if only code was passed
    if (!storeSubmission && !dbSubmission) {
      activeSubmissionId = activeSubmissionId || `sub-hint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      storeSubmission = store.saveSubmission({
        id: activeSubmissionId,
        learnerId: activeLearnerId,
        challengeId: challengeId || 'sum-array',
        language: language || 'javascript',
        code: activeCode
      });
    }

    // 4. Prevent level skipping using server-side state (authoritative records)
    let highestLevelUsed = 0;
    if (activeSubmissionId) {
      highestLevelUsed = store.getHighestHintLevel(activeSubmissionId);
      if (dbSubmission) {
        try {
          const maxDb = db.prepare('SELECT MAX(hint_level) as maxLevel FROM hint_history WHERE submission_id = ?').get(activeSubmissionId);
          if (maxDb?.maxLevel) {
            highestLevelUsed = Math.max(highestLevelUsed, maxDb.maxLevel);
          }
        } catch {}
      }
    }

    // Repeated request check: if learner asks for an already unlocked level, return stored hint
    if (level <= highestLevelUsed) {
      const existingStoreHint = store.getHintByLevel(activeSubmissionId, level);
      if (existingStoreHint) {
        return res.status(200).json({
          success: true,
          hintLevel: level,
          hint: existingStoreHint.hintText,
          isFallback: existingStoreHint.isFallback,
          data: {
            hintLevel: level,
            hint: existingStoreHint.hintText,
            isFallback: existingStoreHint.isFallback,
            isRepeated: true
          }
        });
      }
      if (dbSubmission) {
        try {
          const existingDbHint = db.prepare('SELECT * FROM hint_history WHERE submission_id = ? AND hint_level = ?').get(activeSubmissionId, level);
          if (existingDbHint) {
            return res.status(200).json({
              success: true,
              hintLevel: level,
              hint: existingDbHint.hint_text,
              isFallback: Boolean(existingDbHint.is_fallback),
              data: {
                hintLevel: level,
                hint: existingDbHint.hint_text,
                isFallback: Boolean(existingDbHint.is_fallback),
                isRepeated: true
              }
            });
          }
        } catch {}
      }
    }

    // Enforce sequential progression
    if (level > highestLevelUsed + 1) {
      return res.status(400).json({
        success: false,
        error: `Cannot skip hint levels. Next available hint level is ${highestLevelUsed + 1}`,
        code: 'CANNOT_SKIP_HINT_LEVELS'
      });
    }

    // 5. Resolve challenge details & fallback
    const targetChallengeId = storeSubmission?.challengeId || dbSubmission?.challenge_id || challengeId;
    const seedChallenge = getChallengeById(targetChallengeId);

    const safeTitle = challengeTitle || dbChallenge?.title || seedChallenge?.title || 'Coding Challenge';
    const safeDesc = challengeDescription || dbChallenge?.description || seedChallenge?.description || 'Solve the challenge.';
    const activeLanguage = language || storeSubmission?.language || dbSubmission?.language || 'javascript';

    const fallbackHint = (dbChallenge && (
        level === 1 ? dbChallenge.hint_level_1 :
        level === 2 ? dbChallenge.hint_level_2 :
        dbChallenge.hint_level_3
      )) ||
      (seedChallenge?.hintFallbacks?.[level]) ||
      (level === 1
        ? 'Think carefully about how your algorithm starts and how your loop initializes.'
        : level === 2
        ? 'Check your boundary conditions and verify your loop counter does not exceed the valid range.'
        : 'Inspect the comparison operator in your condition (< vs <=) to ensure correct index access.');

    // 6. Security filter: STRICTLY EXCLUDE HIDDEN TESTS
    let publicResults = [];
    if (dbSubmission) {
      try {
        publicResults = db.prepare(`
          SELECT status, stdout, stderr, is_public
          FROM test_results
          WHERE submission_id = ? AND is_public = 1
        `).all(activeSubmissionId);
      } catch {}
    } else if (storeSubmission?.testResults) {
      publicResults = storeSubmission.testResults.filter(t => t && t.isPublic !== false);
    }

    const safePublicExamples = Array.isArray(publicExamples)
      ? publicExamples.filter(ex => ex && ex.isPublic !== false)
      : (seedChallenge ? (seedChallenge.publicTestCases || []) : []);

    // 7. Call Gemini Service
    const aiResult = await geminiService.generateHint({
      challengeTitle: safeTitle,
      challengeDescription: safeDesc,
      language: activeLanguage,
      hintLevel: level,
      code: activeCode,
      publicTestResults: publicResults,
      publicExamples: safePublicExamples,
      executionSummary: executionSummary || '',
      fallbackHint
    });

    // 8. Record in server-side hint history
    store.saveHintHistory({
      learnerId: activeLearnerId,
      submissionId: activeSubmissionId,
      challengeId: targetChallengeId,
      hintLevel: level,
      hintText: aiResult.hintText,
      isFallback: aiResult.isFallback
    });

    store.updateProgress(activeLearnerId, targetChallengeId, {
      hintUsed: true
    });

    if (dbSubmission) {
      try {
        const hintId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO hint_history (
            id, learner_id, submission_id, challenge_id, hint_level, hint_text, is_fallback
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          hintId,
          activeLearnerId,
          activeSubmissionId,
          dbChallenge?.id || targetChallengeId,
          level,
          aiResult.hintText,
          aiResult.isFallback ? 1 : 0
        );

        db.prepare(`
          UPDATE learner_progress
          SET hints_used = hints_used + 1
          WHERE learner_id = ? AND challenge_id = ?
        `).run(activeLearnerId, dbChallenge?.id || targetChallengeId);
      } catch (dbErr) {
        console.warn('[Hints] Non-fatal DB update error:', dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      hintLevel: level,
      hint: aiResult.hintText,
      isFallback: aiResult.isFallback,
      data: {
        hintLevel: level,
        hint: aiResult.hintText,
        isFallback: aiResult.isFallback
      }
    });
  } catch (error) {
    console.error('Error in /api/hints:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while generating hint',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/hints/explain-before-fix
 * Backward-compatible alias for Explain Before You Fix reflection.
 */
router.post('/explain-before-fix', async (req, res) => {
  try {
    const { submissionId, explanation = '', prediction = '' } = req.body || {};

    let challenge = null;
    if (submissionId) {
      try {
        const sub = db.prepare('SELECT challenge_id FROM submissions WHERE id = ?').get(submissionId);
        if (sub) {
          challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(sub.challenge_id);
        }
      } catch {}
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
      success: false,
      error: 'Failed to process explanation',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
