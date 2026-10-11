import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/init.js';
import challengesRouter from './routes/challenges.js';
import submissionsRouter from './routes/submissions.js';
import hintsRouter from './routes/hints.js';
import aiRouter from './routes/ai.js';
import ebyfRouter from './routes/explainBeforeFix.js';
import progressRouter from './routes/progress.js';
import recommendationsRouter from './routes/recommendations.js';
import authRouter from './routes/auth.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy headers for Vercel, Render, and reverse proxies (enables correct https detection)
app.set('trust proxy', 1);

// Initialize Database schema and seed data on startup
try {
  initDb();
} catch (err) {
  console.error('[DB] Database initialization warning:', err.message);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}

// In Vercel or cloud environments, default to mock runner if no external runner API is provided
if (process.env.VERCEL && !process.env.JUDGE0_API_URL && process.env.JUDGE0_MOCK_RUNNER === undefined) {
  process.env.JUDGE0_MOCK_RUNNER = 'true';
}

// Allowed CORS origins
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests, allowed origins, wildcards, or Vercel preview/production domains
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes('*') ||
      origin.includes('vercel.app') ||
      process.env.NODE_ENV !== 'production'
    ) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Learner-Id']
}));

// Body parser with 100kb limit as required by API contract and security rules
app.use(express.json({ limit: '100kb' }));

// In-memory sprint items store
let hackathonItems = [
  { id: 1, title: 'Dockerize Backend Service', category: 'DevOps', status: 'Completed', timestamp: new Date().toISOString() },
  { id: 2, title: 'Build CodeDNA Microservice', category: 'DevOps', status: 'Completed', timestamp: new Date().toISOString() },
  { id: 3, title: 'Configure AI Hint Pipeline', category: 'AI', status: 'In Progress', timestamp: new Date().toISOString() }
];

// Locate production frontend build if available
const staticDistPath = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), 'dist')
].find(p => {
  try { return fs.existsSync(path.join(p, 'index.html')); } catch { return false; }
});

const apiCatalog = {
  name: 'CodeDNA API',
  status: 'Running',
  version: '1.0.0',
  endpoints: [
    { path: '/api/health', method: 'GET', description: 'System health and metrics' },
    { path: '/api/info', method: 'GET', description: 'Runtime and container environment info' },
    { path: '/api/challenges', method: 'GET', description: 'List all programming challenges' },
    { path: '/api/challenges/:id', method: 'GET', description: 'Get challenge details and public test cases' },
    { path: '/api/submissions', method: 'POST', description: 'Submit code execution' },
    { path: '/api/hints', method: 'POST', description: 'Request progressive hint' },
    { path: '/api/items', method: 'GET', description: 'Fetch all sprint items' },
    { path: '/api/items', method: 'POST', description: 'Create sprint item' },
    { path: '/api/items/:id', method: 'DELETE', description: 'Delete sprint item' },
    { path: '/api/auth/login', method: 'POST', description: 'Authenticate user session' },
    { path: '/api/auth/register', method: 'POST', description: 'Register new user account' },
    { path: '/api/auth/google', method: 'POST', description: 'Authenticate or register via Google OAuth' },
    { path: '/api/auth/google', method: 'GET', description: 'Initiate Google OAuth 2.0 authorization redirect' },
    { path: '/api/auth/google/callback', method: 'GET', description: 'Google OAuth 2.0 redirect callback' },
    { path: '/api/auth/config', method: 'GET', description: 'OAuth client configuration status' },
    { path: '/api/auth/me', method: 'GET', description: 'Current authenticated session profile' },
    { path: '/api/ai/health', method: 'GET', description: 'Gemini AI service health check' },
    { path: '/api/ai/feedback', method: 'POST', description: 'AI diagnostic feedback after code submission' },
    { path: '/api/hints', method: 'POST', description: 'Generate progressive AI debugging hint (Levels 1-3)' },
    { path: '/api/explain-before-fix', method: 'POST', description: 'Learner reflection before fixing bug' },
    { path: '/api/progress/:learnerId', method: 'GET', description: 'Learner progress & recurring mistakes' },
    { path: '/api/recommendations/:learnerId', method: 'GET', description: 'Adaptive challenge recommendation' }
  ]
};

