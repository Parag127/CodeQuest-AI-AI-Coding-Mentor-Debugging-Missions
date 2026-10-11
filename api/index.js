/**
 * Vercel Serverless Function entrypoint for DebugMate API.
 * Routes /api requests to the Express application backend.
 */
import app from '../backend/src/index.js';

export default function handler(req, res) {
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'];
  if (matchedPath && matchedPath.startsWith('/api')) {
    req.url = matchedPath;
  }
  return app(req, res);
}
