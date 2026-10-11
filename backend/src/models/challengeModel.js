/**
 * Challenge Data Models & Public Serializers
 * Strictly separates internal database entities from external API response representations.
 * Ensures zero leakage of hidden tests, internal hints, or grading metadata.
 */

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates challenge ID route parameter format.
 * Must be a lowercase alphanumeric hyphenated slug.
 */
export function validateChallengeId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Challenge ID must be a non-empty string' };
  }
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 64) {
    return { valid: false, error: 'Challenge ID must be between 1 and 64 characters' };
  }
  if (!SLUG_REGEX.test(trimmed)) {
    return { valid: false, error: 'Challenge ID must be a lowercase alphanumeric hyphenated slug (e.g. largest-number)' };
  }
  return { valid: true, id: trimmed };
}

/**
 * Safely parses supported languages array from database.
 */
export function parseLanguages(languagesRaw) {
  if (Array.isArray(languagesRaw)) {
    return languagesRaw;
  }
  if (typeof languagesRaw === 'string') {
    try {
      const parsed = JSON.parse(languagesRaw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [languagesRaw];
    }
  }
  return ['javascript', 'java'];
}

/**
 * Transforms internal DB record into public challenge summary model (Catalog view).
 * Whitelists allowed attributes and discards descriptions, starter code, test cases, and hints.
 * 
 * @param {Object} row - Raw database challenge record
 * @returns {Object} Public challenge catalog item
 */
export function toPublicChallengeSummary(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('Invalid challenge record');
  }

  return {
    id: String(row.id),
    title: String(row.title),
    difficulty: String(row.difficulty),
    concept: String(row.concept || 'general'),
    languages: parseLanguages(row.languages)
  };
}

/**
 * Transforms internal DB records into public challenge detail model (Workspace view).
 * Whitelists public description, starter code, and visible tests ONLY.
 * Strictly guarantees that hidden tests and internal hints are never included.
 * 
 * @param {Object} challengeRow - Raw database challenge record
 * @param {Array<Object>} visibleTestRows - Database test_case records with is_public = 1
 * @returns {Object} Public challenge detail object
 */
export function toPublicChallengeDetail(challengeRow, visibleTestRows = []) {
  if (!challengeRow || typeof challengeRow !== 'object') {
    throw new Error('Invalid challenge record');
  }

  // Filter and map visible test cases explicitly
  const safeVisibleTests = visibleTestRows.map(testCase => ({
    id: String(testCase.id),
    stdin: typeof testCase.stdin === 'string' ? testCase.stdin : '',
    expectedStdout: typeof (testCase.expectedStdout || testCase.expected_output) === 'string'
      ? (testCase.expectedStdout || testCase.expected_output)
      : ''
  }));

  return {
    id: String(challengeRow.id),
    title: String(challengeRow.title),
    difficulty: String(challengeRow.difficulty),
    concept: String(challengeRow.concept || 'general'),
    description: String(challengeRow.description),
    languages: parseLanguages(challengeRow.languages),
    starterCode: {
      javascript: typeof challengeRow.starter_code_javascript === 'string'
        ? challengeRow.starter_code_javascript
        : '',
      java: typeof challengeRow.starter_code_java === 'string'
        ? challengeRow.starter_code_java
        : ''
    },
    visibleTests: safeVisibleTests
  };
}
