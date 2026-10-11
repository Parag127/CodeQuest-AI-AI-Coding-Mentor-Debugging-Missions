import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.resolve(__dirname, 'schema.sql');
const seedPath = path.resolve(__dirname, 'seed.sql');

export const SCHEMA_SQL = fs.existsSync(schemaPath)
  ? fs.readFileSync(schemaPath, 'utf-8')
  : `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  concept TEXT DEFAULT 'general',
  languages TEXT NOT NULL,
  starter_code_javascript TEXT NOT NULL,
  starter_code_java TEXT NOT NULL,
  hint_level_1 TEXT,
  hint_level_2 TEXT,
  hint_level_3 TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0, 1)),
  stdin TEXT DEFAULT '',
  expected_output TEXT NOT NULL,
  ordinal INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'learner' CHECK(role IN ('learner', 'reviewer')),
  avatar TEXT,
  level TEXT DEFAULT 'Level 1 • Junior Debugger',
  xp INTEGER DEFAULT 100,
  auth_provider TEXT DEFAULT 'local',
  google_id TEXT,
  picture TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_test_cases_challenge_id ON test_cases(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_learner_challenge ON submissions(learner_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_test_results_submission_id ON test_results(submission_id);
CREATE INDEX IF NOT EXISTS idx_hint_history_learner ON hint_history(learner_id);
CREATE INDEX IF NOT EXISTS idx_bug_fingerprints_learner ON bug_fingerprints(learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_progress_learner ON learner_progress(learner_id);
CREATE INDEX IF NOT EXISTS idx_ebyf_reflections_learner ON ebyf_reflections(learner_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
`;

export const SEED_SQL = fs.existsSync(seedPath)
  ? fs.readFileSync(seedPath, 'utf-8')
  : `
INSERT OR IGNORE INTO challenges (
  id, title, description, difficulty, concept, languages,
  starter_code_javascript, starter_code_java,
  hint_level_1, hint_level_2, hint_level_3
) VALUES (
  'largest-number',
  'Find the largest number',
  'Debug the program so it prints the largest integer in the input array.',
  'easy',
  'loop_boundary',
  '["javascript", "java"]',
  'const fs = require(\\'fs\\');\\n\\nfunction findLargest(numbers) {\\n  let max = numbers[0];\\n  for (let i = 1; i < numbers.length - 1; i++) {\\n    if (numbers[i] > max) {\\n      max = numbers[i];\\n    }\\n  }\\n  return max;\\n}\\n\\nconst input = fs.readFileSync(0, \\'utf-8\\').trim();\\nif (input.length > 0) {\\n  const lines = input.split(\\'\\\\n\\');\\n  const numbers = (lines[1] || lines[0]).trim().split(/\\\\s+/).map(Number);\\n  console.log(findLargest(numbers));\\n}',
  'import java.util.Scanner;\\n\\npublic class Main {\\n    public static int findLargest(int[] numbers) {\\n        int max = numbers[0];\\n        for (int i = 1; i < numbers.length - 1; i++) {\\n            if (numbers[i] > max) {\\n                max = numbers[i];\\n            }\\n        }\\n        return max;\\n    }\\n\\n    public static void main(String[] args) {\\n        Scanner scanner = new Scanner(System.in);\\n        if (scanner.hasNextInt()) {\\n            int n = scanner.nextInt();\\n            int[] numbers = new int[n];\\n            for (int i = 0; i < n; i++) {\\n                numbers[i] = scanner.nextInt();\\n            }\\n            System.out.println(findLargest(numbers));\\n        }\\n    }\\n}',
  'The loop may be stopping before it visits every element. Look closely at the loop continuation condition.',
  'Check how many elements your array has versus the highest index your loop reaches. Is the last element ever inspected?',
  'Change the condition \`i < numbers.length - 1\` to \`i < numbers.length\` so that the loop iterates through all elements of the array.'
);

INSERT OR IGNORE INTO test_cases (id, challenge_id, is_public, stdin, expected_output, ordinal)
VALUES
  ('visible-1', 'largest-number', 1, '4\\n2 5 1 9\\n', '9\\n', 1),
  ('visible-2', 'largest-number', 1, '3\\n10 20 30\\n', '30\\n', 2),
  ('visible-3', 'largest-number', 1, '1\\n42\\n', '42\\n', 3),
  ('hidden-1', 'largest-number', 0, '4\\n-10 -5 -20 -1\\n', '-1\\n', 4),
  ('hidden-2', 'largest-number', 0, '4\\n100 50 100 25\\n', '100\\n', 5);
`;
