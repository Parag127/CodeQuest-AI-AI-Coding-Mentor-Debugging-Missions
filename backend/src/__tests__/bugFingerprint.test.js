import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import db from '../db/index.js';
import {
  classifyBugFingerprint,
  classifyBugFingerprints,
  recordBugFingerprint,
  getLearnerMistakes,
  FINGERPRINT_CATEGORIES,
  BUG_PATTERNS
} from '../services/bugFingerprint.js';

describe('Deterministic Bug Fingerprint Classifier', () => {
  describe('1. Category: loop_boundary', () => {
    it('classifies JavaScript for-loop with <= length and NaN output as loop_boundary with high confidence', () => {
      const result = classifyBugFingerprint({
        code: 'for (let i = 0; i <= arr.length; i++) { sum += arr[i]; }',
        language: 'javascript',
        testResults: [
          {
            status: 'wrong_output',
            stdout: 'NaN',
            expected_output: '10'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.LOOP_BOUNDARY);
      assert.equal(result.confidence, 'high');
      assert.equal(result.isHeuristic, false);
      assert.match(result.reason, /steps past|loop/i);
      assert.match(result.evidence, /<= length|NaN/);
    });

    it('classifies Java for-loop with <= arr.length as loop_boundary', () => {
      const result = classifyBugFingerprint({
        code: 'for (int i = 0; i <= arr.length; i++) { sum += arr[i]; }',
        language: 'java',
        testResults: [
          {
            status: 'runtime_error',
            stderr: 'java.lang.ArrayIndexOutOfBoundsException: Index 4 out of bounds for length 4'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.LOOP_BOUNDARY);
      assert.equal(result.confidence, 'high');
      assert.equal(result.isHeuristic, false);
    });

    it('classifies off-by-one numerical discrepancy as loop_boundary with heuristic flag', () => {
      const result = classifyBugFingerprint({
        code: 'for (let i = 0; i < arr.length - 1; i++) sum += arr[i];',
        language: 'javascript',
        testResults: [
          {
            status: 'wrong_output',
            stdout: '9',
            expected_output: '10'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.LOOP_BOUNDARY);
      assert.equal(result.confidence, 'medium');
      assert.equal(result.isHeuristic, true);
    });
  });

  describe('2. Category: wrong_condition', () => {
    it('classifies Java String == comparison as wrong_condition with high confidence', () => {
      const result = classifyBugFingerprint({
        code: 'public boolean check(String role) { if (role == "admin") return true; return false; }',
        language: 'java',
        testResults: [
          {
            status: 'wrong_output',
            stdout: 'false',
            expected_output: 'true'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.WRONG_CONDITION);
      assert.equal(result.confidence, 'high');
      assert.equal(result.isHeuristic, false);
      assert.match(result.reason, /reference equality/i);
    });

    it('classifies JavaScript single equals assignment in if-condition as wrong_condition', () => {
      const result = classifyBugFingerprint({
        code: 'function isValid(x) { if (x = 5) return "yes"; return "no"; }',
        language: 'javascript',
        testResults: [
          {
            status: 'wrong_output',
            stdout: 'yes',
            expected_output: 'no'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.WRONG_CONDITION);
      assert.equal(result.confidence, 'high');
      assert.equal(result.isHeuristic, false);
      assert.match(result.reason, /assignment operator/i);
    });

    it('classifies inverted min/max conditional comparison heuristic as wrong_condition', () => {
      const result = classifyBugFingerprint({
        code: 'let max = arr[0]; for(let i=1; i<arr.length; i++) { if (arr[i] < max) max = arr[i]; } return max;',
        language: 'javascript',
        testResults: [
          {
            status: 'wrong_output',
            stdout: '1',
            expected_output: '9'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.WRONG_CONDITION);
      assert.equal(result.confidence, 'medium');
      assert.equal(result.isHeuristic, true);
      assert.match(result.reason, /inverted/i);
    });
  });

  describe('3. Category: wrong_index', () => {
    it('classifies direct access to arr[arr.length] as wrong_index', () => {
      const result = classifyBugFingerprint({
        code: 'function lastElement(arr) { return arr[arr.length]; }',
        language: 'javascript',
        testResults: [
          {
            status: 'wrong_output',
            stdout: 'undefined',
            expected_output: '4'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.WRONG_INDEX);
      assert.equal(result.confidence, 'high');
      assert.equal(result.isHeuristic, false);
      assert.match(result.reason, /valid indices end at length - 1/i);
    });

    it('classifies negative index bracket access as wrong_index', () => {
      const result = classifyBugFingerprint({
        code: 'int val = arr[-1];',
        language: 'java',
        testResults: [
          {
            status: 'runtime_error',
            stderr: 'ArrayIndexOutOfBoundsException: Index -1 out of bounds'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.WRONG_INDEX);
      assert.equal(result.confidence, 'high');
      assert.match(result.evidence, /negative index/i);
    });

    it('classifies Java ArrayIndexOutOfBoundsException from arbitrary index as wrong_index', () => {
      const result = classifyBugFingerprint({
        code: 'int val = arr[5];',
        language: 'java',
        testResults: [
          {
            status: 'runtime_error',
            stderr: 'java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 3'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.WRONG_INDEX);
      assert.equal(result.confidence, 'high');
    });

    it('classifies JavaScript TypeError accessing property of undefined as wrong_index', () => {
      const result = classifyBugFingerprint({
        code: 'let val = users[i].email;',
        language: 'javascript',
        testResults: [
          {
            status: 'runtime_error',
            stderr: "TypeError: Cannot read properties of undefined (reading 'email')"
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.WRONG_INDEX);
      assert.equal(result.confidence, 'high');
    });

    it('classifies lookahead [i + 1] indexing without bound adjustment as wrong_index heuristic', () => {
      const result = classifyBugFingerprint({
        code: 'for(let i=0; i < arr.length; i++) { if(arr[i] > arr[i + 1]) return false; } return true;',
        language: 'javascript',
        testResults: [
          {
            status: 'wrong_output',
            stdout: 'false',
            expected_output: 'true'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.WRONG_INDEX);
      assert.equal(result.confidence, 'medium');
      assert.equal(result.isHeuristic, true);
    });
  });

  describe('4. Category: empty_input', () => {
    it('classifies failure on empty array [] as empty_input with high confidence', () => {
      const result = classifyBugFingerprint({
        code: 'function getFirst(arr) { return arr[0].toUpperCase(); }',
        language: 'javascript',
        testResults: [
          {
            status: 'runtime_error',
            stdin: '[]',
            stderr: 'TypeError: Cannot read properties of undefined'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.EMPTY_INPUT);
      assert.equal(result.confidence, 'high');
      assert.equal(result.isHeuristic, false);
      assert.match(result.reason, /empty or zero-element/i);
    });

    it('classifies failure on blank string "" input as empty_input', () => {
      const result = classifyBugFingerprint({
        code: 'public char first(String s) { return s.charAt(0); }',
        language: 'java',
        testResults: [
          {
            status: 'runtime_error',
            stdin: '""',
            stderr: 'StringIndexOutOfBoundsException: String index out of range: 0'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.EMPTY_INPUT);
      assert.equal(result.confidence, 'high');
    });
  });

  describe('5. Category: unknown', () => {
    it('classifies arbitrary mathematical/logic calculation error as unknown', () => {
      const result = classifyBugFingerprint({
        code: 'function add(a, b) { return a - b; }',
        language: 'javascript',
        testResults: [
          {
            status: 'wrong_output',
            stdout: '-1',
            expected_output: '5'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.UNKNOWN);
      assert.equal(result.confidence, 'low');
      assert.equal(result.isHeuristic, false);
      assert.match(result.reason, /no deterministic bug pattern conclusively identified/i);
    });

    it('classifies timeout with no recognizable loop header mistake as unknown', () => {
      const result = classifyBugFingerprint({
        code: 'while(ready) { doWork(); }',
        language: 'javascript',
        testResults: [
          {
            status: 'timeout'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.UNKNOWN);
      assert.equal(result.confidence, 'low');
    });
  });

  describe('6. Unrelated Correct Code', () => {
    it('returns unknown with low confidence when all tests pass', () => {
      const result = classifyBugFingerprint({
        code: 'function sum(arr) { let s = 0; for(let i=0; i<arr.length; i++) s += arr[i]; return s; }',
        language: 'javascript',
        testResults: [
          { status: 'passed', stdout: '10', expected_output: '10' },
          { status: 'passed', stdout: '0', expected_output: '0' }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.UNKNOWN);
      assert.equal(result.confidence, 'low');
      assert.match(result.reason, /all evaluated tests passed successfully/i);
      assert.equal(result.evidence, null);
    });
  });

  describe('7. Ambiguous Cases Resolution', () => {
    it('resolves conflicting signals prioritizing empty_input over loop_boundary when empty test crashes', () => {
      // Code has loop boundary `<= arr.length` AND crashes specifically on empty input test case
      const result = classifyBugFingerprint({
        code: 'function process(arr) { for(let i=0; i<=arr.length; i++) { if(!arr[i]) throw new Error("crash"); } }',
        language: 'javascript',
        testResults: [
          {
            status: 'runtime_error',
            stdin: '[]',
            stderr: 'Error: crash'
          }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.EMPTY_INPUT);
      assert.ok(result.allFindings.length >= 2, 'Should record all detected candidate findings');
      const categoriesFound = result.allFindings.map(f => f.category);
      assert.ok(categoriesFound.includes(FINGERPRINT_CATEGORIES.EMPTY_INPUT));
      assert.ok(categoriesFound.includes(FINGERPRINT_CATEGORIES.LOOP_BOUNDARY));
    });

    it('resolves loop header boundary over generic wrong_index when loop <= length causes ArrayIndexOutOfBoundsException', () => {
      const result = classifyBugFingerprint({
        code: 'for(int i = 0; i <= arr.length; i++) { int x = arr[i]; }',
        language: 'java',
        testResults: [
          {
            status: 'runtime_error',
            stderr: 'ArrayIndexOutOfBoundsException: Index 3 out of bounds for length 3'
          }
        ]
      });

      // The root cause is the loop boundary
      assert.equal(result.category, FINGERPRINT_CATEGORIES.LOOP_BOUNDARY);
    });
  });

  describe('8. Hidden Test Data Protection', () => {
    it('never exposes private test inputs or outputs in evidence or reason strings', () => {
      const result = classifyBugFingerprint({
        code: 'return arr[0];',
        language: 'javascript',
        testResults: [
          {
            isPublic: false,
            status: 'runtime_error',
            stdin: 'SUPER_SECRET_ARRAY_INPUT_XYZ',
            stdout: 'CONFIDENTIAL_OUTPUT_123',
            expected_output: 'SECRET_EXPECTED_RESULT_ABC',
            stderr: 'TypeError: Cannot read properties of undefined'
          }
        ]
      });

      const fullResultString = JSON.stringify(result);
      assert.ok(!fullResultString.includes('SUPER_SECRET_ARRAY_INPUT_XYZ'), 'Must not leak secret input');
      assert.ok(!fullResultString.includes('CONFIDENTIAL_OUTPUT_123'), 'Must not leak secret output');
      assert.ok(!fullResultString.includes('SECRET_EXPECTED_RESULT_ABC'), 'Must not leak expected result');
    });
  });

  describe('9. Backward Compatibility with classifyBugFingerprints', () => {
    it('returns array containing legacy pattern keys for backward compatibility', () => {
      const result = classifyBugFingerprints({
        code: 'for (let i = 0; i <= arr.length; i++) { sum += arr[i]; }',
        language: 'javascript',
        testResults: [
          { status: 'wrong_output', stdout: '15', expected_output: '10' }
        ]
      });

      assert.ok(result.includes('loop_boundary'));
      assert.ok(result.includes('loop_condition'));
    });

    it('returns empty array when all tests pass', () => {
      const result = classifyBugFingerprints({
        code: 'return 42;',
        language: 'javascript',
        testResults: [{ status: 'passed' }]
      });

      assert.deepEqual(result, []);
    });
  });

  describe('10. Confirmed vs Possible Mistakes Distinction', () => {
    it('marks high-confidence patterns with isConfirmed: true', () => {
      const result = classifyBugFingerprint({
        code: 'for (let i = 0; i <= arr.length; i++) sum += arr[i];',
        language: 'javascript',
        testResults: [{ status: 'wrong_output', stdout: 'NaN', expected_output: '10' }]
      });
      assert.equal(result.isConfirmed, true);
      assert.equal(result.confidence, 'high');
      assert.equal(result.isHeuristic, false);
    });

    it('marks heuristic or partial patterns with isConfirmed: false', () => {
      const result = classifyBugFingerprint({
        code: 'for (let i = 0; i < arr.length - 1; i++) sum += arr[i];',
        language: 'javascript',
        testResults: [{ status: 'wrong_output', stdout: '9', expected_output: '10' }]
      });
      assert.equal(result.isConfirmed, false);
      assert.equal(result.confidence, 'medium');
      assert.equal(result.isHeuristic, true);
    });
  });

  describe('11. Insufficient Evidence and Unknown Classifications', () => {
    it('returns unknown classification when failure provides insufficient or ambiguous evidence', () => {
      const result = classifyBugFingerprint({
        code: 'function compute(data) { return data.map(x => x * 2); }',
        language: 'javascript',
        testResults: [
          { status: 'wrong_output', stdout: 'apple', expected_output: 'orange' }
        ]
      });

      assert.equal(result.category, FINGERPRINT_CATEGORIES.UNKNOWN);
      assert.equal(result.confidence, 'low');
      assert.equal(result.isConfirmed, false);
      assert.match(result.reason, /no deterministic bug pattern/i);
      assert.equal(result.evidence, null);
    });

    it('handles empty, null, or missing test result records gracefully', () => {
      const resultEmpty = classifyBugFingerprint({ code: 'const x = 1;', testResults: [] });
      assert.equal(resultEmpty.category, FINGERPRINT_CATEGORIES.UNKNOWN);
      assert.equal(resultEmpty.confidence, 'low');
      assert.equal(resultEmpty.isConfirmed, false);

      const resultNull = classifyBugFingerprint({ code: null, testResults: null });
      assert.equal(resultNull.category, FINGERPRINT_CATEGORIES.UNKNOWN);
      assert.equal(resultNull.confidence, 'low');
      assert.equal(resultNull.isConfirmed, false);

      const resultDefault = classifyBugFingerprint();
      assert.equal(resultDefault.category, FINGERPRINT_CATEGORIES.UNKNOWN);
      assert.equal(resultDefault.confidence, 'low');
      assert.equal(resultDefault.isConfirmed, false);
    });
  });

  describe('12. SQLite Database Persistence and Learner Recurrence Tracking', () => {
    const testLearnerId = `test-learner-${Date.now()}`;
    const testChallengeId = 'largest-number';

    it('persists bug fingerprints into SQLite database with confidence and evidence', () => {
      const subId1 = crypto.randomUUID();
      db.prepare(`
        INSERT INTO submissions (id, learner_id, challenge_id, language, code, status)
        VALUES (?, ?, ?, 'javascript', 'let x = 1;', 'failed')
      `).run(subId1, testLearnerId, testChallengeId);

      const recId1 = recordBugFingerprint(db, {
        learnerId: testLearnerId,
        challengeId: testChallengeId,
        submissionId: subId1,
        category: FINGERPRINT_CATEGORIES.LOOP_BOUNDARY,
        language: 'javascript',
        confidence: 'high',
        evidence: 'Loop header contains <= length and NaN output observed',
        isConfirmed: true
      });

      assert.ok(recId1);

      // Verify row in SQLite
      const row = db.prepare('SELECT * FROM bug_fingerprints WHERE id = ?').get(recId1);
      assert.ok(row);
      assert.equal(row.learner_id, testLearnerId);
      assert.equal(row.challenge_id, testChallengeId);
      assert.equal(row.submission_id, subId1);
      assert.equal(row.pattern_key, 'loop_boundary');
      assert.equal(row.confidence, 'high');
      assert.equal(row.is_confirmed, 1);
      assert.match(row.evidence, /<= length/);
      assert.ok(row.detected_at);
    });

    it('tracks repeated mistake categories across multiple submissions for a learner', () => {
      const subId2 = crypto.randomUUID();
      const subId3 = crypto.randomUUID();

      db.prepare(`
        INSERT INTO submissions (id, learner_id, challenge_id, language, code, status)
        VALUES (?, ?, ?, 'javascript', 'let x = 2;', 'failed')
      `).run(subId2, testLearnerId, testChallengeId);

      db.prepare(`
        INSERT INTO submissions (id, learner_id, challenge_id, language, code, status)
        VALUES (?, ?, ?, 'javascript', 'let x = 3;', 'failed')
      `).run(subId3, testLearnerId, testChallengeId);

      // Second loop_boundary (heuristic / possible)
      recordBugFingerprint(db, {
        learnerId: testLearnerId,
        challengeId: testChallengeId,
        submissionId: subId2,
        category: FINGERPRINT_CATEGORIES.LOOP_BOUNDARY,
        language: 'javascript',
        confidence: 'medium',
        evidence: 'Off-by-one numerical discrepancy',
        isConfirmed: false
      });

      // Third mistake: wrong_index
      recordBugFingerprint(db, {
        learnerId: testLearnerId,
        challengeId: testChallengeId,
        submissionId: subId3,
        category: FINGERPRINT_CATEGORIES.WRONG_INDEX,
        language: 'javascript',
        confidence: 'high',
        evidence: 'Direct arr.length index access',
        isConfirmed: true
      });

      const mistakes = getLearnerMistakes(db, testLearnerId);
      assert.ok(Array.isArray(mistakes));
      assert.equal(mistakes.length, 2);

      const loopMistake = mistakes.find(m => m.patternKey === 'loop_boundary');
      assert.ok(loopMistake);
      assert.equal(loopMistake.count, 2);
      assert.equal(loopMistake.confirmedCount, 1);
      assert.equal(loopMistake.possibleCount, 1);
      assert.ok(loopMistake.lastDetectedAt);

      const indexMistake = mistakes.find(m => m.patternKey === 'wrong_index');
      assert.ok(indexMistake);
      assert.equal(indexMistake.count, 1);
      assert.equal(indexMistake.confirmedCount, 1);
      assert.equal(indexMistake.possibleCount, 0);
    });

    it('rejects database insertion when required challengeId or category is missing', () => {
      assert.throws(() => {
        recordBugFingerprint(db, { learnerId: 'learner-x', category: 'loop_boundary' });
      }, /challengeId is required/);

      assert.throws(() => {
        recordBugFingerprint(db, { learnerId: 'learner-x', challengeId: 'c1' });
      }, /category is required/);

      assert.throws(() => {
        recordBugFingerprint(null, { learnerId: 'learner-x', challengeId: 'c1', category: 'loop_boundary' });
      }, /database instance is required/i);
    });

    it('returns empty array when querying mistakes for non-existent or null learnerId', () => {
      assert.deepEqual(getLearnerMistakes(db, 'non-existent-learner-id-xyz'), []);
      assert.deepEqual(getLearnerMistakes(db, null), []);
    });
  });
});
