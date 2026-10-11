import { getAllChallenges, getChallengeById } from '../data/seedChallenges.js';
import { store } from '../data/store.js';
import db from '../db/index.js';

/**
 * Strips private test suites from a challenge before returning it in recommendations.
 *
 * @param {Object} challenge
 * @returns {Object} Safe public challenge representation
 */
function sanitizeChallengeForRecommendation(challenge) {
  if (!challenge) return null;
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    difficulty: challenge.difficulty,
    concept: challenge.concept || 'general',
    skills: Array.isArray(challenge.skills) ? [...challenge.skills] : [],
    targetedPatterns: Array.isArray(challenge.targetedPatterns) ? [...challenge.targetedPatterns] : [],
    languages: Array.isArray(challenge.languages) ? [...challenge.languages] : ['javascript', 'java']
  };
}

/**
 * Maps a pattern key or category to a canonical concept.
 *
 * @param {string} key
 * @returns {string} Canonical concept name
 */
export function mapPatternToConcept(key) {
  if (!key) return 'general';
  const lower = String(key).toLowerCase();
  if (lower === 'loop_boundary' || lower === 'loop_condition' || lower === 'off_by_one' || lower.includes('loop')) {
    return 'loops';
  }
  if (lower === 'wrong_condition' || lower === 'boolean_logic' || lower.includes('condition')) {
    return 'conditions';
  }
  if (lower === 'wrong_index' || lower === 'array_index_error' || lower.includes('index') || lower.includes('array')) {
    return 'arrays';
  }
  if (lower === 'empty_input' || lower === 'empty_input_unhandled' || lower.includes('empty')) {
    return 'empty_input';
  }
  return 'general';
}

/**
 * Evaluates learner concept progress and positive evidence of learning across all canonical concepts.
 * Incorporates both in-memory store and SQLite database records.
 *
 * @param {string} learnerId
 * @returns {Array<Object>} List of concept summaries
 */
export function getLearnerConceptProgress(learnerId) {
  if (!learnerId || typeof learnerId !== 'string' || learnerId.trim() === '') {
    return [];
  }
  const normLearnerId = learnerId.trim();

  // 1. Gather all challenges (merging seed catalog and SQLite challenges)
  const catalog = [...getAllChallenges()];
  try {
    const dbChallenges = db.prepare('SELECT id, title, difficulty, concept FROM challenges').all();
    for (const dbc of dbChallenges) {
      if (!catalog.some(c => c.id === dbc.id)) {
        catalog.push({
          id: dbc.id,
          title: dbc.title,
          difficulty: dbc.difficulty || 'beginner',
          concept: mapPatternToConcept(dbc.concept),
          skills: [dbc.concept],
          targetedPatterns: [dbc.concept]
        });
      }
    }
  } catch {}
  const challengeMap = new Map(catalog.map(c => [c.id, c]));

  // 2. Fetch progress from store
  const storeSummary = store.getLearnerSummary(normLearnerId);
  const storeMistakes = store.getBugFingerprintsByLearner(normLearnerId);
  const progressMap = new Map();

  for (const cp of storeSummary.challenges || []) {
    progressMap.set(cp.challengeId, {
      challengeId: cp.challengeId,
      attempts: cp.attempts || 0,
      hintsUsed: cp.hintsUsed || 0,
      solved: Boolean(cp.solved)
    });
  }

  // 3. Merge SQLite database records if available
  try {
    const dbRows = db.prepare(`
      SELECT challenge_id, attempts, hints_used, solved
      FROM learner_progress
      WHERE learner_id = ?
    `).all(normLearnerId);

    for (const dbr of dbRows) {
      const existing = progressMap.get(dbr.challenge_id);
      if (existing) {
        existing.attempts = Math.max(existing.attempts, dbr.attempts || 0);
        existing.hintsUsed = Math.max(existing.hintsUsed, dbr.hints_used || 0);
        existing.solved = existing.solved || Boolean(dbr.solved);
      } else {
        progressMap.set(dbr.challenge_id, {
          challengeId: dbr.challenge_id,
          attempts: dbr.attempts || 0,
          hintsUsed: dbr.hints_used || 0,
          solved: Boolean(dbr.solved)
        });
      }
    }
  } catch {}

  // 4. Merge bug fingerprints from store and SQLite
  const allMistakes = [...storeMistakes];
  try {
    const dbBugs = db.prepare(`
      SELECT pattern_key, challenge_id
      FROM bug_fingerprints
      WHERE learner_id = ?
    `).all(normLearnerId);
    for (const dbb of dbBugs) {
      allMistakes.push({
        patternKey: dbb.pattern_key,
        challengeId: dbb.challenge_id
      });
    }
  } catch {}

  // 5. Canonical concepts to track
  const canonicalConcepts = ['loops', 'conditions', 'arrays', 'empty_input'];

  return canonicalConcepts.map(concept => {
    // Find challenges related to this concept
    const relatedChallenges = catalog.filter(c => {
      const cConcept = c.concept || '';
      const cPatterns = c.targetedPatterns || [];
      const cSkills = c.skills || [];
      return cConcept === concept ||
        cPatterns.some(p => mapPatternToConcept(p) === concept) ||
        cSkills.includes(concept);
    });

    let totalAttempts = 0;
    let hintsUsed = 0;
    let solvedCount = 0;
    let independentSolves = 0;
    let guidedSolves = 0;

    for (const ch of relatedChallenges) {
      const prog = progressMap.get(ch.id);
      if (prog) {
        totalAttempts += prog.attempts;
        hintsUsed += prog.hintsUsed;
        if (prog.solved) {
          solvedCount++;
          if (prog.hintsUsed === 0) {
            independentSolves++;
          } else {
            guidedSolves++;
          }
        }
      }
    }

    // Count recent mistakes matching this concept
    const conceptMistakes = allMistakes.filter(m => {
      const pKey = m.patternKey || m.category || '';
      return mapPatternToConcept(pKey) === concept;
    }).length;

    // Determine status:
    // Rule: Never mark mastered from just 1 solve. Requires >= 2 distinct independent solves and 0 recent mistakes.
    let status = 'not_started';
    if (totalAttempts === 0 && conceptMistakes === 0) {
      status = 'not_started';
    } else if (independentSolves >= 2 && conceptMistakes === 0) {
      status = 'mastered';
    } else if (conceptMistakes >= 2 || (totalAttempts >= 2 && solvedCount === 0)) {
      status = 'needs_practice';
    } else {
      status = 'practicing';
    }

    return {
      concept,
      status,
      attempts: totalAttempts,
      solvedCount,
      independentSolves,
      guidedSolves,
      hintsUsed,
      recentMistakes: conceptMistakes
    };
  });
}

