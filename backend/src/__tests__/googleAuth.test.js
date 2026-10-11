import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../index.js';

describe('Google OAuth Authentication Feature', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('GET /api/auth/config', () => {
    test('returns oauth configuration status without leaking secrets', async () => {
      const res = await fetch(`${baseUrl}/api/auth/config`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(typeof data.googleConfigured, 'boolean');
      // Must never return client secret
      assert.strictEqual(data.googleClientSecret, undefined);
    });
  });

  describe('POST /api/auth/google', () => {
    test('rejects empty or missing payload with 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /Missing Google authentication payload/i);
    });

    test('rejects invalid or forged Google credential token with 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: 'forged_fake_google_jwt_token' })
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error);
    });

    test('successfully authenticates and provisions user via demo Google profile', async () => {
      const uniqueGoogleEmail = `google_user_${Date.now()}@gmail.com`;
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demoGoogleUser: {
            email: uniqueGoogleEmail,
            name: 'Google Test Learner',
            picture: 'https://lh3.googleusercontent.com/a/demo-avatar'
          },
          role: 'learner'
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.token);
      assert.strictEqual(data.user.email, uniqueGoogleEmail);
      assert.strictEqual(data.user.name, 'Google Test Learner');
      assert.strictEqual(data.user.authProvider, 'google');
      assert.strictEqual(data.user.role, 'learner');
    });

    test('supports mentor/reviewer role assignment for Google sign in', async () => {
      const uniqueGoogleEmail = `google_mentor_${Date.now()}@dypatil.edu`;
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demoGoogleUser: {
            email: uniqueGoogleEmail,
            name: 'Dr. Mentor'
          },
          role: 'reviewer'
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.role, 'reviewer');
      assert.strictEqual(data.user.authProvider, 'google');
    });

    test('validates that demo Google email is properly formatted', async () => {
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demoGoogleUser: {
            email: 'not-an-email'
          }
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /Valid email is required/i);
    });
  });

  describe('GET /api/auth/google redirection', () => {
    test('redirects gracefully without crashing when client id is not configured', async () => {
      const res = await fetch(`${baseUrl}/api/auth/google?role=learner`, {
        redirect: 'manual'
      });
      // Should redirect (302) to frontend with error or Google URL
      assert.strictEqual(res.status, 302);
      const location = res.headers.get('location');
      assert.ok(location);
      assert.ok(location.includes('google_error') || location.includes('accounts.google.com'));
    });
  });

  describe('GET /api/auth/me session verification', () => {
    test('returns 401 when authorization header is missing', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      assert.strictEqual(res.status, 401);
    });

    test('returns user profile when valid session bearer token is provided', async () => {
      // First login with demo credentials
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'learner@dypatil.edu', password: 'password123' })
      });
      const loginData = await loginRes.json();
      assert.ok(loginData.token);

      // Now query /api/auth/me
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${loginData.token}` }
      });
      assert.strictEqual(meRes.status, 200);
      const meData = await meRes.json();
      assert.strictEqual(meData.success, true);
      assert.strictEqual(meData.user.email, 'learner@dypatil.edu');
    });
  });
});
