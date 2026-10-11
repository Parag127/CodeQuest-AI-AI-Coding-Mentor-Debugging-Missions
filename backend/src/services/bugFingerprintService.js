/**
 * Bug Fingerprint Service
 * Server-side rule-based classifier that analyzes test failures,
 * execution outputs, error messages, and learner code to identify recurring bug patterns.
 */

export const BUG_PATTERNS = {
  LOOP_BOUNDARY: 'loop_boundary',
  OFF_BY_ONE: 'off_by_one',
  ARRAY_INDEX_ERROR: 'array_index_error',
  EMPTY_INPUT_UNHANDLED: 'empty_input_unhandled',
  NULL_DEREFERENCE: 'null_dereference',
  GENERAL: 'general'
};

const PATTERN_SUMMARIES = {
  [BUG_PATTERNS.LOOP_BOUNDARY]: 'The loop may be stopping before it visits every element or iterating out of bounds.',
  [BUG_PATTERNS.OFF_BY_ONE]: 'The output is close to expected but appears off by one item or calculation step.',
  [BUG_PATTERNS.ARRAY_INDEX_ERROR]: 'An array index was accessed that exceeds the collection bounds.',
  [BUG_PATTERNS.NULL_DEREFERENCE]: 'A null reference or undefined value was accessed unexpectedly.',
  [BUG_PATTERNS.EMPTY_INPUT_UNHANDLED]: 'The solution failed when provided with empty or edge-case input.',
  [BUG_PATTERNS.GENERAL]: 'Some test cases did not produce the expected output.'
};

/**
 * Classifies bugs and generates feedback based on execution results.
 * 
 * @param {Object} params
 * @param {string} params.code - Learner code
 * @param {string} params.language - 'javascript' or 'java'
 * @param {Array<Object>} params.testResults - Array of test results
 * @param {string} [params.concept] - Challenge concept (e.g. 'loop_boundary')
 * @returns {Object} { detectedPatterns: string[], feedback: { summary: string, bugCategory: string, hintLevelAvailable: number } }
 */
export function classifyBugFingerprint({ code = '', language = 'javascript', testResults = [], concept = null }) {
  const detected = new Set();
  const failingResults = testResults.filter(r => r.status !== 'passed');

  if (failingResults.length === 0) {
    return {
      detectedPatterns: [],
      feedback: null
    };
  }

  // 1. Check for Array Index Errors in stderr
  const hasArrayIndexError = failingResults.some(r => {
    const err = (r.stderr || '').toLowerCase();
    return err.includes('arrayindexoutofboundsexception') ||
      err.includes('indexoutofboundsexception') ||
      err.includes('cannot read properties of undefined');
  });
  if (hasArrayIndexError) {
    detected.add(BUG_PATTERNS.ARRAY_INDEX_ERROR);
  }

  // 2. Check for Null Dereference in stderr
  const hasNullError = failingResults.some(r => {
    const err = (r.stderr || '').toLowerCase();
    return err.includes('nullpointerexception') ||
      err.includes('cannot read properties of null');
  });
  if (hasNullError) {
    detected.add(BUG_PATTERNS.NULL_DEREFERENCE);
  }

  // 3. Check for Loop Boundary issues
  const loopBoundaryRegex = /for\s*\([^;]+;\s*[\w\d_]+\s*(<=\s*[\w\d_]+\.length|<\s*[\w\d_]+\.length\s*-\s*1)/i;
  if (loopBoundaryRegex.test(code) || (concept === 'loop_boundary' && failingResults.length > 0)) {
    detected.add(BUG_PATTERNS.LOOP_BOUNDARY);
  }

  // 4. Check for Off-by-One in numeric output difference
  const hasOffByOne = failingResults.some(r => {
    if (r.expected && r.actual) {
      const expNum = parseFloat(r.expected.trim());
      const actNum = parseFloat(r.actual.trim());
      if (!isNaN(expNum) && !isNaN(actNum) && Math.abs(expNum - actNum) === 1) {
        return true;
      }
    }
    return false;
  });
  if (hasOffByOne) {
    detected.add(BUG_PATTERNS.OFF_BY_ONE);
  }

  // 5. Check for Empty Input Unhandled
  const hasEmptyInputFailure = failingResults.some(r => {
    return (r.stdin === '' || r.stdin === '\n') && (r.status === 'runtime_error' || r.status === 'wrong_output');
  });
  if (hasEmptyInputFailure) {
    detected.add(BUG_PATTERNS.EMPTY_INPUT_UNHANDLED);
  }

  // Fallback to concept if present, else general
  if (detected.size === 0 && concept) {
    detected.add(concept);
  }
  if (detected.size === 0) {
    detected.add(BUG_PATTERNS.GENERAL);
  }

  const detectedPatterns = Array.from(detected);
  const primaryCategory = detectedPatterns[0];

  const summary = PATTERN_SUMMARIES[primaryCategory] || PATTERN_SUMMARIES[BUG_PATTERNS.GENERAL];

  return {
    detectedPatterns,
    feedback: {
      summary,
      bugCategory: primaryCategory,
      hintLevelAvailable: 1
    }
  };
}
