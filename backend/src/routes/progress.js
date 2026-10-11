import express from 'express';
import { store } from '../data/store.js';

const router = express.Router();

/**
 * GET /api/progress/:learnerId
 * Retrieves learner progress, attempt metrics, and recurring mistake patterns.
 */
router.get('/:learnerId', (req, res) => {
  try {
    const { learnerId } = req.params;

    if (!learnerId || typeof learnerId !== 'string') {
      return res.status(400).json({ success: false, error: 'learnerId is required' });
    }

    const summary = store.getLearnerSummary(learnerId);

    return res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error in /api/progress/:learnerId:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching progress'
    });
  }
});

export default router;
