import { getAllChallenges, getChallengeById } from '../data/seedChallenges.js';
import { store } from '../data/store.js';

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
    skills: Array.isArray(challenge.skills) ? [...challenge.skills] : [],
    targetedPatterns: Array.isArray(challenge.targetedPatterns) ? [...challenge.targetedPatterns] : [],
    languages: Array.isArray(challenge.languages) ? [...challenge.languages] : ['javascript', 'java']
  };
}

/**
 * Recommends an existing challenge for a learner using transparent, deterministic rules.
 *
 * Rules:
 * 1. Validates learnerId.
 * 2. New learners or learners with 0 history receive the foundational beginner challenge.
 * 3. Learners with repeated bug fingerprints receive an unsolved challenge targeting remediation of that mistake.
 * 4. Learners with solved challenges progress in difficulty or expand their skill topics.
 * 5. Completed challenges are never recommended repeatedly unless review is explicitly requested.
 * 6. Never invents challenge IDs: every recommended ID must exist in the catalog.
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

  // 2. Fetch learner progress & recurring mistake telemetry
  const summary = store.getLearnerSummary(normLearnerId);
  const recordedMistakes = store.getBugFingerprintsByLearner(normLearnerId);

  const solvedIds = new Set(
    summary.challenges.filter(c => c.solved).map(c => c.challengeId)
  );

  const unsolvedChallenges = availableCatalog.filter(c => !solvedIds.has(c.id));
  const hasAnyAttempts = summary.challenges.some(c => (c.attempts || 0) > 0) || recordedMistakes.length > 0;

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
      // Find challenge where learner used the most hints or had the most attempts
      const reviewTarget = [...availableCatalog].sort((a, b) => {
        const pA = summary.challenges.find(c => c.challengeId === a.id);
        const pB = summary.challenges.find(c => c.challengeId === b.id);
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

  // 5. Rule C: Repeated Bug Fingerprint Remediation
  // Identify the most frequent recurring mistake pattern
  const mistakeCounts = {};
  for (const m of recordedMistakes) {
    const key = m.patternKey || m.category;
    if (key) {
      // Map legacy pattern keys to canonical concepts
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
    const targetedChallenge = unsolvedChallenges.find(c => {
      const patterns = c.targetedPatterns || [];
      return patterns.includes(topPattern) && c.id !== currentChallengeId;
    }) || unsolvedChallenges.find(c => (c.targetedPatterns || []).includes(topPattern));

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

  // 6. Rule D: Improving / Advancing Learner (Difficulty Progression)
  // Check if learner has completed all beginner challenges or solved multiple problems
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

  // 7. Rule E: Skill Expansion / Unsolved in Current Difficulty Tier
  // Filter out currentChallengeId if possible so the learner sees a new challenge
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
