/**
 * CodeDNA Bug Fingerprint Service
 * Deterministic, rule-based classifier that identifies beginner mistake patterns
 * before applying any AI-assisted analysis.
 *
 * Supported Fingerprint Categories:
 * - loop_boundary: Loop iteration steps past valid collection/array bounds.
 * - wrong_condition: Inverted, inappropriate, or mismatched comparison/conditional logic.
 * - wrong_index: Direct invalid or out-of-bounds array/string index access.
 * - empty_input: Code fails or crashes when given empty/zero-element inputs.
 * - unknown: Uncertain or insufficient evidence, passing tests, or unclassified failures.
 */

export const FINGERPRINT_CATEGORIES = {
  LOOP_BOUNDARY: 'loop_boundary',
  WRONG_CONDITION: 'wrong_condition',
  WRONG_INDEX: 'wrong_index',
  EMPTY_INPUT: 'empty_input',
  UNKNOWN: 'unknown'
};

export const BUG_PATTERNS = {
  loop_boundary: {
    key: 'loop_boundary',
    label: 'Loop Boundary Error',
    description: 'Loop stopping or starting condition steps past valid array or collection bounds.'
  },
  wrong_condition: {
    key: 'wrong_condition',
    label: 'Wrong Condition',
    description: 'Relational or equality condition in loop or branch is inverted, mismatched, or inappropriate.'
  },
  wrong_index: {
    key: 'wrong_index',
    label: 'Wrong Index',
    description: 'Array or collection element access uses an out-of-bounds or invalid index expression.'
  },
  empty_input: {
    key: 'empty_input',
    label: 'Empty Input Unhandled',
    description: 'Function fails or crashes when supplied an empty array, blank string, or zero-length input.'
  },
  unknown: {
    key: 'unknown',
    label: 'Unknown Bug Pattern',
    description: 'No deterministic bug pattern could be conclusively identified from the available evidence.'
  },
  // Backward-compatibility aliases for earlier prototype keys
  loop_condition: {
    key: 'loop_condition',
    canonical: 'loop_boundary',
    label: 'Incorrect Loop Boundary',
    description: 'Loop condition uses <= instead of < or improperly steps past the last valid index.'
  },
  off_by_one: {
    key: 'off_by_one',
    canonical: 'loop_boundary',
    label: 'Off-by-One Error',
    description: 'Output differs from expected by exactly one element or numerical value.'
  },
  array_index_error: {
    key: 'array_index_error',
    canonical: 'wrong_index',
    label: 'Array Index Out of Bounds',
    description: 'Attempted to access an array or collection index outside its valid range.'
  },
  empty_input_unhandled: {
    key: 'empty_input_unhandled',
    canonical: 'empty_input',
    label: 'Unhandled Empty/Zero Input',
    description: 'Code fails or throws when given empty array, blank string, or zero length.'
  },
  null_dereference: {
    key: 'null_dereference',
    canonical: 'wrong_index',
    label: 'Null Dereference',
    description: 'Attempted to invoke a method or property on a null or undefined reference.'
  }
};

/**
 * Strips hidden test details to ensure no private test inputs or outputs
 * are ever exposed in diagnostic messages or evidence strings.
 *
 * @param {Object} test
 * @param {number} index
 * @returns {string}
 */
function formatSafeEvidenceContext(test, index) {
  if (!test) return `Test case ${index + 1}`;
  if (test.isPublic === false) {
    return `Private test case ${index + 1} failed with status "${test.status || 'failed'}"`;
  }
  const parts = [`Public test ${index + 1} (${test.status || 'failed'})`];
  if (test.stdin !== undefined && test.stdin !== null) {
    const s = String(test.stdin).slice(0, 50);
    parts.push(`input: ${s}`);
  }
  if (test.stdout !== undefined && test.stdout !== null && test.stdout !== '') {
    const s = String(test.stdout).slice(0, 50);
    parts.push(`output: ${s}`);
  }
  return parts.join(', ');
}

/**
 * Checks whether an input representation denotes empty or zero-element data.
 */
function isEmptyInputPattern(stdin) {
  if (stdin === undefined || stdin === null) return false;
  const s = String(stdin).trim();
  return s === '' || s === '[]' || s === '""' || s === "''" || s === '0' || s === '{}';
}

/**
 * Checks if actual output differs numerically or by array element count by exactly 1.
 */
