import express from 'express';
import db from '../db/index.js';

const router = express.Router();

/**
 * GET /api/challenges
 * Returns list of active challenges.
 * Format adheres to API_CONTRACT.md:
 * { "challenges": [ { id, title, difficulty, concept, languages } ] }
 */
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, title, difficulty, concept, languages
      FROM challenges
      ORDER BY rowid ASC
    `).all();

    const challenges = rows.map(row => {
      let languages = [];
      try {
        languages = JSON.parse(row.languages);
      } catch {
        languages = [row.languages];
      }

      return {
        id: row.id,
        title: row.title,
        difficulty: row.difficulty,
        concept: row.concept || 'general',
        languages
      };
    });

    res.json({
      challenges
    });
  } catch (error) {
    console.error('Error fetching challenges:', error);
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
 * Returns single challenge specification with visible tests only.
 * Format adheres to API_CONTRACT.md:
 * { "challenge": { id, title, difficulty, concept, description, languages, starterCode, visibleTests } }
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const challenge = db.prepare(`
      SELECT *
      FROM challenges
      WHERE id = ?
    `).get(id);

    if (!challenge) {
      return res.status(404).json({
        error: {
          code: 'CHALLENGE_NOT_FOUND',
          message: `Challenge '${id}' not found`
        }
      });
    }

    // Load ONLY visible (public) test cases
    const visibleTests = db.prepare(`
      SELECT id, stdin, expected_output AS expectedStdout
      FROM test_cases
      WHERE challenge_id = ? AND is_public = 1
      ORDER BY ordinal ASC
    `).all(id);

    let languages = [];
    try {
      languages = JSON.parse(challenge.languages);
    } catch {
      languages = [challenge.languages];
    }

    res.json({
      challenge: {
        id: challenge.id,
        title: challenge.title,
        difficulty: challenge.difficulty,
        concept: challenge.concept || 'general',
        description: challenge.description,
        languages,
        starterCode: {
          javascript: challenge.starter_code_javascript,
          java: challenge.starter_code_java
        },
        visibleTests
      }
    });
  } catch (error) {
    console.error(`Error fetching challenge ${id}:`, error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve challenge details'
      }
    });
  }
});

export default router;
