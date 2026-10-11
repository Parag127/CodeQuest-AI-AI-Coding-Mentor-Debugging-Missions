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

let Database;
try {
  const mod = await import('better-sqlite3');
  Database = mod.default || mod;
} catch (loadErr) {
  console.warn('[DB] better-sqlite3 native binary not available:', loadErr.message);
}

let db;
if (Database) {
  try {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true' ? console.log : null
    });
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  } catch (diskErr) {
    console.warn(`[DB] File SQLite initialization failed at ${dbPath}, trying in-memory SQLite:`, diskErr.message);
    try {
      db = new Database(':memory:');
      db.pragma('foreign_keys = ON');
    } catch (memErr) {
      console.warn('[DB] In-memory SQLite failed:', memErr.message);
    }
  }
}

if (!db) {
  console.warn('[DB] Running with pure JS in-memory database mock fallback');
  // Built-in seed data for environments where native SQLite binary cannot run
  const mockChallenges = [
    {
      id: 'largest-number',
      title: 'Find the largest number',
      description: 'Debug the program so it prints the largest integer in the input array.',
      difficulty: 'easy',
      concept: 'loop_boundary',
      languages: '["javascript", "java"]',
      starter_code_javascript: `const fs = require('fs');

function findLargest(numbers) {
  let max = numbers[0];
  for (let i = 1; i < numbers.length - 1; i++) {
    if (numbers[i] > max) {
      max = numbers[i];
    }
  }
  return max;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input.length > 0) {
  const lines = input.split('\\n');
  const numbers = (lines[1] || lines[0]).trim().split(/\\s+/).map(Number);
  console.log(findLargest(numbers));
}`,
      starter_code_java: `import java.util.Scanner;

public class Main {
    public static int findLargest(int[] numbers) {
        int max = numbers[0];
        for (let i = 1; i < numbers.length - 1; i++) {
            if (numbers[i] > max) {
                max = numbers[i];
            }
        }
        return max;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int n = scanner.nextInt();
            int[] numbers = new int[n];
            for (int i = 0; i < n; i++) {
                numbers[i] = scanner.nextInt();
            }
            System.out.println(findLargest(numbers));
        }
    }
}`,
      hint_level_1: 'The loop may be stopping before it visits every element. Look closely at the loop continuation condition.',
      hint_level_2: 'Check how many elements your array has versus the highest index your loop reaches. Is the last element ever inspected?',
      hint_level_3: 'Change the condition i < numbers.length - 1 to i < numbers.length so that the loop iterates through all elements of the array.'
    },
    {
      id: 'reverse-string',
      title: 'Reverse a String',
      description: 'Write a function or program that reads a string from standard input and prints the reversed string to standard output.',
      difficulty: 'easy',
      concept: 'string_reversal',
      languages: '["javascript", "java"]',
      starter_code_javascript: `const fs = require('fs');

function solution(str) {
  return str;
}

const input = fs.readFileSync(0, 'utf-8').trim();
console.log(solution(input));`,
      starter_code_java: `import java.util.Scanner;

public class Main {
    public static String solution(String str) {
        return str;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextLine()) {
            String input = scanner.nextLine();
            System.out.println(solution(input));
        }
    }
}`,
      hint_level_1: 'Think about how you can access characters of a string starting from the last index and moving backwards towards 0.',
      hint_level_2: 'In JavaScript, strings can be split into character arrays (.split("")), reversed (.reverse()), and joined (.join("")). In Java, use StringBuilder(str).reverse().toString().',
      hint_level_3: 'If using a loop, start at str.length - 1 and decrement i until i >= 0.'
    },
    {
      id: 'sum-positive',
      title: 'Sum Positive Numbers',
      description: 'Debug the program so it sums only the positive integers (greater than 0) in the input array. If the array is empty or contains no positive numbers, it must print 0.',
      difficulty: 'easy',
      concept: 'array_conditions',
      languages: '["javascript", "java"]',
      starter_code_javascript: `const fs = require('fs');

function sumPositive(numbers) {
  let total = 0;
  for (let i = 0; i < numbers.length; i++) {
    total += numbers[i];
  }
  return total;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (!input) {
  console.log(0);
} else {
  const lines = input.split('\\n');
  const count = parseInt(lines[0], 10);
  if (count === 0 || !lines[1]) {
    console.log(0);
  } else {
    const numbers = lines[1].trim().split(/\\s+/).map(Number);
    console.log(sumPositive(numbers));
  }
}`,
      starter_code_java: `import java.util.Scanner;

public class Main {
    public static int sumPositive(int[] numbers) {
        int total = 0;
        for (int i = 0; i < numbers.length; i++) {
            total += numbers[i];
        }
        return total;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int n = scanner.nextInt();
            if (n <= 0) {
                System.out.println(0);
                return;
            }
            int[] numbers = new int[n];
            for (int i = 0; i < n; i++) {
                numbers[i] = scanner.nextInt();
            }
            System.out.println(sumPositive(numbers));
        } else {
            System.out.println(0);
        }
    }
}`,
      hint_level_1: 'Check the condition inside your loop. Are you adding every number, or only numbers greater than zero?',
      hint_level_2: 'Add an if (numbers[i] > 0) check inside the loop so negative numbers are skipped and not added to the total.',
      hint_level_3: 'Change total += numbers[i]; to if (numbers[i] > 0) { total += numbers[i]; }.'
    }
  ];

  const mockTestCases = [
    { id: 'visible-1', challenge_id: 'largest-number', is_public: 1, stdin: '4\n2 5 1 9\n', expected_output: '9\n', ordinal: 1 },
    { id: 'visible-2', challenge_id: 'largest-number', is_public: 1, stdin: '3\n10 20 30\n', expected_output: '30\n', ordinal: 2 },
    { id: 'visible-3', challenge_id: 'largest-number', is_public: 1, stdin: '1\n42\n', expected_output: '42\n', ordinal: 3 },
    { id: 'hidden-1', challenge_id: 'largest-number', is_public: 0, stdin: '4\n-10 -5 -20 -1\n', expected_output: '-1\n', ordinal: 4 },
    { id: 'hidden-2', challenge_id: 'largest-number', is_public: 0, stdin: '4\n100 50 100 25\n', expected_output: '100\n', ordinal: 5 },
    { id: 'tc-rev-1', challenge_id: 'reverse-string', is_public: 1, stdin: 'hello\n', expected_output: 'olleh\n', ordinal: 1 },
    { id: 'tc-rev-2', challenge_id: 'reverse-string', is_public: 1, stdin: 'world\n', expected_output: 'dlrow\n', ordinal: 2 },
    { id: 'tc-rev-3', challenge_id: 'reverse-string', is_public: 1, stdin: 'CodeDNA\n', expected_output: 'ANDedoC\n', ordinal: 3 },
    { id: 'tc-rev-4-h', challenge_id: 'reverse-string', is_public: 0, stdin: 'racecar\n', expected_output: 'racecar\n', ordinal: 4 },
    { id: 'tc-rev-5-h', challenge_id: 'reverse-string', is_public: 0, stdin: '1234567890\n', expected_output: '0987654321\n', ordinal: 5 },
    { id: 'sum-pos-1', challenge_id: 'sum-positive', is_public: 1, stdin: '4\n1 2 3 4\n', expected_output: '10\n', ordinal: 1 },
    { id: 'sum-pos-2', challenge_id: 'sum-positive', is_public: 1, stdin: '5\n-1 2 -3 4 -5\n', expected_output: '6\n', ordinal: 2 },
    { id: 'sum-pos-3', challenge_id: 'sum-positive', is_public: 1, stdin: '0\n', expected_output: '0\n', ordinal: 3 },
    { id: 'sum-pos-4-h', challenge_id: 'sum-positive', is_public: 0, stdin: '3\n-10 -20 -30\n', expected_output: '0\n', ordinal: 4 },
    { id: 'sum-pos-5-h', challenge_id: 'sum-positive', is_public: 0, stdin: '4\n0 5 0 15\n', expected_output: '20\n', ordinal: 5 }
  ];

  const inMemorySubmissions = new Map();
  const inMemoryUsers = new Map([
    ['learner@dypatil.edu', { id: '3', name: 'DebugMate Learner', email: 'learner@dypatil.edu', password_hash: 'password123', role: 'learner', avatar: 'DL', level: 'Level 4 • Bug Hunter', xp: 1420, auth_provider: 'local' }],
    ['mentor@dypatil.edu', { id: '4', name: 'Lead Reviewer', email: 'mentor@dypatil.edu', password_hash: 'password123', role: 'reviewer', avatar: 'LR', level: 'Mentor & Evaluator', xp: 5000, auth_provider: 'local' }]
  ]);
  const inMemoryHints = [];
  const inMemoryFingerprints = [];

  db = {
    prepare: (sql) => {
      const normalizedSql = sql.toLowerCase().trim();
      return {
        all: (...params) => {
          if (normalizedSql.includes('pragma table_info')) {
            return [];
          }
          if (normalizedSql.includes('from challenges')) {
            return mockChallenges.map(c => ({ ...c }));
          }
          if (normalizedSql.includes('from test_cases')) {
            const chId = params[0];
            const isPublicOnly = normalizedSql.includes('is_public = 1');
            return mockTestCases
              .filter(tc => (!chId || tc.challenge_id === chId) && (!isPublicOnly || tc.is_public === 1))
              .map(tc => ({ ...tc }));
          }
          if (normalizedSql.includes('from bug_fingerprints')) {
            const learnerId = params[0];
            return inMemoryFingerprints.filter(f => !learnerId || f.learner_id === learnerId);
          }
          if (normalizedSql.includes('from ebyf_reflections')) {
            return [];
          }
          return [];
        },
        get: (...params) => {
          if (normalizedSql.includes('count(*)')) {
            if (normalizedSql.includes('from challenges')) return { count: mockChallenges.length };
            if (normalizedSql.includes('from test_cases')) return { count: mockTestCases.length };
            if (normalizedSql.includes('from users')) return { count: inMemoryUsers.size };
            return { count: 0 };
          }
          if (normalizedSql.includes('from challenges where id = ?') || normalizedSql.includes('from challenges where id=?')) {
            const ch = mockChallenges.find(c => c.id === params[0]);
            return ch ? { ...ch } : null;
          }
          if (normalizedSql.includes('from submissions where id = ?')) {
            return inMemorySubmissions.get(params[0]) || null;
          }
          if (normalizedSql.includes('from users where lower(email) = ?')) {
            return inMemoryUsers.get((params[0] || '').toLowerCase()) || null;
          }
          if (normalizedSql.includes('max(hint_level)')) {
            const subId = params[0];
            const hints = inMemoryHints.filter(h => h.submission_id === subId);
            return { maxLevel: hints.length ? Math.max(...hints.map(h => h.hint_level)) : 0 };
          }
          return null;
        },
        run: (...params) => {
          if (normalizedSql.includes('insert into submissions')) {
            const [id, learner_id, challenge_id, language, code, pred, exp, status, pass_c, fail_c] = params;
            inMemorySubmissions.set(id, { id, learner_id, challenge_id, language, code, status, pass_count: pass_c, fail_count: fail_c });
          } else if (normalizedSql.includes('insert into users')) {
            const [id, name, email, password_hash, role, avatar, level, xp, provider] = params;
            inMemoryUsers.set(email.toLowerCase(), { id, name, email, password_hash, role, avatar, level, xp, auth_provider: provider });
          } else if (normalizedSql.includes('insert into hint_history')) {
            const [id, learner_id, submission_id, challenge_id, hint_level, hint_text, is_fallback] = params;
            inMemoryHints.push({ id, learner_id, submission_id, challenge_id, hint_level, hint_text, is_fallback });
          } else if (normalizedSql.includes('insert into bug_fingerprints')) {
            const [id, learner_id, challenge_id, submission_id, pattern_key, language, confidence, evidence] = params;
            inMemoryFingerprints.push({ id, learner_id, challenge_id, submission_id, pattern_key, language, confidence, evidence });
          }
          return { changes: 1, lastInsertRowid: Date.now() };
        }
      };
    },
    exec: () => {},
    pragma: () => {}
  };
}

export default db;
export { db, dbPath };