function isNumericOrLengthOffByOne(actualStr, expectedStr) {
  if (actualStr === undefined || actualStr === null || expectedStr === undefined || expectedStr === null) {
    return false;
  }
  const actTrim = String(actualStr).trim();
  const expTrim = String(expectedStr).trim();

  if (!actTrim || !expTrim) return false;

  // Numerical off-by-one: 9 vs 10, -1 vs 0, etc.
  const actNum = Number(actTrim);
  const expNum = Number(expTrim);
  if (!isNaN(actNum) && !isNaN(expNum)) {
    return Math.abs(actNum - expNum) === 1;
  }

  // Array string representation off by one element: "[1, 2]" vs "[1, 2, 3]"
  if (actTrim.startsWith('[') && expTrim.startsWith('[') && actTrim.endsWith(']') && expTrim.endsWith(']')) {
    try {
      const aArr = JSON.parse(actTrim);
      const eArr = JSON.parse(expTrim);
      if (Array.isArray(aArr) && Array.isArray(eArr)) {
        return Math.abs(aArr.length - eArr.length) === 1;
      }
    } catch {
      // ignore
    }
  }

  return false;
}

/**
 * Java-specific deterministic rule detectors.
 */
function checkJavaRules(code, failingTests) {
  const findings = [];

  // Java rule 1: String comparison using == or != instead of .equals()
  // Heuristic: detects (str == "literal") or (var1 == var2) on likely string variables
  const javaStringEqualityRegex = /(?:String\s+\w+\s*=?[^;]*;[\s\S]*?(?:\w+\s*==\s*"[^"]*"|"[^"]*"\s*==\s*\w+)|(?:\w+)\.equals\s*\([^)]*\)\s*==\s*false)/;
  const javaStringLiteralComparison = /(?:==|!=)\s*"[^"]*"|"[^"]*"\s*(?:==|!=)/;
  if (javaStringEqualityRegex.test(code) || javaStringLiteralComparison.test(code)) {
    findings.push({
      category: FINGERPRINT_CATEGORIES.WRONG_CONDITION,
      reason: 'Java string comparison uses reference equality (==) instead of content equality (.equals()).',
      evidence: 'Detected String comparison using == operator in Java source.',
      confidence: 'high',
      isHeuristic: false
    });
  }

  // Java rule 2: ArrayIndexOutOfBoundsException in stderr
  const hasJavaIndexException = failingTests.some(t => {
    const err = String(t.stderr || '');
    return err.includes('ArrayIndexOutOfBoundsException') || err.includes('IndexOutOfBoundsException') || err.includes('StringIndexOutOfBoundsException');
  });

  if (hasJavaIndexException) {
    // If loop has <= length, this is a loop_boundary symptom; otherwise wrong_index
    const hasLoopBoundary = /(?:<=\s*(?:\w+\.)?(?:length|size\(\))\b)/i.test(code);
    if (!hasLoopBoundary) {
      const isNegative = /\b\w+\[\s*-\s*\d+\s*\]/.test(code);
      findings.push({
        category: FINGERPRINT_CATEGORIES.WRONG_INDEX,
        reason: 'Java runtime threw ArrayIndexOutOfBoundsException during element access.',
        evidence: isNegative
          ? 'Detected negative index expression in array bracket access.'
          : 'Runtime stderr confirms array/string index out of range.',
        confidence: 'high',
        isHeuristic: false
      });
    }
  }

  // Java rule 3: NullPointerException
  const hasJavaNullPointer = failingTests.some(t => String(t.stderr || '').includes('NullPointerException'));
  if (hasJavaNullPointer) {
    findings.push({
      category: FINGERPRINT_CATEGORIES.WRONG_INDEX,
      reason: 'Java runtime threw NullPointerException accessing uninitialized array or null reference.',
      evidence: 'Runtime stderr reported java.lang.NullPointerException.',
      confidence: 'high',
      isHeuristic: false
    });
  }

  return findings;
}

/**
 * JavaScript-specific deterministic rule detectors.
 */
