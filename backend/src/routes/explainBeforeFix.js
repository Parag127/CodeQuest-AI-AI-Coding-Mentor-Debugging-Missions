import express from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
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

    const trimmedLearnerId = learnerId.trim();
    let activeSubmissionId = submissionId ? String(submissionId).trim() : null;
    let submission = null;
    let dbSub = null;

    if (activeSubmissionId) {
      submission = store.getSubmission(activeSubmissionId);
      try {
        dbSub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(activeSubmissionId);
        if (dbSub) {
          // Ownership verification
          if (dbSub.learner_id && dbSub.learner_id !== trimmedLearnerId) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to submission' });
          }
          if (!submission) {
            submission = {
              id: dbSub.id,
              learnerId: dbSub.learner_id,
              challengeId: dbSub.challenge_id,
              language: dbSub.language,
              code: dbSub.code,
              status: dbSub.status,
              passCount: dbSub.pass_count,
              failCount: dbSub.fail_count
            };
          }
        }
      } catch {}
    }

    // Ownership verification for store submission
    if (submission && submission.learnerId && submission.learnerId !== trimmedLearnerId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to submission' });
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
        learnerId: trimmedLearnerId,
        challengeId: challengeId || 'sum-array',
        language: language || 'javascript',
        code: activeCode,
        executionResults: executionResults || null
      });
    }

    // Resolve challenge metadata & public examples
    const seed = challengeId ? getChallengeById(challengeId) : null;
    let dbChallenge = null;
    if (challengeId || submission?.challengeId) {
      try {
        dbChallenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId || submission.challengeId);
      } catch {}
    }

    const resolvedTitle = challengeTitle || (seed ? seed.title : (dbChallenge ? dbChallenge.title : (submission ? submission.challengeTitle : 'Coding Challenge')));
    const resolvedDescription = challengeDescription || (seed ? seed.description : (dbChallenge ? dbChallenge.description : ''));
    const resolvedExamples = publicExamples || (seed ? seed.publicExamples : []);

    // Resolve authoritative execution results (strictly sanitized of hidden test cases)
    let resolvedExecResults = executionResults || (submission ? (submission.executionResults || {
      status: submission.status || 'wrong_output',
      passCount: submission.passCount || 0,
      failCount: submission.failCount || 1,
      totalTests: submission.totalTests || 1,
      testResults: submission.testResults || []
    }) : {});

    // If test results are missing but available in DB, load public tests only
    if (activeSubmissionId && (!resolvedExecResults.testResults || !resolvedExecResults.testResults.length)) {
      try {
        const publicTests = db.prepare(`
          SELECT status, stdout, stderr, is_public
          FROM test_results
          WHERE submission_id = ? AND is_public = 1
        `).all(activeSubmissionId);
        if (publicTests && publicTests.length > 0) {
          resolvedExecResults = {
            ...resolvedExecResults,
            testResults: publicTests
          };
        }
      } catch {}
    }

    // Resolve bug fingerprints (merge store and DB)
    let resolvedFingerprints = Array.isArray(bugFingerprints) ? [...bugFingerprints] : [];
    if (!resolvedFingerprints.length && trimmedLearnerId) {
      const recorded = store.getBugFingerprintsByLearner(trimmedLearnerId);
      resolvedFingerprints = recorded.map(r => r.patternKey);
      try {
        const dbFingerprints = db.prepare('SELECT pattern_key FROM bug_fingerprints WHERE learner_id = ?').all(trimmedLearnerId);
        for (const df of dbFingerprints) {
          if (!resolvedFingerprints.includes(df.pattern_key)) {
            resolvedFingerprints.push(df.pattern_key);
          }
        }
      } catch {}
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
      learnerId: trimmedLearnerId,
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

    const trimmedLearnerId = String(learnerId).trim();
    const existing = store.getEbyfQuestion(trimmedLearnerId, submissionId);
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

    let submission = store.getSubmission(submissionId);
    let dbSub = null;
    try {
      dbSub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
      if (dbSub) {
        if (dbSub.learner_id && dbSub.learner_id !== trimmedLearnerId) {
          return res.status(403).json({ success: false, error: 'Unauthorized access to submission' });
        }
        if (!submission) {
          submission = {
            id: dbSub.id,
            learnerId: dbSub.learner_id,
            challengeId: dbSub.challenge_id,
            language: dbSub.language,
            code: dbSub.code,
            status: dbSub.status
          };
        }
      }
    } catch {}

    if (submission && submission.learnerId && submission.learnerId !== trimmedLearnerId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to submission' });
    }

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    const questionResult = await geminiService.generateEbyfQuestion({
      code: submission.code || '',
      language: submission.language || 'javascript',
      challengeTitle: submission.challengeTitle || 'Coding Challenge',
      executionResults: submission.executionResults || { status: 'wrong_output' },
      bugFingerprints: store.getBugFingerprintsByLearner(trimmedLearnerId).map(b => b.patternKey)
    });

    const saved = store.saveEbyfQuestion({
      submissionId,
      learnerId: trimmedLearnerId,
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

    const trimmedLearnerId = String(learnerId).trim();

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

    // Lookup submission from store and SQLite
    let submission = store.getSubmission(submissionId);
    let dbSub = null;
    try {
      dbSub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
      if (dbSub) {
        if (dbSub.learner_id && dbSub.learner_id !== trimmedLearnerId) {
          return res.status(403).json({ success: false, error: 'You do not have permission to reflect on this submission' });
        }
        if (!submission) {
          submission = {
            id: dbSub.id,
            learnerId: dbSub.learner_id,
            challengeId: dbSub.challenge_id,
            language: dbSub.language,
            code: dbSub.code,
            status: dbSub.status,
            passCount: dbSub.pass_count,
            failCount: dbSub.fail_count
          };
        }
      }
    } catch {}

    if (submission && submission.learnerId && submission.learnerId !== trimmedLearnerId) {
      return res.status(403).json({ success: false, error: 'You do not have permission to reflect on this submission' });
    }

    if (!submission) {
      if (code) {
        submission = store.saveSubmission({
          id: submissionId,
          learnerId: trimmedLearnerId,
          challengeId: 'sum-array',
          language: language || 'javascript',
          code: code.trim()
        });
      } else {
        return res.status(404).json({ success: false, error: 'Submission not found' });
      }
    }

    // Lookup stored question if any
    const storedQuestion = store.getEbyfQuestion(trimmedLearnerId, submissionId);

    // Retrieve bug fingerprints (merge store and DB)
    const recordedBugs = store.getBugFingerprintsByLearner(trimmedLearnerId);
    const fingerprints = recordedBugs.map(b => b.patternKey);
    try {
      const dbBugs = db.prepare('SELECT pattern_key FROM bug_fingerprints WHERE learner_id = ?').all(trimmedLearnerId);
      for (const dbb of dbBugs) {
        if (!fingerprints.includes(dbb.pattern_key)) {
          fingerprints.push(dbb.pattern_key);
        }
      }
    } catch {}

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

    const reflectionId = crypto.randomUUID();

    // Persist reflection record in SQLite ebyf_reflections
    try {
      // Respect foreign key integrity: only set references if the row exists in SQLite
      const targetSubId = dbSub ? submissionId : null;
      let targetChallengeId = null;
      const candidateChId = submission.challengeId || dbSub?.challenge_id;
      if (candidateChId) {
        const foundCh = db.prepare('SELECT id FROM challenges WHERE id = ?').get(candidateChId);
        if (foundCh) targetChallengeId = foundCh.id;
      }

      db.prepare(`
        INSERT INTO ebyf_reflections (
          id, learner_id, submission_id, challenge_id, question, question_type,
          explanation, predicted_variable, predicted_value, evaluation,
          understood_correctly, to_reconsider, feedback, can_proceed_to_hint, is_fallback
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reflectionId,
        trimmedLearnerId,
        targetSubId,
        targetChallengeId,
        storedQuestion ? storedQuestion.question : null,
        storedQuestion ? storedQuestion.questionType : null,
        explanation.trim(),
        predictedVariable ? String(predictedVariable).trim() : null,
        predictedValue ? String(predictedValue).trim() : null,
        evaluationResult.evaluation,
        evaluationResult.understoodCorrectly || null,
        evaluationResult.toReconsider || null,
        evaluationResult.feedback,
        1,
        evaluationResult.isFallback ? 1 : 0
      );

      // Update submissions explanation and prediction in SQLite if submission row exists
      if (dbSub) {
        const predText = predictedValue ? `${predictedVariable ? predictedVariable + ': ' : ''}${predictedValue}` : null;
        db.prepare(`
          UPDATE submissions
          SET explanation = ?, prediction = ?
          WHERE id = ?
        `).run(explanation.trim(), predText, submissionId);
      }
    } catch (dbErr) {
      console.warn('[EBYF] Non-fatal DB reflection insert skipped:', dbErr.message);
    }

    // Save reflection record in store
    store.saveEbyf({
      id: reflectionId,
      submissionId,
      learnerId: trimmedLearnerId,
      explanation: explanation.trim(),
      predictedVariable: predictedVariable || '',
      predictedValue: predictedValue || '',
      question: storedQuestion ? storedQuestion.question : null,
      questionType: storedQuestion ? storedQuestion.questionType : null,
      challengeId: submission.challengeId || null,
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
  const trimmedLearnerId = String(learnerId).trim();
  let completed = store.hasCompletedEbyf(trimmedLearnerId, submissionId);
  let record = store.getEbyf(trimmedLearnerId, submissionId);

  if (!completed) {
    try {
      const dbRow = db.prepare(`
        SELECT * FROM ebyf_reflections
        WHERE learner_id = ? AND submission_id = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(trimmedLearnerId, submissionId);
      if (dbRow) {
        completed = true;
        record = {
          id: dbRow.id,
          learnerId: dbRow.learner_id,
          submissionId: dbRow.submission_id,
          challengeId: dbRow.challenge_id,
          question: dbRow.question,
          questionType: dbRow.question_type,
          explanation: dbRow.explanation,
          predictedVariable: dbRow.predicted_variable,
          predictedValue: dbRow.predicted_value,
          evaluation: dbRow.evaluation,
          understoodCorrectly: dbRow.understood_correctly,
          toReconsider: dbRow.to_reconsider,
          feedback: dbRow.feedback,
          canProceedToHint: Boolean(dbRow.can_proceed_to_hint),
          isFallback: Boolean(dbRow.is_fallback),
          createdAt: dbRow.created_at
        };
      }
    } catch {}
  }

  return res.status(200).json({
    success: true,
    data: {
      hasCompletedEbyf: completed,
      record: record || null
    }
  });
});

export default router;

