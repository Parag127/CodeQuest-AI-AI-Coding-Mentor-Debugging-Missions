import express from 'express';
import { geminiService } from '../services/geminiService.js';
import { store } from '../data/store.js';

const router = express.Router();

/**
 * POST /api/explain-before-fix
 * Request: { submissionId, learnerId, explanation, predictedVariable, predictedValue }
 * Response: { success: true, data: { feedback, canProceedToHint: true } }
 */
router.post('/', async (req, res) => {
  try {
    const { submissionId, learnerId, explanation, predictedVariable, predictedValue } = req.body;

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

    // Lookup submission
    const submission = store.getSubmission(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    // Call Gemini Service for non-evaluative feedback
    const aiFeedback = await geminiService.generateEbyfFeedback({
      explanation: explanation.trim(),
      predictedVariable: predictedVariable ? String(predictedVariable).trim() : '',
      predictedValue: predictedValue ? String(predictedValue).trim() : ''
    });

    // Save reflection to store
    store.saveEbyf({
      submissionId,
      learnerId,
      explanation: explanation.trim(),
      predictedVariable: predictedVariable || '',
      predictedValue: predictedValue || '',
      feedback: aiFeedback.feedback
    });

    return res.status(200).json({
      success: true,
      data: {
        feedback: aiFeedback.feedback,
        canProceedToHint: true
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

export default router;