// Root endpoint: in production / browser, serve frontend React SPA; otherwise return API catalog JSON
app.get('/', (req, res) => {
  if (staticDistPath && req.accepts('html') && !req.xhr) {
    return res.sendFile(path.join(staticDistPath, 'index.html'));
  }
  res.json(apiCatalog);
});

// Explicit API catalog endpoint
app.get('/api', (req, res) => {
  res.json(apiCatalog);
});

// Authentication routes (Local & Google OAuth 2.0)
app.use('/api/auth', authRouter);

// Health check endpoint (Used by Docker Compose healthcheck and frontend telemetry)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'codedna-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    isDocker: process.env.IS_DOCKER === 'true' || Boolean(process.env.DOCKER_CONTAINER),
    memoryUsageMB: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    }
  });
});

// Container / Runtime info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    isDocker: process.env.IS_DOCKER === 'true' || Boolean(process.env.DOCKER_CONTAINER),
    port: PORT,
    cpus: os.cpus().length,
    totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(os.freemem() / 1024 / 1024)
  });
});

// Sprint Items CRUD API
app.get('/api/items', (req, res) => {
  res.json({
    success: true,
    count: hackathonItems.length,
    data: hackathonItems
  });
});

app.post('/api/items', (req, res) => {
  const { title, category, status } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  const newItem = {
    id: Date.now(),
    title: String(title).trim(),
    category: category ? String(category).trim() : 'General',
    status: status ? String(status).trim() : 'Pending',
    timestamp: new Date().toISOString()
  };

  hackathonItems.unshift(newItem);
  res.status(201).json({ success: true, data: newItem });
});

app.delete('/api/items/:id', (req, res) => {
  const itemId = Number(req.params.id);
  const initialLength = hackathonItems.length;
  hackathonItems = hackathonItems.filter(item => item.id !== itemId);

  if (hackathonItems.length === initialLength) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  res.json({ success: true, message: `Item ${itemId} deleted successfully` });
});

// CodeDNA Routes (Standard /api prefix)
app.use('/api/challenges', challengesRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/hints', hintsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/explain-before-fix', ebyfRouter);
app.use('/api/progress', progressRouter);
app.use('/api/recommendations', recommendationsRouter);

// Fallback mounts without /api prefix (for proxies/serverless adapters that strip /api)
app.use('/challenges', challengesRouter);
app.use('/submissions', submissionsRouter);
app.use('/hints', hintsRouter);
app.use('/ai', aiRouter);
app.use('/explain-before-fix', ebyfRouter);
app.use('/progress', progressRouter);
app.use('/recommendations', recommendationsRouter);
app.use('/auth', authRouter);
app.get('/health', (req, res) => res.redirect('/api/health'));
app.get('/info', (req, res) => res.redirect('/api/info'));

// Serve static client assets and SPA routing fallback in production/standalone deployments
if (staticDistPath) {
  app.use(express.static(staticDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(staticDistPath, 'index.html'));
  });
}

// 404 handler
app.use(notFoundHandler);

// Centralized error handling middleware (handles JSON parse errors, payload limits, CORS, etc.)
app.use(errorHandler);

// Detect if the file is being run directly (e.g. `node src/index.js`) versus imported by a test suite
const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isMainModule = invokedFile === currentFile ||
  (process.argv[1] && (process.argv[1].endsWith('src/index.js') || process.argv[1].endsWith('src\\index.js')));
const isTestEnv = process.env.NODE_ENV === 'test' ||
  process.execArgv.includes('--test') ||
  process.argv.some(arg => typeof arg === 'string' && arg.includes('--test'));

let server;
if (isMainModule && !isTestEnv) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CodeDNA Backend API running on port ${PORT}`);
    console.log(`🌐 Health check available at http://localhost:${PORT}/api/health`);
    console.log(`📚 Challenges endpoint available at http://localhost:${PORT}/api/challenges`);
  });
}

export { server };
export default app;

