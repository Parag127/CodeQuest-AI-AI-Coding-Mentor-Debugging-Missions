import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { getAdaptiveRecommendation } from '../services/recommendationService.js';
import { getAllChallenges, seedChallenges } from '../data/seedChallenges.js';
import { store } from '../data/store.js';
import recommendationsRouter from '../routes/recommendations.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/recommendations', recommendationsRouter);
  return app;
}

function dispatch(app, { method, path, body = null, query = null }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      let fullPath = path;
      if (query) {
        const q = new URLSearchParams(query).toString();
        fullPath += `?${q}`;
      }

      const postData = body ? JSON.stringify(body) : '';
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: fullPath,
          method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        },
        res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            server.close(() => {
              try {
                const parsed = data ? JSON.parse(data) : {};
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
              } catch {
                resolve({ status: res.statusCode, headers: res.headers, body: data });
              }
            });
          });
        }
      );

      req.on('error', err => {
        server.close();
        reject(err);
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  });
}

describe('CodeDNA Adaptive Challenge Recommendation Feature', () => {
  beforeEach(() => {
    store.reset();
  });

  describe('1. New Learners & Missing History', () => {
    it('provides a sensible beginner-friendly default challenge for a brand new learner', () => {
      const rec = getAdaptiveRecommendation({ learnerId: 'new-learner-001' });

      assert.ok(rec.challenge);
      assert.equal(rec.strategy, 'new_learner_default');
      assert.equal(rec.challenge.difficulty, 'beginner');
      assert.equal(rec.challenge.id, 'sum-array');
      assert.match(rec.reason, /starting challenge|fundamental/i);
    });

    it('recommends beginner challenge when learner exists in store with 0 attempts', () => {
      const learnerId = 'zero-attempt-learner';
      const rec = getAdaptiveRecommendation({ learnerId });

      assert.ok(rec.challenge);
      assert.equal(rec.strategy, 'new_learner_default');
      assert.equal(rec.challenge.id, 'sum-array');
    });
  });

  describe('2. Repeated Mistakes Remediation', () => {
    it('recommends challenge targeting loop_boundary when learner repeatedly fails loop conditions', () => {
      const learnerId = 'loop-struggler';

      // Record repeated loop boundary mistakes
      store.saveBugFingerprints([
        { learnerId, challengeId: 'sum-array', patternKey: 'loop_boundary' },
        { learnerId, challengeId: 'sum-array', patternKey: 'loop_boundary' }
      ]);
      store.updateProgress(learnerId, 'sum-array', { passCount: 1, totalTests: 3, solved: false });

      const rec = getAdaptiveRecommendation({
        learnerId,
        currentChallengeId: 'sum-array'
      });

      assert.ok(rec.challenge);
      assert.equal(rec.strategy, 'repeated_mistake_remediation');
      // Should recommend an unsolved challenge with loop_boundary pattern (e.g. reverse-string)
      assert.ok(rec.challenge.targetedPatterns.includes('loop_boundary'));
      assert.notEqual(rec.challenge.id, 'sum-array', 'Avoids the currently failing challenge if alternative exists');
      assert.match(rec.reason, /loop boundary|off-by-one/i);
    });

    it('recommends challenge targeting wrong_condition when learner struggles with comparisons', () => {
      const learnerId = 'condition-struggler';

      store.saveBugFingerprints([
        { learnerId, challengeId: 'sum-array', patternKey: 'wrong_condition' },
        { learnerId, challengeId: 'sum-array', patternKey: 'wrong_condition' }
      ]);
      store.updateProgress(learnerId, 'sum-array', { passCount: 0, totalTests: 2, solved: false });

      const rec = getAdaptiveRecommendation({
        learnerId,
        currentChallengeId: 'sum-array'
      });

      assert.ok(rec.challenge);
      assert.equal(rec.strategy, 'repeated_mistake_remediation');
      assert.ok(rec.challenge.targetedPatterns.includes('wrong_condition'));
      assert.match(rec.reason, /conditional evaluation|comparison/i);
    });

    it('recommends challenge targeting empty_input when learner forgets edge-case guards', () => {
      const learnerId = 'empty-struggler';

      store.saveBugFingerprints([
        { learnerId, challengeId: 'find-max', patternKey: 'empty_input' }
      ]);
      store.updateProgress(learnerId, 'find-max', { passCount: 1, totalTests: 3, solved: false });

      const rec = getAdaptiveRecommendation({
        learnerId,
        currentChallengeId: 'find-max'
      });

      assert.ok(rec.challenge);
      assert.equal(rec.strategy, 'repeated_mistake_remediation');
      assert.ok(rec.challenge.targetedPatterns.includes('empty_input'));
      assert.match(rec.reason, /empty or zero-element/i);
    });
  });

  describe('3. Improving Learners & Difficulty Progression', () => {
    it('steps up to intermediate difficulty when learner solves beginner challenges', () => {
      const learnerId = 'advancing-coder';

      // Mark all beginner challenges as solved
      const beginners = getAllChallenges().filter(c => c.difficulty === 'beginner');
      for (const b of beginners) {
        store.updateProgress(learnerId, b.id, { passCount: 5, totalTests: 5, solved: true });
      }

      const rec = getAdaptiveRecommendation({ learnerId });

      assert.ok(rec.challenge);
      assert.equal(rec.strategy, 'difficulty_progression');
      assert.equal(rec.challenge.difficulty, 'intermediate');
      assert.equal(rec.challenge.id, 'filter-positive');
      assert.match(rec.reason, /mastery on beginner challenges|intermediate/i);
    });

    it('recommends next unsolved challenge in current tier before difficulty progression', () => {
      const learnerId = 'partially-solved-coder';

      // Solved sum-array only
      store.updateProgress(learnerId, 'sum-array', { passCount: 4, totalTests: 4, solved: true });

      const rec = getAdaptiveRecommendation({
        learnerId,
        currentChallengeId: 'sum-array'
      });

      assert.ok(rec.challenge);
      assert.notEqual(rec.challenge.id, 'sum-array', 'Does not recommend the already completed challenge');
      assert.equal(rec.challenge.difficulty, 'beginner');
      assert.equal(rec.strategy, 'skill_expansion');
    });
  });

  describe('4. No Available Challenges & Intentional Review', () => {
    it('returns catalog_completed when all catalog challenges are solved and allowReview is false', () => {
      const learnerId = 'master-coder';

      // Solve every challenge
      for (const ch of getAllChallenges()) {
        store.updateProgress(learnerId, ch.id, { passCount: 10, totalTests: 10, solved: true });
      }

      const rec = getAdaptiveRecommendation({
        learnerId,
        allowReview: false
      });

      assert.equal(rec.challenge, null);
      assert.equal(rec.catalogCompleted, true);
      assert.equal(rec.strategy, 'catalog_completed');
      assert.match(rec.reason, /completed all available challenges/i);
    });

    it('recommends challenge with highest hint and attempt count when review is intentional', () => {
      const learnerId = 'review-coder';

      for (const ch of getAllChallenges()) {
        store.updateProgress(learnerId, ch.id, { passCount: 5, totalTests: 5, solved: true });
      }
      // Give find-max the highest hints used
      store.updateProgress(learnerId, 'find-max', { passCount: 5, totalTests: 5, solved: true, hintUsed: true });
      store.updateProgress(learnerId, 'find-max', { passCount: 5, totalTests: 5, solved: true, hintUsed: true });

      const rec = getAdaptiveRecommendation({
        learnerId,
        allowReview: true
      });

      assert.ok(rec.challenge);
      assert.equal(rec.challenge.id, 'find-max');
      assert.equal(rec.strategy, 'intentional_review');
      assert.match(rec.reason, /intentional review run/i);
    });

    it('handles empty catalog gracefully', () => {
      const rec = getAdaptiveRecommendation({
        learnerId: 'test-user',
        catalog: []
      });

      assert.equal(rec.challenge, null);
      assert.equal(rec.strategy, 'empty_catalog');
      assert.match(rec.reason, /no challenges are currently available/i);
    });
  });

  describe('5. Invalid Learner State Validation', () => {
    it('throws when learnerId is missing or empty string', () => {
      assert.throws(
        () => getAdaptiveRecommendation({ learnerId: '' }),
        /learnerId is required/
      );
      assert.throws(
        () => getAdaptiveRecommendation({ learnerId: null }),
        /learnerId is required/
      );
      assert.throws(
        () => getAdaptiveRecommendation({ learnerId: '   ' }),
        /learnerId is required/
      );
    });
  });

  describe('6. Catalog Integrity & Challenge ID Verification', () => {
    it('strictly guarantees that every recommendation references an existing challenge in the catalog', () => {
      const validIds = new Set(getAllChallenges().map(c => c.id));

      // Test multiple learner states
      const states = ['brand-new', 'struggling', 'advanced', 'review'];
      for (const id of states) {
        const rec = getAdaptiveRecommendation({ learnerId: id });
        if (rec.challenge) {
          assert.ok(
            validIds.has(rec.challenge.id),
            `Recommended ID "${rec.challenge.id}" must exist in catalog`
          );
        }
      }
    });

    it('never exposes private or hidden test suites in recommended challenge object', () => {
      const rec = getAdaptiveRecommendation({ learnerId: 'privacy-check' });
      assert.ok(rec.challenge);
      assert.equal(rec.challenge.hiddenTestCases, undefined);
      assert.equal(rec.challenge.publicTestCases, undefined);
    });
  });

  describe('7. HTTP API Integration', () => {
    const app = createTestApp();

    it('GET /api/recommendations/:learnerId returns 200 with structured recommendation', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        path: '/api/recommendations/learner-http-1'
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.challenge);
      assert.equal(res.body.data.challenge.id, 'sum-array');
      assert.ok(res.body.data.reason.length > 10);
      assert.equal(res.body.data.strategy, 'new_learner_default');
    });

    it('GET /api/recommendations/:learnerId returns 400 for empty or whitespace learnerId', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        path: '/api/recommendations/%20'
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /learnerId is required/);
    });

    it('POST /api/recommendations returns 200 with recommendation payload', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/recommendations',
        body: {
          learnerId: 'learner-post-1',
          currentChallengeId: 'sum-array'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.challenge);
      assert.ok(res.body.data.reason);
    });

    it('POST /api/recommendations returns 400 when learnerId is missing in body', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        path: '/api/recommendations',
        body: {}
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /learnerId is required/);
    });
  });
});
