import express from 'express';
import { getAdaptiveRecommendation } from '../services/recommendationService.js';

const router = express.Router();

/**
 * GET /api/recommendations/:learnerId
 * Recommends an adaptive challenge for the specified learner based on progress and mistake telemetry.
 */
router.get('/:learnerId', (req, res) => {
  try {
    const { learnerId } = req.params;
    const { currentChallengeId, allowReview } = req.query;

    if (!learnerId || learnerId.trim() === '') {
      return res.status(400).json({ success: false, error: 'learnerId is required' });
    }

    const recommendation = getAdaptiveRecommendation({
      learnerId: learnerId.trim(),
      currentChallengeId: currentChallengeId ? String(currentChallengeId).trim() : null,
      allowReview: allowReview === 'true' || allowReview === true
    });

    return res.status(200).json({
      success: true,
      data: recommendation
    });
  } catch (err) {
    if (err.message && err.message.includes('learnerId is required')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    console.error('Error in GET /api/recommendations/:learnerId:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while generating recommendation' });
  }
});

/**
 * POST /api/recommendations
 * Supports recommendation queries with request body payload.
 */
router.post('/', (req, res) => {
  try {
    const { learnerId, currentChallengeId, allowReview } = req.body;

    if (!learnerId || typeof learnerId !== 'string' || learnerId.trim() === '') {
      return res.status(400).json({ success: false, error: 'learnerId is required' });
    }

    const recommendation = getAdaptiveRecommendation({
      learnerId: learnerId.trim(),
      currentChallengeId: currentChallengeId ? String(currentChallengeId).trim() : null,
      allowReview: Boolean(allowReview)
    });

    return res.status(200).json({
      success: true,
      data: recommendation
    });
  } catch (err) {
    if (err.message && err.message.includes('learnerId is required')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    console.error('Error in POST /api/recommendations:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while generating recommendation' });
  }
});

export default router;
