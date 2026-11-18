import { describe, expect, it } from 'vitest';
import { GET, POST } from '../api/[[...slug]].ts';

const request = (path: string, method = 'GET', body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('FRTS API entrypoint', () => {
  it('returns a healthy ping without requiring a database session', async () => {
    const response = await GET(request('/api/ping'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, service: 'frts-api' });
  });

  it('returns 404 for an unknown API route', async () => {
    const response = await GET(request('/api/route-that-does-not-exist'));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toHaveProperty('error', 'Not found');
  });

  it.each([
    ['GET', '/api/users'],
    ['POST', '/api/users'],
    ['GET', '/api/classes'],
    ['POST', '/api/classes'],
    ['GET', '/api/html'],
    ['POST', '/api/assignments'],
    ['GET', '/api/assignments'],
    ['GET', '/api/attempts'],
    ['GET', '/api/reports'],
    ['GET', '/api/audit'],
  ])('%s %s rejects unauthenticated access before touching the database', async (method, path) => {
    const response = method === 'POST'
      ? await POST(request(path, method, {}))
      : await GET(request(path, method));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects an unauthenticated request for the current session', async () => {
    const response = await GET(request('/api/auth/me'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