function checkJavaScriptRules(code, failingTests) {
  const findings = [];

  // JS rule 1: Assignment operator inside if or while condition `if (x = y)`
  const jsAssignmentInCondition = /(?:if|while)\s*\([^=]*\b\w+\s*=\s*[^=][^)]*\)/;
  if (jsAssignmentInCondition.test(code)) {
    findings.push({
      category: FINGERPRINT_CATEGORIES.WRONG_CONDITION,
      reason: 'Assignment operator (=) used inside conditional statement instead of comparison (=== or ==).',
      evidence: 'Detected single equals assignment inside conditional expression.',
      confidence: 'high',
      isHeuristic: false
    });
  }

  // JS rule 2: TypeError: Cannot read properties of undefined
  const hasJsUndefinedAccess = failingTests.some(t => {
    const err = String(t.stderr || '');
    return err.includes('Cannot read properties of undefined') || err.includes('Cannot read property') || err.includes('TypeError: Cannot read');
  });

  if (hasJsUndefinedAccess) {
    const hasLoopBoundary = /(?:<=\s*(?:\w+\.)?length\b)/i.test(code);
    if (!hasLoopBoundary) {
      findings.push({
        category: FINGERPRINT_CATEGORIES.WRONG_INDEX,
        reason: 'JavaScript runtime threw TypeError attempting to access property on undefined array element.',
        evidence: 'Runtime stderr reported TypeError accessing property of undefined.',
        confidence: 'high',
        isHeuristic: false
      });
    }
  }

  // JS rule 3: NaN output produced when summing array elements with undefined past-boundary index
  const hasNaNOutput = failingTests.some(t => {
    const out = String(t.stdout || '').trim();
    return out === 'NaN' || out.includes('NaN');
  });
  if (hasNaNOutput && /(?:<=\s*(?:\w+\.)?length\b)/i.test(code)) {
    findings.push({
      category: FINGERPRINT_CATEGORIES.LOOP_BOUNDARY,
      reason: 'Output is NaN, typically caused by arithmetic operations on undefined when a loop steps past array length.',
      evidence: 'Observed stdout "NaN" alongside loop condition <= length.',
      confidence: 'high',
      isHeuristic: false
    });
  }

  return findings;
}

/**
 * Language-agnostic deterministic rule detectors.
 */
