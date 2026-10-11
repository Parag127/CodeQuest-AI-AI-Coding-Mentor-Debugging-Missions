/**
 * Vercel Serverless Function entrypoint for CodeDNA API.
 * Routes all /api/* requests to the Express application backend.
 */
import app from '../backend/src/index.js';

export default function handler(req, res) {
  return app(req, res);
}
