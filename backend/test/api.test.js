import test from 'node:test';
import assert from 'node:assert/strict';

const API_HOST = process.env.TEST_API_URL || 'http://localhost:5000';

test('GET /api/health returns 200 and healthy status', async () => {
  const res = await fetch(`${API_HOST}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'healthy');
  assert.ok(data.uptimeSeconds !== undefined);
  assert.ok(data.memoryUsageMB !== undefined);
});

test('GET /api/info returns system specifications', async () => {
  const res = await fetch(`${API_HOST}/api/info`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.hostname);
  assert.ok(data.platform);
  assert.ok(data.nodeVersion);
});

test('GET /api/items returns success and array of items', async () => {
  const res = await fetch(`${API_HOST}/api/items`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
});

test('POST /api/items creates new item and DELETE removes it', async () => {
  const createRes = await fetch(`${API_HOST}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test Automated Task', category: 'DevOps' })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.success, true);
  assert.equal(created.data.title, 'Test Automated Task');

  const deleteRes = await fetch(`${API_HOST}/api/items/${created.data.id}`, {
    method: 'DELETE'
  });
  assert.equal(deleteRes.status, 200);
  const deleted = await deleteRes.json();
  assert.equal(deleted.success, true);
});

test('POST /api/auth/login succeeds with demo credentials', async () => {
  const res = await fetch(`${API_HOST}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'learner@dypatil.edu', password: 'password123' })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.token);
  assert.equal(data.user.email, 'learner@dypatil.edu');
});

test('POST /api/auth/register creates a new user account', async () => {
  const uniqueEmail = `test_${Date.now()}@dypatil.edu`;
  const res = await fetch(`${API_HOST}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Automated Tester', email: uniqueEmail, password: 'password123' })
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.token);
  assert.equal(data.user.email, uniqueEmail);
});