function checkCommonRules(code, failingTests, language) {
  const findings = [];

  // Common rule 1: empty_input
  // Triggered when a failing test specifically tested an empty/zero input
  const emptyFailingTests = failingTests.filter(t => isEmptyInputPattern(t.stdin));
  if (emptyFailingTests.length > 0) {
    const safeContext = formatSafeEvidenceContext(emptyFailingTests[0], 0);
    findings.push({
      category: FINGERPRINT_CATEGORIES.EMPTY_INPUT,
      reason: 'Code failed when evaluated against an empty or zero-element test case.',
      evidence: `Failure triggered on empty input test: ${safeContext}.`,
      confidence: 'high',
      isHeuristic: false
    });
  }

  // Common rule 2: loop_boundary
  // Heuristic pattern: loop stopping condition with <= length or <= size() OR off-by-one numerical output difference
  const loopBoundaryRegex = /(?:<=\s*(?:\w+\.)?(?:length|size\(\)|len))\b/i;
  const forLoopHeaderRegex = /for\s*\([^;]+;\s*[^;]*<=\s*[^;]*(?:\.length|\.size\(\)|len);/i;
  const hasLoopBoundaryCode = loopBoundaryRegex.test(code) || forLoopHeaderRegex.test(code);
  const hasOffByOneOutput = failingTests.some(t => t.status === 'wrong_output' && isNumericOrLengthOffByOne(t.stdout, t.expected_output));

  if (hasLoopBoundaryCode) {
    const hasIndexException = failingTests.some(t => {
      const err = String(t.stderr || '');
      return err.includes('IndexOutOfBounds') || err.includes('Cannot read properties of undefined');
    });

    const isHighConfidence = hasOffByOneOutput || hasIndexException;
    findings.push({
      category: FINGERPRINT_CATEGORIES.LOOP_BOUNDARY,
      reason: 'Loop stopping condition uses <= with array length or size, which steps one index past valid zero-indexed bounds.',
      evidence: isHighConfidence
        ? 'Loop header contains <= length, and failing test outcome confirmed off-by-one or boundary violation.'
        : 'Loop header contains <= length expression (heuristic match).',
      confidence: isHighConfidence ? 'high' : 'medium',
      isHeuristic: !isHighConfidence
    });
  } else if (hasOffByOneOutput) {
    findings.push({
      category: FINGERPRINT_CATEGORIES.LOOP_BOUNDARY,
      reason: 'Output differs from expected value by exactly 1 element or numerical value, indicating an off-by-one loop boundary error.',
      evidence: 'Failing test output differs from expected output by exactly 1.',
      confidence: 'medium',
      isHeuristic: true
    });
  }

  // Common rule 3: wrong_index (direct out-of-bounds indexing patterns)
  // Direct access: arr[arr.length], arr[-1], arr[i + 1]
  const directLengthIndexRegex = /\b\w+\[\s*(?:\w+\.)?(?:length|size\(\))\s*\]/i;
  const negativeIndexRegex = /\b\w+\[\s*-\s*\d+\s*\]/;
  const uncheckedNextIndexRegex = /\b\w+\[\s*\w+\s*\+\s*1\s*\]/;

  if (directLengthIndexRegex.test(code)) {
    findings.push({
      category: FINGERPRINT_CATEGORIES.WRONG_INDEX,
      reason: 'Direct element access using array.length as an index (valid indices end at length - 1).',
      evidence: 'Detected expression accessing index equal to array length.',
      confidence: 'high',
      isHeuristic: false
    });
  } else if (negativeIndexRegex.test(code)) {
    findings.push({
      category: FINGERPRINT_CATEGORIES.WRONG_INDEX,
      reason: 'Negative index access attempted on array or collection.',
      evidence: 'Detected negative index expression in array bracket access.',
      confidence: 'high',
      isHeuristic: false
    });
  } else if (uncheckedNextIndexRegex.test(code) && failingTests.some(t => t.status === 'runtime_error' || t.status === 'wrong_output')) {
    // Look ahead [i + 1] without checking if loop bounds were reduced
    if (!/(?:<\s*[^;]*-\s*1)/i.test(code)) {
      findings.push({
        category: FINGERPRINT_CATEGORIES.WRONG_INDEX,
        reason: 'Index expression looks ahead (i + 1) without adjusting loop upper bound to length - 1.',
        evidence: 'Detected [i + 1] element access without compensating loop bound constraint.',
        confidence: 'medium',
        isHeuristic: true
      });
    }
  }

  // Common rule 4: wrong_condition (inverted relational comparison heuristic)
  // e.g., in min/max logic: max = arr[i] where condition checked < max
  const invertedMaxRegex = /if\s*\([^)]*<\s*(?:max|largest|high)[^)]*\)\s*\{?[^}]*(?:max|largest|high)\s*=/i;
  const invertedMinRegex = /if\s*\([^)]*>\s*(?:min|smallest|low)[^)]*\)\s*\{?[^}]*(?:min|smallest|low)\s*=/i;
  if (invertedMaxRegex.test(code) || invertedMinRegex.test(code)) {
    findings.push({
      category: FINGERPRINT_CATEGORIES.WRONG_CONDITION,
      reason: 'Relational condition appears inverted for extremum (min/max) calculation.',
      evidence: 'Conditional comparison operator (< vs >) is inverted relative to the variable being updated.',
      confidence: 'medium',
      isHeuristic: true
    });
  }

  return findings;
}

/**
 * Classifies a submission into a single authoritative structured Bug Fingerprint result.
 *
 * @param {Object} options
 * @param {string} [options.code=''] - Learner code
 * @param {string} [options.language='javascript'] - 'java' | 'javascript'
 * @param {Array} [options.testResults=[]] - Authoritative execution test results
 * @param {Object} [options.executionResults=null] - Optional execution results object
 * @returns {{ category: string, reason: string, evidence: string|null, confidence: string, isHeuristic: boolean, language: string, allFindings: Array }}
 */
