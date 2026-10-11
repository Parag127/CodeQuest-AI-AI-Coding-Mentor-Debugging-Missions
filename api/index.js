// Vercel Serverless Function entrypoint for full-stack API and OAuth routing
import app from '../backend/src/index.js';

export default async function handler(req, res) {
  // If an external backend URL is specified (e.g. Render / Railway / Fly), proxy to it
  if (process.env.BACKEND_URL) {
    try {
      const backendUrl = process.env.BACKEND_URL.replace(/\/$/, '');
      const targetUrl = `${backendUrl}${req.url}`;
      const headers = { ...req.headers };
      delete headers.host;

      const fetchOptions = {
        method: req.method,
        headers,
        redirect: 'manual'
      };

      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
        headers['content-type'] = headers['content-type'] || 'application/json';
      }

      const backendRes = await fetch(targetUrl, fetchOptions);
      res.status(backendRes.status);

      backendRes.headers.forEach((val, key) => {
        if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, val);
        }
      });

      const buffer = await backendRes.arrayBuffer();
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.warn('[Vercel Serverless] Upstream backend proxy error:', err);
    }
  }

  // Otherwise, handle request directly with containerized Express app
  return app(req, res);
}
