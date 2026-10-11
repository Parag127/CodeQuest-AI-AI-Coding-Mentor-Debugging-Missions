import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import { initDb } from './db/init.js';
import challengesRouter from './routes/challenges.js';
import submissionsRouter from './routes/submissions.js';
import hintsRouter from './routes/hints.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database schema and seed data on startup
try {
  initDb();
} catch (err) {
  console.error('[DB] Fatal error initializing database:', err);
  process.exit(1);
}

// Allowed CORS origins
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or matching origins
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Learner-Id']
}));

// Body parser with 100kb limit as required by API contract
app.use(express.json({ limit: '100kb' }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'CodeDNA API',
    status: 'Running',
    version: '1.0.0',
    endpoints: [
      { path: '/api/health', method: 'GET', description: 'System health and metrics' },
      { path: '/api/info', method: 'GET', description: 'Runtime and container environment info' },
      { path: '/api/challenges', method: 'GET', description: 'List all programming challenges' },
      { path: '/api/challenges/:id', method: 'GET', description: 'Get challenge details and public test cases' }
    ]
  });
});

// Health check endpoint (Adheres to API_CONTRACT.md)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'codedna-api'
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

// CodeDNA Routes
app.use('/api/challenges', challengesRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/hints', hintsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CodeDNA Backend API running on port ${PORT}`);
  console.log(`🌐 Health check available at http://localhost:${PORT}/api/health`);
  console.log(`📚 Challenges endpoint available at http://localhost:${PORT}/api/challenges`);
});
