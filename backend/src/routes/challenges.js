import express from 'express';
import db from '../db/index.js';
import {
  validateChallengeId,
  toPublicChallengeSummary,
  toPublicChallengeDetail
} from '../models/challengeModel.js';

const router = express.Router();

/**
 * GET /api/challenges
 * Returns catalog of active challenges using the public summary model.
 * Whitelists ID, title, difficulty, concept, and supported languages.
 * Completely excludes internal DB metadata, starter code, hints, and test cases.
 * 
 * Response 200 format:
 * { "challenges": [ { id, title, difficulty, concept, languages } ] }
 */
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, title, difficulty, concept, languages
      FROM challenges
      ORDER BY rowid ASC
    `).all();

    // Map each internal row to the strict public summary model
    const challenges = rows.map(toPublicChallengeSummary);

    res.json({
      success: true,
      data: challenges,
      challenges
    });
  } catch (error) {
    console.error('Error fetching challenges catalog:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve challenges'
      }
    });
  }
});

/**
 * GET /api/challenges/:id
 * Returns single challenge specification with starter code and visible tests only.
 * Validates the ID parameter and strictly isolates hidden edge-case tests on the server.
 * 
 * Response 200 format:
 * { "challenge": { id, title, difficulty, concept, description, languages, starterCode, visibleTests } }
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  // 1. Validate route parameter
  const validation = validateChallengeId(id);
  if (!validation.valid) {
    return res.status(400).json({
      error: {
        code: 'INVALID_CHALLENGE_ID',
        message: validation.error
      }
    });
  }

  const cleanId = validation.id;

  try {
    // 2. Fetch challenge record from database
    const challengeRow = db.prepare(`
      SELECT id, title, description, difficulty, concept, languages,
             starter_code_javascript, starter_code_java
      FROM challenges
      WHERE id = ?
    `).get(cleanId);

    if (!challengeRow) {
      return res.status(404).json({
        error: {
          code: 'CHALLENGE_NOT_FOUND',
          message: `Challenge '${cleanId}' not found`
        }
      });
    }

    // 3. Load ONLY visible (is_public = 1) test cases.
    // Hidden tests (is_public = 0) are strictly excluded from the query.
    const visibleTests = db.prepare(`
      SELECT id, stdin, expected_output AS expectedStdout
      FROM test_cases
      WHERE challenge_id = ? AND is_public = 1
      ORDER BY ordinal ASC
    `).all(cleanId);

    // 4. Transform into public detail model (never serialize the raw DB entity)
    const publicChallenge = toPublicChallengeDetail(challengeRow, visibleTests);

    res.json({
      success: true,
      data: publicChallenge,
      challenge: publicChallenge
    });
  } catch (error) {
    console.error(`Error fetching challenge ${cleanId}:`, error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve challenge details'
      }
    });
  }
});

export default router;