/**
 * Recommends an existing challenge for a learner using transparent, deterministic rules.
 *
 * Rules:
 * 1. Validates learnerId.
 * 2. New learners or learners with 0 history receive the foundational beginner challenge.
 * 3. When a learner repeatedly fails a concept on a higher tier, prefer an easier/similar challenge.
 * 4. Learners with repeated bug fingerprints receive an unsolved challenge targeting remediation of that mistake.
 * 5. Learners with independent solves on beginner challenges progress to intermediate challenges.
 * 6. Completed challenges are never recommended repeatedly unless review is explicitly requested.
 * 7. Never invents challenge IDs: every recommended ID must exist in the catalog.
 *
 * @param {Object} options
 * @param {string} options.learnerId - Required unique learner identifier
 * @param {string} [options.currentChallengeId=null] - Challenge currently being viewed or attempted
 * @param {boolean} [options.allowReview=false] - Whether to allow recommending already solved challenges
 * @param {Array} [options.catalog=null] - Optional injected challenge catalog for testing
 * @returns {{ challenge: Object|null, reason: string, strategy: string, learnerId: string, catalogCompleted?: boolean }}
 */
export function getAdaptiveRecommendation({
  learnerId,
  currentChallengeId = null,
  allowReview = false,
  catalog = null
} = {}) {
  // 1. Validate learnerId
  if (!learnerId || typeof learnerId !== 'string' || learnerId.trim() === '') {
    throw new Error('learnerId is required and must be a non-empty string');
  }

  const normLearnerId = learnerId.trim();
  const availableCatalog = Array.isArray(catalog) ? catalog : getAllChallenges();

  if (!availableCatalog || availableCatalog.length === 0) {
    return {
      challenge: null,
      reason: 'No challenges are currently available in the catalog.',
      strategy: 'empty_catalog',
      learnerId: normLearnerId,
      catalogCompleted: false
    };
  }

  // 2. Fetch learner progress & mistake telemetry from store and DB
  const summary = store.getLearnerSummary(normLearnerId);
  const recordedMistakes = store.getBugFingerprintsByLearner(normLearnerId);

  // Merge SQLite DB progress & mistakes
  const progressMap = new Map();
  for (const cp of summary.challenges || []) {
    progressMap.set(cp.challengeId, { ...cp });
  }

  try {
    const dbProgress = db.prepare(`
      SELECT challenge_id, attempts, hints_used, best_pass_count, solved, last_attempt_at
      FROM learner_progress
      WHERE learner_id = ?
    `).all(normLearnerId);

    for (const dbr of dbProgress) {
      const existing = progressMap.get(dbr.challenge_id);
      if (existing) {
        existing.attempts = Math.max(existing.attempts || 0, dbr.attempts || 0);
        existing.hintsUsed = Math.max(existing.hintsUsed || 0, dbr.hints_used || 0);
        existing.solved = existing.solved || Boolean(dbr.solved);
        existing.bestPassCount = Math.max(existing.bestPassCount || 0, dbr.best_pass_count || 0);
      } else {
        progressMap.set(dbr.challenge_id, {
          challengeId: dbr.challenge_id,
          attempts: dbr.attempts || 0,
          hintsUsed: dbr.hints_used || 0,
          solved: Boolean(dbr.solved),
          bestPassCount: dbr.best_pass_count || 0
        });
      }
    }
  } catch {}

  const allRecordedMistakes = [...recordedMistakes];
  try {
    const dbMistakes = db.prepare(`
      SELECT pattern_key, challenge_id
      FROM bug_fingerprints
      WHERE learner_id = ?
    `).all(normLearnerId);
    for (const dbm of dbMistakes) {
      allRecordedMistakes.push({
        patternKey: dbm.pattern_key,
        challengeId: dbm.challenge_id
      });
    }
  } catch {}

  const solvedIds = new Set(
    Array.from(progressMap.values()).filter(c => c.solved).map(c => c.challengeId)
  );

  const unsolvedChallenges = availableCatalog.filter(c => !solvedIds.has(c.id));
  const hasAnyAttempts = Array.from(progressMap.values()).some(c => (c.attempts || 0) > 0) || allRecordedMistakes.length > 0;

  // 3. Rule A: New learner or missing history -> Sensible beginner-friendly default
  if (!hasAnyAttempts) {
    const beginnerChallenge = availableCatalog.find(c => c.difficulty === 'beginner') || availableCatalog[0];
    return {
      challenge: sanitizeChallengeForRecommendation(beginnerChallenge),
      reason: 'Recommended as an ideal starting challenge to practice fundamental array iteration and accumulator patterns.',
      strategy: 'new_learner_default',
      learnerId: normLearnerId,
      catalogCompleted: false
    };
  }

  // 4. Rule B: All challenges completed (no available unsolved challenges)
  if (unsolvedChallenges.length === 0) {
    if (allowReview) {
      const reviewTarget = [...availableCatalog].sort((a, b) => {
        const pA = progressMap.get(a.id);
        const pB = progressMap.get(b.id);
        const scoreA = (pA?.hintsUsed || 0) * 2 + (pA?.attempts || 0);
        const scoreB = (pB?.hintsUsed || 0) * 2 + (pB?.attempts || 0);
        return scoreB - scoreA;
      })[0] || availableCatalog[0];

      return {
        challenge: sanitizeChallengeForRecommendation(reviewTarget),
        reason: 'You have solved all catalog challenges! Recommended for an intentional review run to solidify mastery without hints.',
        strategy: 'intentional_review',
        learnerId: normLearnerId,
        catalogCompleted: true
      };
    }

    return {
      challenge: null,
      reason: 'You have completed all available challenges in the catalog! Great work.',
      strategy: 'catalog_completed',
      learnerId: normLearnerId,
      catalogCompleted: true
    };
  }

  // 5. Rule C: Repeated Failure on a Concept / Higher Tier -> Prefer Easier / Similar Challenge
  const currentProg = currentChallengeId ? progressMap.get(currentChallengeId) : null;
  const currentChallenge = currentChallengeId ? availableCatalog.find(c => c.id === currentChallengeId) : null;
  const isRepeatedlyFailingCurrent = currentProg && currentProg.attempts >= 2 && !currentProg.solved;

  if (isRepeatedlyFailingCurrent && currentChallenge && currentChallenge.difficulty === 'intermediate') {
    const failedConcept = currentChallenge.concept || 'conditions';
    const easierAlternative = unsolvedChallenges.find(c =>
      c.difficulty === 'beginner' && (c.concept === failedConcept || (c.targetedPatterns || []).some(p => mapPatternToConcept(p) === failedConcept))
    );

    if (easierAlternative) {
      return {
        challenge: sanitizeChallengeForRecommendation(easierAlternative),
        reason: `Recommended to practice foundational ${failedConcept} on an easier challenge based on recent difficulties.`,
        strategy: 'easier_concept_remediation',
        learnerId: normLearnerId,
        catalogCompleted: false
      };
    }
  }

  // 6. Rule D: Repeated Bug Fingerprint Remediation
  // Identify the most frequent recurring mistake pattern
  const mistakeCounts = {};
  for (const m of allRecordedMistakes) {
    const key = m.patternKey || m.category;
    if (key) {
      const canonical = key === 'loop_condition' || key === 'off_by_one'
        ? 'loop_boundary'
        : (key === 'array_index_error' ? 'wrong_index' : (key === 'empty_input_unhandled' ? 'empty_input' : key));
      mistakeCounts[canonical] = (mistakeCounts[canonical] || 0) + 1;
    }
  }

  const sortedMistakes = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1]);
  if (sortedMistakes.length > 0) {
    const [topPattern, count] = sortedMistakes[0];

    // Look for an unsolved challenge that exercises this exact pattern/skill
    const matchingChallenges = unsolvedChallenges.filter(c => {
      const patterns = c.targetedPatterns || [];
      return patterns.includes(topPattern) && c.id !== currentChallengeId;
    });

    const targetedChallenge = matchingChallenges.sort((a, b) => {
      if (a.difficulty === 'beginner' && b.difficulty !== 'beginner') return -1;
      if (b.difficulty === 'beginner' && a.difficulty !== 'beginner') return 1;
      return 0;
    })[0] || unsolvedChallenges.find(c => (c.targetedPatterns || []).includes(topPattern));

    if (targetedChallenge) {
      let specificReason = 'Recommended to practice and eliminate recurring mistakes based on your recent attempt history.';
      if (topPattern === 'loop_boundary') {
        specificReason = 'Recommended to help you master loop boundary conditions and eliminate off-by-one errors based on your recent attempts.';
      } else if (topPattern === 'wrong_condition') {
        specificReason = 'Recommended to reinforce conditional evaluation and comparison logic where recent mistakes were detected.';
      } else if (topPattern === 'wrong_index') {
        specificReason = 'Recommended to strengthen array and string index bounds safety based on recent index errors.';
      } else if (topPattern === 'empty_input') {
        specificReason = 'Recommended to practice defensive handling of empty or zero-element boundary cases.';
      }

      return {
        challenge: sanitizeChallengeForRecommendation(targetedChallenge),
        reason: specificReason,
        strategy: 'repeated_mistake_remediation',
        learnerId: normLearnerId,
        catalogCompleted: false
      };
    }
  }

  // 7. Rule E: Improving / Advancing Learner (Difficulty Progression)
  const beginnerChallenges = availableCatalog.filter(c => c.difficulty === 'beginner');
  const allBeginnersSolved = beginnerChallenges.every(c => solvedIds.has(c.id));

  if (allBeginnersSolved) {
    const nextDifficultyChallenge = unsolvedChallenges.find(c => c.difficulty === 'intermediate') || unsolvedChallenges[0];
    return {
      challenge: sanitizeChallengeForRecommendation(nextDifficultyChallenge),
      reason: 'You demonstrated strong mastery on beginner challenges! Recommended to step up your skills with intermediate conditional filtering.',
      strategy: 'difficulty_progression',
      learnerId: normLearnerId,
      catalogCompleted: false
    };
  }

  // 8. Rule F: Skill Expansion / Unsolved in Current Difficulty Tier
  const differentUnsolved = unsolvedChallenges.filter(c => c.id !== currentChallengeId);
  const candidate = (differentUnsolved.length > 0 ? differentUnsolved : unsolvedChallenges)[0];

  const candidateSkills = Array.isArray(candidate.skills) && candidate.skills.length > 0
    ? candidate.skills.join(', ')
    : 'problem solving';

  return {
    challenge: sanitizeChallengeForRecommendation(candidate),
    reason: `Recommended to build upon your recent progress and explore new exercises practicing ${candidateSkills}.`,
    strategy: 'skill_expansion',
    learnerId: normLearnerId,
    catalogCompleted: false
  };
}
