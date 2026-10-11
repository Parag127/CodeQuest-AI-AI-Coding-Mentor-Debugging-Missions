/**
 * Bug Fingerprint Service
 * Re-exports the unified, canonical Bug Fingerprint implementation from bugFingerprint.js
 * for backward compatibility across existing routes and prototypes.
 */

export {
  classifyBugFingerprint,
  classifyBugFingerprints,
  recordBugFingerprint,
  getLearnerMistakes,
  BUG_PATTERNS,
  FINGERPRINT_CATEGORIES
} from './bugFingerprint.js';