export function classifyBugFingerprint({
  code = '',
  language = 'javascript',
  testResults = [],
  executionResults = null
} = {}) {
  const normLang = String(language).toLowerCase() === 'java' ? 'java' : 'javascript';
  const tests = Array.isArray(testResults) && testResults.length > 0
    ? testResults
    : (executionResults && Array.isArray(executionResults.testResults) ? executionResults.testResults : []);

  // 1. If all tests passed or no failing tests, no bug fingerprint is assigned
  const hasFailingTests = tests.some(t => t && t.status !== 'passed');
  if (tests.length > 0 && !hasFailingTests) {
    return {
      category: FINGERPRINT_CATEGORIES.UNKNOWN,
      reason: 'All evaluated tests passed successfully; no bug detected.',
      evidence: null,
      confidence: 'low',
      isHeuristic: false,
      language: normLang,
      allFindings: []
    };
  }

  const failingTests = tests.filter(t => t && t.status !== 'passed');

  // 2. Gather language-specific and common rule findings
  const findings = [];

  if (normLang === 'java') {
    findings.push(...checkJavaRules(code, failingTests));
  } else {
    findings.push(...checkJavaScriptRules(code, failingTests));
  }

  findings.push(...checkCommonRules(code, failingTests, normLang));

  // 3. Ambiguous cases resolution & priority ranking:
  // Priority:
  // 1) empty_input (when explicitly triggered by empty test case)
  // 2) loop_boundary (when loop syntax is present alongside boundary errors)
  // 3) wrong_index (when direct index access causes failure)
  // 4) wrong_condition (when relational or equality comparison is flawed)
  // 5) unknown (when uncertain or no evidence)
  if (!findings.length) {
    return {
      category: FINGERPRINT_CATEGORIES.UNKNOWN,
      reason: 'No deterministic bug pattern conclusively identified from available evidence.',
      evidence: null,
      confidence: 'low',
      isHeuristic: false,
      language: normLang,
      allFindings: []
    };
  }

  // Deduplicate findings by category
  const uniqueByCategory = new Map();
  for (const f of findings) {
    if (!uniqueByCategory.has(f.category) || (f.confidence === 'high' && uniqueByCategory.get(f.category).confidence !== 'high')) {
      uniqueByCategory.set(f.category, f);
    }
  }

  const PRIORITY_ORDER = [
    FINGERPRINT_CATEGORIES.EMPTY_INPUT,
    FINGERPRINT_CATEGORIES.LOOP_BOUNDARY,
    FINGERPRINT_CATEGORIES.WRONG_INDEX,
    FINGERPRINT_CATEGORIES.WRONG_CONDITION
  ];

  let primary = null;
  for (const cat of PRIORITY_ORDER) {
    if (uniqueByCategory.has(cat)) {
      primary = uniqueByCategory.get(cat);
      break;
    }
  }

  if (!primary) {
    primary = findings[0];
  }

  return {
    category: primary.category,
    reason: primary.reason,
    evidence: primary.evidence,
    confidence: primary.confidence,
    isHeuristic: primary.isHeuristic,
    language: normLang,
    allFindings: Array.from(uniqueByCategory.values())
  };
}

/**
 * Returns an array of detected pattern keys for a submission.
 * Maintained for backward compatibility with existing routes, tests, and store.
 *
 * @param {Object} params
 * @param {string} [params.code='']
 * @param {string} [params.language='javascript']
 * @param {Array} [params.testResults=[]]
 * @returns {Array<string>} Unique list of detected pattern keys
 */
export function classifyBugFingerprints({ code = '', language = 'javascript', testResults = [] } = {}) {
  const primaryResult = classifyBugFingerprint({ code, language, testResults });

  if (primaryResult.category === FINGERPRINT_CATEGORIES.UNKNOWN) {
    return [];
  }

  const detected = new Set();
  // Add canonical category
  detected.add(primaryResult.category);

  // Add all other detected findings if multiple
  if (Array.isArray(primaryResult.allFindings)) {
    for (const f of primaryResult.allFindings) {
      detected.add(f.category);
    }
  }

  // Include legacy alias keys so existing tests and consumers continue to work seamlessly
  if (detected.has(FINGERPRINT_CATEGORIES.LOOP_BOUNDARY)) {
    detected.add('loop_condition');
    // Check if off-by-one is specifically present
    for (const t of testResults) {
      if (t.status === 'wrong_output' && isNumericOrLengthOffByOne(t.stdout, t.expected_output)) {
        detected.add('off_by_one');
      }
    }
  }
  if (detected.has(FINGERPRINT_CATEGORIES.WRONG_INDEX)) {
    detected.add('array_index_error');
    if (testResults.some(t => String(t.stderr || '').includes('NullPointer') || String(t.stderr || '').includes('null'))) {
      detected.add('null_dereference');
    }
  }
  if (detected.has(FINGERPRINT_CATEGORIES.EMPTY_INPUT)) {
    detected.add('empty_input_unhandled');
  }

  return Array.from(detected);
}
