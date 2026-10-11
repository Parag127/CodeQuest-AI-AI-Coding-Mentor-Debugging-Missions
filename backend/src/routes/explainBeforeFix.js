import express from 'express';
import { geminiService } from '../services/geminiService.js';
import { store } from '../data/store.js';
import { getChallengeById } from '../data/seedChallenges.js';

const router = express.Router();

const MAX_EXPLANATION_LENGTH = 4000;
const MAX_CODE_BYTES = 65536;

/**
 * POST /api/explain-before-fix/question
 * Generates a targeted question asking the learner to predict a value, explain a condition,
 * or identify the likely cause before seeing hints or solutions.
 *
 * Accepts:
 * {
 *   submissionId?: string,
 *   learnerId: string,
 *   code?: string,
 *   language?: 'java' | 'javascript',
 *   challengeId?: string,
 *   challengeTitle?: string,
 *   challengeDescription?: string,
 *   publicExamples?: Array,
 *   executionResults?: Object,
 *   bugFingerprints?: Array<string>
 * }
 */
router.post('/question', async (req, res) => {
  try {
    const {
      submissionId,
      learnerId,
      code,
      language = 'javascript',
      challengeId,
      challengeTitle,
      challengeDescription,
      publicExamples,
      executionResults,
      bugFingerprints
    } = req.body;

    if (!learnerId || typeof learnerId !== 'string' || learnerId.trim() === '') {
      return res.status(400).json({ success: false, error: 'learnerId is required' });
    }

    let activeSubmissionId = submissionId ? String(submissionId).trim() : null;
    let submission = null;
    if (activeSubmissionId) {
      submission = store.getSubmission(activeSubmissionId);
    }

    let activeCode = '';
    if (code !== undefined) {
      if (typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'code must be a string' });
      }
      if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
        return res.status(413).json({ success: false, error: 'code exceeds the 64KB maximum limit' });
      }
      activeCode = code.trim();
    } else if (submission && submission.code) {
      activeCode = submission.code;
    }

    if (!submission && !activeCode && !executionResults && !activeSubmissionId) {
      return res.status(400).json({ success: false, error: 'submissionId, code, or executionResults is required' });
    }

    if (activeSubmissionId && !submission && !activeCode && !executionResults) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    if (!submission && (activeCode || executionResults)) {
      activeSubmissionId = activeSubmissionId || `sub-ebyf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      submission = store.saveSubmission({
        id: activeSubmissionId,
        learnerId: learnerId.trim(),
        challengeId: challengeId || 'sum-array',
        language: language || 'javascript',
        code: activeCode,
        executionResults: executionResults || null
      });
    }

    // Resolve challenge metadata & public examples
    const seed = challengeId ? getChallengeById(challengeId) : null;
    const resolvedTitle = challengeTitle || (seed ? seed.title : (submission ? submission.challengeTitle : 'Coding Challenge'));
    const resolvedDescription = challengeDescription || (seed ? seed.description : '');
    const resolvedExamples = publicExamples || (seed ? seed.publicExamples : []);

    // Resolve authoritative execution results (strictly sanitized of hidden test cases)
    const resolvedExecResults = executionResults || (submission ? (submission.executionResults || {
      status: submission.status || 'wrong_output',
      passCount: submission.passCount || 0,
      failCount: submission.failCount || 1,
      totalTests: submission.totalTests || 1,
      testResults: submission.testResults || []
    }) : {});

    // Resolve bug fingerprints
    let resolvedFingerprints = Array.isArray(bugFingerprints) ? bugFingerprints : [];
    if (!resolvedFingerprints.length && activeSubmissionId) {
      const recorded = store.getBugFingerprintsByLearner(learnerId.trim());
      resolvedFingerprints = recorded.map(r => r.patternKey);
    }

    const questionResult = await geminiService.generateEbyfQuestion({
      code: activeCode,
      language: (submission && submission.language) || language,
      challengeTitle: resolvedTitle,
      challengeDescription: resolvedDescription,
      publicExamples: resolvedExamples,
      executionResults: resolvedExecResults,
      bugFingerprints: resolvedFingerprints
    });

    const savedQuestion = store.saveEbyfQuestion({
      submissionId: activeSubmissionId,
      learnerId: learnerId.trim(),
      question: questionResult.question,
      questionType: questionResult.questionType,
      context: questionResult.context,
      isFallback: questionResult.isFallback
    });

    return res.status(200).json({
      success: true,
      data: {
        questionId: savedQuestion.id,
        submissionId: activeSubmissionId,
        question: questionResult.question,
        questionType: questionResult.questionType,
        context: questionResult.context,
        isFallback: questionResult.isFallback
      }
    });
  } catch (error) {
    console.error('Error in POST /api/explain-before-fix/question:', error);
    return res.status(500).json({ success: false, error: 'Internal server error while generating question' });
  }
});

/**
 * GET /api/explain-before-fix/question
 * Fetches existing or generated question for a submission.
 */
router.get('/question', async (req, res) => {
  try {
    const { submissionId, learnerId } = req.query;

    if (!submissionId || !learnerId) {
      return res.status(400).json({ success: false, error: 'submissionId and learnerId are required query parameters' });
    }

    const existing = store.getEbyfQuestion(learnerId, submissionId);
    if (existing) {
      return res.status(200).json({
        success: true,
        data: {
          questionId: existing.id,
          submissionId: existing.submissionId,
          question: existing.question,
          questionType: existing.questionType,
          context: existing.context,
          isFallback: existing.isFallback
        }
      });
    }

    const submission = store.getSubmission(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    const questionResult = await geminiService.generateEbyfQuestion({
      code: submission.code || '',
      language: submission.language || 'javascript',
      challengeTitle: submission.challengeTitle || 'Coding Challenge',
      executionResults: submission.executionResults || { status: 'wrong_output' },
      bugFingerprints: store.getBugFingerprintsByLearner(learnerId).map(b => b.patternKey)
    });

    const saved = store.saveEbyfQuestion({
      submissionId,
      learnerId,
      question: questionResult.question,
      questionType: questionResult.questionType,
      context: questionResult.context,
      isFallback: questionResult.isFallback
    });

    return res.status(200).json({
      success: true,
      data: {
        questionId: saved.id,
        submissionId,
        question: questionResult.question,
        questionType: questionResult.questionType,
        context: questionResult.context,
        isFallback: questionResult.isFallback
      }
    });
  } catch (error) {
    console.error('Error in GET /api/explain-before-fix/question:', error);
    return res.status(500).json({ success: false, error: 'Internal server error while fetching question' });
  }
});

/**
 * POST /api/explain-before-fix
 * Evaluates the learner's explanation against the known concept and observed execution result.
 * Accepts reasonable alternative explanations.
 *
 * Request:
 * {
 *   submissionId: string,
 *   learnerId: string,
 *   explanation: string,
 *   predictedVariable?: string,
 *   predictedValue?: string,
 *   code?: string,
 *   language?: string
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      submissionId,
      learnerId,
      explanation,
      predictedVariable,
      predictedValue,
      code,
      language
    } = req.body;

    if (!submissionId) {
      return res.status(400).json({ success: false, error: 'submissionId is required' });
    }

    if (!learnerId) {
      return res.status(400).json({ success: false, error: 'learnerId is required' });
    }

    if (!explanation || typeof explanation !== 'string' || explanation.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an explanation of what you think is wrong (at least 5 characters)'
      });
    }

    if (explanation.length > MAX_EXPLANATION_LENGTH) {
      return res.status(413).json({
        success: false,
        error: `explanation exceeds maximum allowable length of ${MAX_EXPLANATION_LENGTH} characters`
      });
    }

    if (code !== undefined) {
      if (typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'code must be a string' });
      }
      if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
        return res.status(413).json({ success: false, error: 'code exceeds the 64KB maximum limit' });
      }
    }

    // Lookup or register submission
    let submission = store.getSubmission(submissionId);
    if (!submission) {
      if (code) {
        submission = store.saveSubmission({
          id: submissionId,
          learnerId: learnerId.trim(),
          challengeId: 'sum-array',
          language: language || 'javascript',
          code: code.trim()
        });
      } else {
        return res.status(404).json({ success: false, error: 'Submission not found' });
      }
    }

    // Lookup stored question if any
    const storedQuestion = store.getEbyfQuestion(learnerId, submissionId);

    // Retrieve bug fingerprints
    const recordedBugs = store.getBugFingerprintsByLearner(learnerId.trim());
    const fingerprints = recordedBugs.map(b => b.patternKey);

    // Evaluate the learner's explanation
    const evaluationResult = await geminiService.evaluateEbyfExplanation({
      explanation: explanation.trim(),
      predictedVariable: predictedVariable ? String(predictedVariable).trim() : '',
      predictedValue: predictedValue ? String(predictedValue).trim() : '',
      question: storedQuestion ? storedQuestion.question : '',
      code: submission.code || (code ? code.trim() : ''),
      language: submission.language || language || 'javascript',
      challengeTitle: submission.challengeTitle || 'Coding Challenge',
      executionResults: submission.executionResults || { status: 'wrong_output' },
      bugFingerprints: fingerprints
    });

    // Save reflection record in store
    store.saveEbyf({
      submissionId,
      learnerId: learnerId.trim(),
      explanation: explanation.trim(),
      predictedVariable: predictedVariable || '',
      predictedValue: predictedValue || '',
      question: storedQuestion ? storedQuestion.question : null,
      evaluation: evaluationResult.evaluation,
      understoodCorrectly: evaluationResult.understoodCorrectly,
      toReconsider: evaluationResult.toReconsider,
      feedback: evaluationResult.feedback,
      canProceedToHint: true,
      isFallback: evaluationResult.isFallback
    });

    return res.status(200).json({
      success: true,
      data: {
        feedback: evaluationResult.feedback,
        evaluation: evaluationResult.evaluation,
        understoodCorrectly: evaluationResult.understoodCorrectly,
        toReconsider: evaluationResult.toReconsider,
        canProceedToHint: true,
        isFallback: evaluationResult.isFallback
      }
    });
  } catch (error) {
    console.error('Error in /api/explain-before-fix:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while processing explanation'
    });
  }
});

/**
 * GET /api/explain-before-fix/status/:learnerId/:submissionId
 * Returns whether the learner has completed the EBYF reflection step.
 */
router.get('/status/:learnerId/:submissionId', (req, res) => {
  const { learnerId, submissionId } = req.params;
  const completed = store.hasCompletedEbyf(learnerId, submissionId);
  const record = store.getEbyf(learnerId, submissionId);

  return res.status(200).json({
    success: true,
    data: {
      hasCompletedEbyf: completed,
      record: record || null
    }
  });
});

export default router;
