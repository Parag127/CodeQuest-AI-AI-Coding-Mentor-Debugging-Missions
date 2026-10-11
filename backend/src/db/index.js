import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path defaults to backend/data/codedna.db unless DB_PATH env var is set
const defaultDbPath = path.resolve(__dirname, '../../data/codedna.db');
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultDbPath;

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database instance
const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true' ? console.log : null
});

// Enable WAL mode and enforce foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
export { db, dbPath };
