import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path defaults to /tmp on Vercel or backend/data/codedna.db locally
const defaultDbPath = process.env.VERCEL
  ? path.join('/tmp', 'codedna.db')
  : path.resolve(__dirname, '../../data/codedna.db');
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultDbPath;

let db;
try {
  // Ensure database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Initialize SQLite database instance
  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true' ? console.log : null
  });

  // Enable WAL mode and enforce foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.warn('[DB] SQLite initialization warning:', err.message);
  // Safe fallback mock for environments without writable local filesystem
  db = {
    prepare: () => ({
      all: () => [],
      get: () => null,
      run: () => ({ changes: 0, lastInsertRowid: 0 })
    }),
    exec: () => {},
    pragma: () => {}
  };
}

export default db;
export { db, dbPath };
