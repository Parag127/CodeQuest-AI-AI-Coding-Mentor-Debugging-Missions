import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { dbPath } from './index.js';
import { SCHEMA_SQL, SEED_SQL } from './sqlDefaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initDb() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const seedPath = path.resolve(__dirname, 'seed.sql');

  // Load schema from file or fallback to embedded SQL
  const schemaSql = fs.existsSync(schemaPath)
    ? fs.readFileSync(schemaPath, 'utf-8')
    : SCHEMA_SQL;

  try {
    db.exec(schemaSql);
  } catch (err) {
    console.warn('[DB] Schema execution warning:', err.message);
  }

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

  try {
    db.exec(`
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
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    `);

    // Seed default demo users if users table is empty
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) {
      const insertUser = db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, avatar, level, xp, auth_provider)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertUser.run('1', 'DebugMate Learner', 'learner@debugmate.dev', 'password123', 'learner', 'DL', 'Level 4 • Bug Hunter', 1420, 'local');
      insertUser.run('2', 'Lead Reviewer', 'mentor@debugmate.dev', 'password123', 'reviewer', 'LR', 'Mentor & Evaluator', 5000, 'local');
      insertUser.run('3', 'DebugMate Learner', 'learner@dypatil.edu', 'password123', 'learner', 'DL', 'Level 4 • Bug Hunter', 1420, 'local');
      insertUser.run('4', 'Lead Reviewer', 'mentor@dypatil.edu', 'password123', 'reviewer', 'LR', 'Mentor & Evaluator', 5000, 'local');
    }
  } catch (err) {
    console.warn('[DB] Table check for users skipped:', err.message);
  }

  // Run seed data
  const seedSql = fs.existsSync(seedPath)
    ? fs.readFileSync(seedPath, 'utf-8')
    : SEED_SQL;

  try {
    db.exec(seedSql);
  } catch (err) {
    console.warn('[DB] Seed data execution warning:', err.message);
  }

  let challengeCount = 0;
  let testCaseCount = 0;
  let publicTestCount = 0;
  let hiddenTestCount = 0;

  try {
    challengeCount = db.prepare('SELECT COUNT(*) AS count FROM challenges').get()?.count || 0;
    testCaseCount = db.prepare('SELECT COUNT(*) AS count FROM test_cases').get()?.count || 0;
    publicTestCount = db.prepare('SELECT COUNT(*) AS count FROM test_cases WHERE is_public = 1').get()?.count || 0;
    hiddenTestCount = db.prepare('SELECT COUNT(*) AS count FROM test_cases WHERE is_public = 0').get()?.count || 0;
  } catch (err) {
    console.warn('[DB] Count query check skipped:', err.message);
  }

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
