import express from 'express';
import { geminiService } from '../services/geminiService.js';
import { store } from '../data/store.js';
import { getChallengeById } from '../data/seedChallenges.js';

const router = express.Router();

/**
 * POST /api/hints
 * Progressive 3-level hinting endpoint.
 *
 * Accepts:
 * {
 *   hintLevel: 1 | 2 | 3,
 *   learnerId: string,
 *   submissionId?: string,
 *   code?: string,
 *   language?: 'java' | 'javascript',
 *   challengeId?: string,
 *   challengeTitle?: string,
 *   challengeDescription?: string,
 *   publicExamples?: Array<{ stdin: string, expected_output: string, isPublic?: boolean }>,
 *   executionSummary?: string | Object
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      hintLevel,
      learnerId,
      submissionId,
      code,
      language,
      challengeId,
      challengeTitle,
      challengeDescription,
      publicExamples,
      executionSummary
    } = req.body;

    // 1. Validate hintLevel (Requirement 1 & 4)
    if (hintLevel === undefined || hintLevel === null) {
      return res.status(400).json({ success: false, error: 'hintLevel is required' });
    }
    const level = Number(hintLevel);
    if (!Number.isInteger(level) || level < 1 || level > 3) {
      return res.status(400).json({ success: false, error: 'hintLevel must be 1, 2, or 3' });
    }

    // 2. Validate learnerId
    if (!learnerId || typeof learnerId !== 'string' || learnerId.trim() === '') {
      return res.status(400).json({ success: false, error: 'learnerId is required' });
    }

    // 3. Resolve or validate submission & code (Requirement 4: input size validation)
    let submission = null;
    let activeSubmissionId = submissionId ? String(submissionId).trim() : null;

    if (activeSubmissionId) {
      submission = store.getSubmission(activeSubmissionId);
    }

    // Validate code if passed in body
    let activeCode = '';
    if (code !== undefined) {
      if (typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'code must be a string' });
      }
      if (Buffer.byteLength(code, 'utf8') > 65536) {
        return res.status(413).json({ success: false, error: 'code exceeds the 64KB maximum limit' });
      }
      activeCode = code.trim();
    } else if (submission && submission.code) {
      activeCode = submission.code;
    }

    // If no existing submission and no code provided, reject
    if (!submission && !activeCode && !activeSubmissionId) {
      return res.status(400).json({ success: false, error: 'submissionId is required' });
    }

    // If submissionId was provided but not found and no code was provided
    if (activeSubmissionId && !submission && !activeCode) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    // If submission was not already in store but code was provided, create session entry to track server-side state
    if (!submission) {
      activeSubmissionId = activeSubmissionId || `sub-hint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      submission = store.saveSubmission({
        id: activeSubmissionId,
        learnerId: learnerId.trim(),
        challengeId: challengeId || 'sum-array',
        language: language || 'javascript',
        code: activeCode
      });
    }

    // 4. Prevent level skipping using server-side state (Requirement 5)
    // Never trust client-supplied counter; check authoritative server records
    const highestLevelUsed = store.getHighestHintLevel(activeSubmissionId);

    // Repeated request check: if learner asks for an already unlocked level, return stored hint
    if (level <= highestLevelUsed) {
      const existingHint = store.getHintByLevel(activeSubmissionId, level);
      if (existingHint) {
        return res.status(200).json({
          success: true,
          data: {
            hintLevel: level,
            hint: existingHint.hintText,
            isFallback: existingHint.isFallback,
            isRepeated: true
          }
        });
      }
    }

    // Enforce sequential progression
    if (level > highestLevelUsed + 1) {
      return res.status(400).json({
        success: false,
        error: `Cannot skip hint levels. Next available hint level is ${highestLevelUsed + 1}`
      });
    }

    // 5. Resolve challenge details & safe fallback
    const targetChallengeId = submission.challengeId || challengeId;
    const challenge = getChallengeById(targetChallengeId);

    const safeTitle = challengeTitle || (challenge ? challenge.title : 'Coding Challenge');
    const safeDesc = challengeDescription || (challenge ? challenge.description : 'Solve the challenge.');
    const activeLanguage = language || submission.language || 'javascript';

    // Static fallback for this level
    const fallbackHint = (challenge && challenge.hintFallbacks && challenge.hintFallbacks[level]) ||
      (level === 1
        ? 'Think carefully about how your algorithm starts and how your loop initializes.'
        : level === 2
        ? 'Check your boundary conditions and verify your loop counter does not exceed the valid range.'
        : 'Inspect the comparison operator in your condition (< vs <=) to ensure correct index access.');

    // 6. Security filter: STRICTLY EXCLUDE HIDDEN TESTS (Requirement 3)
    // Only pass public test failures and learner-visible examples
    const publicResults = (submission.testResults || []).filter(t => t && t.isPublic !== false);
    const safePublicExamples = Array.isArray(publicExamples)
      ? publicExamples.filter(ex => ex && ex.isPublic !== false)
      : (challenge ? (challenge.publicTestCases || []) : []);

    // 7. Call Gemini Service (Requirement 1, 3, 6)
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
      learnerId: learnerId.trim(),
      submissionId: activeSubmissionId,
      challengeId: targetChallengeId,
      hintLevel: level,
      hintText: aiResult.hintText,
      isFallback: aiResult.isFallback
    });

    store.updateProgress(learnerId.trim(), targetChallengeId, {
      hintUsed: true
    });

    return res.status(200).json({
      success: true,
      data: {
        hintLevel: level,
        hint: aiResult.hintText,
        isFallback: aiResult.isFallback
      }
    });
  } catch (error) {
    console.error('Error in /api/hints:', error);
    return res.status(500).json({ success: false, error: 'Internal server error while generating hint' });
  }
});

export default router;
