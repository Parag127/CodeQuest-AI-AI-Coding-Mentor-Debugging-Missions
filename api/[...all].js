/**
 * Vercel Serverless Function catch-all entrypoint for DebugMate API.
 * Handles subroutes like /api/challenges, /api/submissions, /api/health, etc.
 */
import app from '../backend/src/index.js';

export default function handler(req, res) {
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'];
  if (matchedPath && matchedPath.startsWith('/api')) {
    req.url = matchedPath;
  }
  return app(req, res);
}
