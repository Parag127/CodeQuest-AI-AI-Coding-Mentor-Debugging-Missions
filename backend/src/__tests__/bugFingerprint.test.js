import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyBugFingerprints, BUG_PATTERNS } from '../services/bugFingerprint.js';

describe('Bug Fingerprint Classifier', () => {
  it('detects off_by_one error when output differs by 1', () => {
    const result = classifyBugFingerprints({
      code: 'let sum = 0; for(let i = 0; i < arr.length - 1; i++) sum += arr[i];',
      language: 'javascript',
      testResults: [
        {
          status: 'wrong_output',
          stdout: '9',
          expected_output: '10'
        }
      ]
    });

    assert.ok(result.includes(BUG_PATTERNS.off_by_one.key));
  });

  it('detects loop_condition pattern when loop uses <= length', () => {
    const result = classifyBugFingerprints({
      code: 'for (let i = 0; i <= arr.length; i++) { sum += arr[i]; }',
      language: 'javascript',
      testResults: [
        {
          status: 'wrong_output',
          stdout: '15',
          expected_output: '10'
        }
      ]
    });

    assert.ok(result.includes(BUG_PATTERNS.loop_condition.key));
  });

  it('detects array_index_error from runtime stderr in Java and JS', () => {
    const javaResult = classifyBugFingerprints({
      code: 'int val = arr[5];',
      language: 'java',
      testResults: [
        {
          status: 'runtime_error',
          stderr: 'java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 3'
        }
      ]
    });
    assert.ok(javaResult.includes(BUG_PATTERNS.array_index_error.key));

    const jsResult = classifyBugFingerprints({
      code: 'let val = arr[i].name;',
      language: 'javascript',
      testResults: [
        {
          status: 'runtime_error',
          stderr: 'TypeError: Cannot read properties of undefined (reading \'name\')'
        }
      ]
    });
    assert.ok(jsResult.includes(BUG_PATTERNS.array_index_error.key));
  });

  it('detects empty_input_unhandled when input is empty array or blank', () => {
    const result = classifyBugFingerprints({
      code: 'return arr[0];',
      language: 'javascript',
      testResults: [
        {
          status: 'runtime_error',
          stdin: '[]',
          stderr: 'TypeError: Cannot read properties of undefined'
        }
      ]
    });

    assert.ok(result.includes(BUG_PATTERNS.empty_input_unhandled.key));
  });

  it('detects null_dereference from NullPointerException or null property access', () => {
    const result = classifyBugFingerprints({
      code: 'String s = null; s.length();',
      language: 'java',
      testResults: [
        {
          status: 'runtime_error',
          stderr: 'java.lang.NullPointerException: Cannot invoke "String.length()" because "s" is null'
        }
      ]
    });

    assert.ok(result.includes(BUG_PATTERNS.null_dereference.key));
  });

  it('returns empty array when all tests pass', () => {
    const result = classifyBugFingerprints({
      code: 'let sum = 0; for(let i = 0; i < arr.length; i++) sum += arr[i]; return sum;',
      language: 'javascript',
      testResults: [
        {
          status: 'passed',
          stdout: '10',
          expected_output: '10'
        }
      ]
    });

    assert.deepEqual(result, []);
  });
});
