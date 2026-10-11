import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyBugFingerprint,
  classifyBugFingerprints,
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
});
