import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';

import aiRouter from './routes/ai.js';
import hintsRouter from './routes/hints.js';
import ebyfRouter from './routes/explainBeforeFix.js';
import progressRouter from './routes/progress.js';
import recommendationsRouter from './routes/recommendations.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request size limit enforcement per security rules
app.use(express.json({ limit: '100kb' }));

// CodeDNA AI & Learning Routes
app.use('/api/ai', aiRouter);
app.use('/api/hints', hintsRouter);
app.use('/api/explain-before-fix', ebyfRouter);
app.use('/api/progress', progressRouter);
app.use('/api/recommendations', recommendationsRouter);

// In-memory demo data store for hackathon starter
let hackathonItems = [
  { id: 1, title: 'Dockerize Backend Service', category: 'DevOps', status: 'Completed', timestamp: new Date().toISOString() },
  { id: 2, title: 'Dockerize Frontend Client', category: 'DevOps', status: 'Completed', timestamp: new Date().toISOString() },
  { id: 3, title: 'Configure Docker Compose Orchestration', category: 'Infrastructure', status: 'Completed', timestamp: new Date().toISOString() },
  { id: 4, title: 'Build Hackathon Feature Prototype', category: 'Product', status: 'In Progress', timestamp: new Date().toISOString() }
];

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Hackathon Starter API',
    status: 'Running',
    version: '1.0.0',
    endpoints: [
      { path: '/api/health', method: 'GET', description: 'System health and metrics' },
      { path: '/api/info', method: 'GET', description: 'Runtime and container environment info' },
      { path: '/api/items', method: 'GET', description: 'Fetch all demo items' },
      { path: '/api/items', method: 'POST', description: 'Create a new demo item' },
      { path: '/api/items/:id', method: 'DELETE', description: 'Delete item by id' },
      { path: '/api/ai/health', method: 'GET', description: 'Gemini AI service health check' },
      { path: '/api/ai/feedback', method: 'POST', description: 'AI diagnostic feedback after code submission' },
      { path: '/api/hints', method: 'POST', description: 'Generate progressive AI debugging hint (Levels 1-3)' },
      { path: '/api/explain-before-fix', method: 'POST', description: 'Learner reflection before fixing bug' },
      { path: '/api/progress/:learnerId', method: 'GET', description: 'Learner progress & recurring mistakes' },
      { path: '/api/recommendations/:learnerId', method: 'GET', description: 'Adaptive challenge recommendation' }
    ]
  });
});

// Health check endpoint (Used by Docker Compose healthcheck and frontend monitor)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
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

// Demo Items CRUD API
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
  console.log(`🚀 Backend API running on port ${PORT}`);
  console.log(`🌐 Health check available at http://localhost:${PORT}/api/health`);
});
