import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { dbPath } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initDb() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const seedPath = path.resolve(__dirname, 'seed.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  // Run schema creation
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  // Column migration checks for existing SQLite files
  try {
    const challengeColumns = db.prepare("PRAGMA table_info(challenges)").all().map(c => c.name);
    if (!challengeColumns.includes('concept')) {
      db.exec("ALTER TABLE challenges ADD COLUMN concept TEXT DEFAULT 'general'");
    }
  } catch (err) {
    console.warn('[DB] Column check for challenges skipped:', err.message);
  }

  try {
    const submissionColumns = db.prepare("PRAGMA table_info(submissions)").all().map(c => c.name);
    if (!submissionColumns.includes('prediction')) {
      db.exec("ALTER TABLE submissions ADD COLUMN prediction TEXT");
    }
    if (!submissionColumns.includes('explanation')) {
      db.exec("ALTER TABLE submissions ADD COLUMN explanation TEXT");
    }
  } catch (err) {
    console.warn('[DB] Column check for submissions skipped:', err.message);
  }

  try {
    const fingerprintColumns = db.prepare("PRAGMA table_info(bug_fingerprints)").all().map(c => c.name);
    if (!fingerprintColumns.includes('confidence')) {
      db.exec("ALTER TABLE bug_fingerprints ADD COLUMN confidence TEXT DEFAULT 'high'");
    }
    if (!fingerprintColumns.includes('evidence')) {
      db.exec("ALTER TABLE bug_fingerprints ADD COLUMN evidence TEXT");
    }
    if (!fingerprintColumns.includes('is_confirmed')) {
      db.exec("ALTER TABLE bug_fingerprints ADD COLUMN is_confirmed INTEGER DEFAULT 1");
    }
  } catch (err) {
    console.warn('[DB] Column check for bug_fingerprints skipped:', err.message);
  }

  try {
    db.exec(`
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
      CREATE INDEX IF NOT EXISTS idx_ebyf_reflections_learner ON ebyf_reflections(learner_id);
    `);
  } catch (err) {
    console.warn('[DB] Table check for ebyf_reflections skipped:', err.message);
  }

  // Run seed data
  if (fs.existsSync(seedPath)) {
    const seedSql = fs.readFileSync(seedPath, 'utf-8');
    db.exec(seedSql);
  }

  const challengeCount = db.prepare('SELECT COUNT(*) AS count FROM challenges').get().count;
  const testCaseCount = db.prepare('SELECT COUNT(*) AS count FROM test_cases').get().count;
  const publicTestCount = db.prepare('SELECT COUNT(*) AS count FROM test_cases WHERE is_public = 1').get().count;
  const hiddenTestCount = db.prepare('SELECT COUNT(*) AS count FROM test_cases WHERE is_public = 0').get().count;

  console.log(`[DB] Database initialized at: ${dbPath}`);
  console.log(`[DB] Challenges: ${challengeCount}`);
  console.log(`[DB] Test cases: ${testCaseCount} (Public: ${publicTestCount}, Hidden: ${hiddenTestCount})`);

  return {
    challengeCount,
    testCaseCount,
    publicTestCount,
    hiddenTestCount
  };
}

// If executed directly from command line (e.g. node src/db/init.js)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    initDb();
    console.log('[DB] Migration and seed completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[DB] Migration failed:', error);
    process.exit(1);
  }
}
