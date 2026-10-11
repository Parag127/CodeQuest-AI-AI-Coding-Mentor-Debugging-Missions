import { seedChallenges, getChallengeById } from './seedChallenges.js';

// In-memory data store for hackathon prototype
const submissions = new Map();
const hintHistory = [];
const ebyfRecords = new Map();
const ebyfQuestions = new Map();
const bugFingerprints = [];
const learnerProgress = new Map();

export const store = {
  // Submissions
  saveSubmission(submission) {
    const id = submission.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const data = {
      ...submission,
      id,
      submittedAt: submission.submittedAt || new Date().toISOString()
    };
    submissions.set(id, data);
    return data;
  },

  getSubmission(id) {
    return submissions.get(id) || null;
  },

  // Explain Before You Fix (EBYF)
  saveEbyfQuestion(record) {
    const key = `${record.learnerId || 'anon'}:${record.submissionId}`;
    const data = {
      ...record,
      id: record.id || `ebyf-q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString()
    };
    ebyfQuestions.set(key, data);
    return data;
  },

  getEbyfQuestion(learnerId, submissionId) {
    return ebyfQuestions.get(`${learnerId || 'anon'}:${submissionId}`) || null;
  },

  saveEbyf(record) {
    const key = `${record.learnerId}:${record.submissionId}`;
    const data = {
      ...record,
      createdAt: new Date().toISOString()
    };
    ebyfRecords.set(key, data);
    return data;
  },

  hasCompletedEbyf(learnerId, submissionId) {
    return ebyfRecords.has(`${learnerId}:${submissionId}`);
  },

  getEbyf(learnerId, submissionId) {
    return ebyfRecords.get(`${learnerId}:${submissionId}`) || null;
  },

  getEbyfByLearner(learnerId) {
    return Array.from(ebyfRecords.values()).filter(r => r.learnerId === learnerId);
  },

  // Hints
  saveHintHistory(record) {
    const entry = {
      id: record.id || `hint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      learnerId: record.learnerId,
      submissionId: record.submissionId,
      challengeId: record.challengeId,
      hintLevel: record.hintLevel,
      hintText: record.hintText,
      isFallback: Boolean(record.isFallback),
      createdAt: new Date().toISOString()
    };
    hintHistory.push(entry);
    return entry;
  },

  getHintsForSubmission(submissionId) {
    return hintHistory.filter(h => h.submissionId === submissionId);
  },

  getHighestHintLevel(submissionId) {
    const hints = this.getHintsForSubmission(submissionId);
    if (!hints.length) return 0;
    return Math.max(...hints.map(h => h.hintLevel));
  },

  getHintByLevel(submissionId, hintLevel) {
    const hints = this.getHintsForSubmission(submissionId);
    return hints.find(h => h.hintLevel === Number(hintLevel)) || null;
  },

  // Bug Fingerprints
  saveBugFingerprints(records) {
    for (const rec of records) {
      bugFingerprints.push({
        id: rec.id || `bf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        learnerId: rec.learnerId,
        challengeId: rec.challengeId,
        submissionId: rec.submissionId,
        patternKey: rec.patternKey,
        language: rec.language,
        confidence: rec.confidence || 'high',
        evidence: rec.evidence || null,
        isConfirmed: rec.isConfirmed !== undefined ? Boolean(rec.isConfirmed) : (rec.confidence === 'high'),
        detectedAt: rec.detectedAt || new Date().toISOString()
      });
    }
  },

  getBugFingerprintsByLearner(learnerId) {
    return bugFingerprints.filter(b => b.learnerId === learnerId);
  },

  // Learner Progress
  updateProgress(learnerId, challengeId, { solved, passCount, totalTests, hintUsed }) {
    const key = `${learnerId}:${challengeId}`;
    const existing = learnerProgress.get(key) || {
      learnerId,
      challengeId,
      attempts: 0,
      hintsUsed: 0,
      bestPassCount: 0,
      totalTests: totalTests || 0,
      solved: false,
      lastAttemptAt: new Date().toISOString()
    };

    if (passCount !== undefined) {
      existing.attempts += 1;
      if (passCount > existing.bestPassCount) existing.bestPassCount = passCount;
    }
    if (hintUsed) {
      existing.hintsUsed += 1;
    }
    if (totalTests) existing.totalTests = totalTests;
    if (solved) existing.solved = true;
    existing.lastAttemptAt = new Date().toISOString();

    learnerProgress.set(key, existing);
    return existing;
  },

  getLearnerSummary(learnerId) {
    const progressList = Array.from(learnerProgress.values()).filter(p => p.learnerId === learnerId);

    const challengesProgress = seedChallenges.map(ch => {
      const match = progressList.find(p => p.challengeId === ch.id);
      return {
        challengeId: ch.id,
        title: ch.title,
        difficulty: ch.difficulty,
        attempts: match ? match.attempts : 0,
        hintsUsed: match ? match.hintsUsed : 0,
        bestPassCount: match ? match.bestPassCount : 0,
        totalTests: (ch.publicTestCases?.length || 0) + (ch.hiddenTestCases?.length || 0),
        solved: match ? match.solved : false,
        lastAttemptAt: match ? match.lastAttemptAt : null
      };
    });

    const learnerMistakes = this.getBugFingerprintsByLearner(learnerId);
    const patternMap = {};
    for (const item of learnerMistakes) {
      if (!patternMap[item.patternKey]) {
        patternMap[item.patternKey] = { count: 0, confirmedCount: 0, possibleCount: 0 };
      }
      patternMap[item.patternKey].count += 1;
      if (item.isConfirmed || item.confidence === 'high') {
        patternMap[item.patternKey].confirmedCount += 1;
      } else {
        patternMap[item.patternKey].possibleCount += 1;
      }
    }

    const recurringMistakes = Object.entries(patternMap).map(([patternKey, data]) => ({
      patternKey,
      count: data.count,
      confirmedCount: data.confirmedCount,
      possibleCount: data.possibleCount
    }));

    return {
      learnerId,
      challenges: challengesProgress,
      recurringMistakes
    };
  },

  // Reset helper for tests
  reset() {
    submissions.clear();
    hintHistory.length = 0;
    ebyfRecords.clear();
    ebyfQuestions.clear();
    bugFingerprints.length = 0;
    learnerProgress.clear();
  }
};
