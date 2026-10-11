/**
 * Bug Fingerprint rule-based classifier
 * Analyzes code, execution status, stdout, and stderr to diagnose recurring beginner mistakes.
 */

export const BUG_PATTERNS = {
  off_by_one: {
    key: 'off_by_one',
    label: 'Off-by-One Error',
    description: 'Output or iteration boundary differs from expected by exactly one element or numerical value.'
  },
  loop_condition: {
    key: 'loop_condition',
    label: 'Incorrect Loop Boundary',
    description: 'Loop condition uses <= instead of < or improperly steps past the last valid index.'
  },
  array_index_error: {
    key: 'array_index_error',
    label: 'Array Index Out of Bounds',
    description: 'Attempted to access an array or collection index outside its valid range.'
  },
  empty_input_unhandled: {
    key: 'empty_input_unhandled',
    label: 'Unhandled Empty/Zero Input',
    description: 'Code fails or throws when given empty array, blank string, or zero length.'
  },
  null_dereference: {
    key: 'null_dereference',
    label: 'Null Dereference',
    description: 'Attempted to invoke a method or property on a null or undefined reference.'
  }
};

/**
 * Checks if output is numerically or size-wise off by one.
 */
function isNumericOrLengthOffByOne(actualStr, expectedStr) {
  if (!actualStr || !expectedStr) return false;
  const actTrim = actualStr.trim();
  const expTrim = expectedStr.trim();

  // Numerical off by one
  const actNum = Number(actTrim);
  const expNum = Number(expTrim);
  if (!isNaN(actNum) && !isNaN(expNum)) {
    return Math.abs(actNum - expNum) === 1;
  }

  // Length off by one
  if (Math.abs(actTrim.length - expTrim.length) === 1) {
    return true;
  }

  return false;
}

/**
 * Checks for loop boundary syntax mistakes in code.
 */
function hasLoopBoundaryIssue(code) {
  if (!code || typeof code !== 'string') return false;
  // Matches i <= arr.length, index <= list.size(), <= length, etc.
  const loopRegex = /(?:<=\s*(?:\w+\.)?(?:length|size\(\)|len))\b/i;
  // Also matches for (... ; i <= ... .length ; ...)
  const forLoopRegex = /for\s*\([^;]+;\s*[^;]*<=\s*[^;]*(?:\.length|\.size\(\));/i;
  return loopRegex.test(code) || forLoopRegex.test(code);
}

/**
 * Checks if input represents empty or zero input.
 */
function isEmptyInput(stdin) {
  if (stdin === undefined || stdin === null) return true;
  const s = String(stdin).trim();
  return s === '' || s === '[]' || s === '""' || s === "''" || s === '0' || s === '{}';
}

/**
 * Analyzes test results and code to detect bug fingerprints.
 * 
 * @param {Object} params
 * @param {string} [params.code=''] - Learner code
 * @param {string} [params.language='javascript'] - 'java' | 'javascript'
 * @param {Array} [params.testResults=[]] - Array of test results
 * @returns {Array<string>} List of unique detected pattern keys
 */
export function classifyBugFingerprints({ code = '', language = 'javascript', testResults = [] }) {
  const detected = new Set();

  // 1. Loop condition boundary regex check
  if (hasLoopBoundaryIssue(code)) {
    detected.add(BUG_PATTERNS.loop_condition.key);
  }

  for (const test of testResults) {
    // Only inspect failing tests
    if (!test || test.status === 'passed') continue;

    const stderr = String(test.stderr || '');
    const stdout = String(test.stdout || '');
    const expected = String(test.expected_output || '');
    const stdin = test.stdin !== undefined ? test.stdin : '';

    // 2. Off-by-one check
    if (test.status === 'wrong_output' && isNumericOrLengthOffByOne(stdout, expected)) {
      detected.add(BUG_PATTERNS.off_by_one.key);
    }

    // 3. Array Index Out of Bounds check
    const isArrayIndexError =
      stderr.includes('ArrayIndexOutOfBoundsException') ||
      stderr.includes('IndexOutOfBoundsException') ||
      stderr.includes('Cannot read properties of undefined (reading') ||
      stderr.includes('Cannot read property') ||
      stderr.includes('TypeError: Cannot read');

    if (test.status === 'runtime_error' && isArrayIndexError) {
      detected.add(BUG_PATTERNS.array_index_error.key);
    }

    // 4. Empty input unhandled check
    if ((test.status === 'runtime_error' || test.status === 'wrong_output') && isEmptyInput(stdin)) {
      detected.add(BUG_PATTERNS.empty_input_unhandled.key);
    }

    // 5. Null dereference check
    const isNullDereference =
      stderr.includes('NullPointerException') ||
      stderr.includes('Cannot read properties of null') ||
      stderr.includes('null is not an object');

    if (test.status === 'runtime_error' && isNullDereference) {
      detected.add(BUG_PATTERNS.null_dereference.key);
    }
  }

  return Array.from(detected);
}
