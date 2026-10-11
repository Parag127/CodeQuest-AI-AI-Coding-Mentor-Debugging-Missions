-- CodeDNA SQLite Schema
-- Defines core tables for challenges, test cases, submissions, results, hints, fingerprints, and learner progress.

PRAGMA foreign_keys = ON;

-- Challenges Table
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  concept TEXT DEFAULT 'general',
  languages TEXT NOT NULL, -- JSON array of supported languages: e.g. ["javascript", "java"]
  starter_code_javascript TEXT NOT NULL,
  starter_code_java TEXT NOT NULL,
  hint_level_1 TEXT,
  hint_level_2 TEXT,
  hint_level_3 TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Test Cases Table (Hidden test cases must never be returned to the client)
CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0, 1)),
  stdin TEXT DEFAULT '',
  expected_output TEXT NOT NULL,
  ordinal INTEGER NOT NULL
);

-- Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  learner_id TEXT,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(language IN ('javascript', 'java')),
  code TEXT NOT NULL,
  prediction TEXT,
  explanation TEXT,
  submitted_at TEXT DEFAULT (datetime('now')),
  pass_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'passed', 'failed', 'complete', 'error'))
);

-- Test Results Table (Stores execution outcome per test case)
CREATE TABLE IF NOT EXISTS test_results (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  test_case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('passed', 'wrong_output', 'compile_error', 'runtime_error', 'timeout', 'internal_error')),
  stdout TEXT,
  stderr TEXT,
  time_ms REAL,
  memory_kb INTEGER,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0, 1))
);

-- Hint History Table (Tracks progressive hint requests)
CREATE TABLE IF NOT EXISTS hint_history (
  id TEXT PRIMARY KEY,
  learner_id TEXT,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  hint_level INTEGER NOT NULL CHECK(hint_level IN (1, 2, 3)),
  hint_text TEXT NOT NULL,
  is_fallback INTEGER NOT NULL DEFAULT 0 CHECK(is_fallback IN (0, 1)),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Bug Fingerprints Table (Pattern recurrence tracking)
CREATE TABLE IF NOT EXISTS bug_fingerprints (
  id TEXT PRIMARY KEY,
  learner_id TEXT,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  pattern_key TEXT NOT NULL,
  language TEXT NOT NULL,
  confidence TEXT DEFAULT 'high',
  evidence TEXT,
  is_confirmed INTEGER DEFAULT 1,
  detected_at TEXT DEFAULT (datetime('now'))
);

-- Learner Progress Table (Summary statistics per learner & challenge)
CREATE TABLE IF NOT EXISTS learner_progress (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  attempts INTEGER DEFAULT 0,
  hints_used INTEGER DEFAULT 0,
  best_pass_count INTEGER DEFAULT 0,
  solved INTEGER DEFAULT 0 CHECK(solved IN (0, 1)),
  last_attempt_at TEXT DEFAULT (datetime('now')),
  UNIQUE(learner_id, challenge_id)
);

-- Explain Before You Fix (EBYF) Reflections Table (Persistent storage for learner reasoning attempts)
CREATE TABLE IF NOT EXISTS ebyf_reflections (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  challenge_id TEXT REFERENCES challenges(id) ON DELETE SET NULL,
  question TEXT,
  question_type TEXT,
  explanation TEXT NOT NULL,
  predicted_variable TEXT,
  predicted_value TEXT,
  evaluation TEXT NOT NULL CHECK(evaluation IN ('correct', 'partially_correct', 'incorrect')),
  understood_correctly TEXT,
  to_reconsider TEXT,
  feedback TEXT NOT NULL,
  can_proceed_to_hint INTEGER NOT NULL DEFAULT 1 CHECK(can_proceed_to_hint IN (0, 1)),
  is_fallback INTEGER NOT NULL DEFAULT 0 CHECK(is_fallback IN (0, 1)),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Users Table (Supports local accounts and Google OAuth federated identities)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'learner' CHECK(role IN ('learner', 'reviewer')),
  avatar TEXT,
  level TEXT DEFAULT 'Level 1 • Junior Debugger',
  xp INTEGER DEFAULT 100,
  auth_provider TEXT DEFAULT 'local', -- 'local' or 'google'
  google_id TEXT,
  picture TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performant queries
CREATE INDEX IF NOT EXISTS idx_test_cases_challenge_id ON test_cases(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_learner_challenge ON submissions(learner_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_test_results_submission_id ON test_results(submission_id);
CREATE INDEX IF NOT EXISTS idx_hint_history_learner ON hint_history(learner_id);
CREATE INDEX IF NOT EXISTS idx_bug_fingerprints_learner ON bug_fingerprints(learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_progress_learner ON learner_progress(learner_id);
CREATE INDEX IF NOT EXISTS idx_ebyf_reflections_learner ON ebyf_reflections(learner_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

