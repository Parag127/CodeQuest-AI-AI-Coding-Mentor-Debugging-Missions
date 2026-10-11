import express from 'express';
import { store } from '../data/store.js';
import db from '../db/index.js';
import { getLearnerConceptProgress } from '../services/recommendationService.js';

const router = express.Router();

/**
 * GET /api/progress/:learnerId
 * Retrieves learner progress, attempt metrics, and recurring mistake patterns.
 */
router.get('/:learnerId', (req, res) => {
  try {
    const { learnerId } = req.params;

    if (!learnerId || typeof learnerId !== 'string' || learnerId.trim() === '') {
      return res.status(400).json({ success: false, error: 'learnerId is required' });
    }

    const trimmedLearnerId = learnerId.trim();
    const summary = store.getLearnerSummary(trimmedLearnerId);

    // Merge with SQLite bug_fingerprints if available
    try {
      const dbMistakes = db.prepare(`
        SELECT pattern_key,
               COUNT(*) as count,
               SUM(CASE WHEN is_confirmed = 1 OR confidence = 'high' THEN 1 ELSE 0 END) as confirmed_count,
               SUM(CASE WHEN is_confirmed = 0 AND confidence != 'high' THEN 1 ELSE 0 END) as possible_count
        FROM bug_fingerprints
        WHERE learner_id = ?
        GROUP BY pattern_key
      `).all(trimmedLearnerId);

      if (dbMistakes && dbMistakes.length > 0) {
        const mistakeMap = new Map();
        for (const m of summary.recurringMistakes || []) {
          mistakeMap.set(m.patternKey, { ...m });
        }
        for (const dbm of dbMistakes) {
          const key = dbm.pattern_key;
          const existing = mistakeMap.get(key);
          if (existing) {
            existing.count = Math.max(existing.count, Number(dbm.count));
            existing.confirmedCount = Math.max(existing.confirmedCount || 0, Number(dbm.confirmed_count || 0));
            existing.possibleCount = Math.max(existing.possibleCount || 0, Number(dbm.possible_count || 0));
          } else {
            mistakeMap.set(key, {
              patternKey: key,
              count: Number(dbm.count),
              confirmedCount: Number(dbm.confirmed_count || 0),
              possibleCount: Number(dbm.possible_count || 0)
            });
          }
        }
        summary.recurringMistakes = Array.from(mistakeMap.values());
      }
    } catch (dbErr) {
      // Non-fatal fallback to store
    }

    // Merge EBYF reflection metrics from SQLite and store
    try {
      const dbReflections = db.prepare(`
        SELECT id, challenge_id, question_type, evaluation, can_proceed_to_hint, is_fallback, created_at
        FROM ebyf_reflections
        WHERE learner_id = ?
        ORDER BY created_at DESC
      `).all(trimmedLearnerId);

      const storeReflections = store.getEbyfByLearner ? store.getEbyfByLearner(trimmedLearnerId) : [];
      const totalCount = Math.max(dbReflections.length, storeReflections.length);

      summary.ebyf = {
        totalReflections: totalCount,
        evaluations: {
          correct: dbReflections.filter(r => r.evaluation === 'correct').length || storeReflections.filter(r => r.evaluation === 'correct').length,
          partiallyCorrect: dbReflections.filter(r => r.evaluation === 'partially_correct').length || storeReflections.filter(r => r.evaluation === 'partially_correct').length,
          incorrect: dbReflections.filter(r => r.evaluation === 'incorrect').length || storeReflections.filter(r => r.evaluation === 'incorrect').length
        },
        recent: dbReflections.slice(0, 5)
      };
    } catch (dbErr) {
      const storeReflections = store.getEbyfByLearner ? store.getEbyfByLearner(trimmedLearnerId) : [];
      summary.ebyf = {
        totalReflections: storeReflections.length,
        evaluations: {
          correct: storeReflections.filter(r => r.evaluation === 'correct').length,
          partiallyCorrect: storeReflections.filter(r => r.evaluation === 'partially_correct').length,
          incorrect: storeReflections.filter(r => r.evaluation === 'incorrect').length
        },
        recent: storeReflections.slice(0, 5)
      };
    }

    try {
      summary.concepts = getLearnerConceptProgress(trimmedLearnerId);
    } catch {
      summary.concepts = [];
    }

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
