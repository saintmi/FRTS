import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const { neonMock, queryMock, transactionMock } = vi.hoisted(() => ({
  neonMock: vi.fn(),
  queryMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('@neondatabase/serverless', () => ({ neon: neonMock }));

const secret = 'frts-test-auth-secret';

function token(role: string, sub = '00000000-0000-4000-8000-000000000001') {
  return jwt.sign({ sub, email: role.toLowerCase() + '@test.invalid', role }, secret);
}

async function getHandler() {
  vi.resetModules();
  process.env.AUTH_SECRET = secret;
  process.env.DATABASE_URL = 'postgres://test.invalid/db';
  const api = await import('../api/[[...slug]].ts');
  return api.GET;
}

function makeSql() {
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    queryMock(strings.join('?'), values);
    return {
      strings: [...strings],
      values,
      then(resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve([{ id: 'class-1', name: 'Scoped class', teacher_id: '00000000-0000-4000-8000-000000000001' }]).then(resolve, reject);
      },
    };
  };
  (tag as any).transaction = transactionMock;
  return tag;
}

describe('API role isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    neonMock.mockImplementation(() => makeSql());
    transactionMock.mockResolvedValue([]);
  });

  it('blocks students from the admin-only user directory without querying the database', async () => {
    const GET = await getHandler();
    const response = await GET(new Request('http://localhost/api/users', {
      headers: { cookie: 'frts_session=' + token('STUDENT') },
    }));
    expect(response.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('blocks teachers from the admin-only user directory without querying the database', async () => {
    const GET = await getHandler();
    const response = await GET(new Request('http://localhost/api/users', {
      headers: { cookie: 'frts_session=' + token('TEACHER') },
    }));
    expect(response.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('scopes a teacher class list query to the authenticated teacher id', async () => {
    const GET = await getHandler();
    const response = await GET(new Request('http://localhost/api/classes', {
      headers: { cookie: 'frts_session=' + token('TEACHER') },
    }));
    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledOnce();
    expect(queryMock.mock.calls[0][0]).toContain('WHERE c.teacher_id = ?');
    expect(queryMock.mock.calls[0][1]).toContain('00000000-0000-4000-8000-000000000001');
  });

  it('scopes a student class list query through class_memberships', async () => {
    const GET = await getHandler();
    const response = await GET(new Request('http://localhost/api/classes', {
      headers: { cookie: 'frts_session=' + token('STUDENT') },
    }));
    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledOnce();
    expect(queryMock.mock.calls[0][0]).toContain('JOIN class_memberships');
    expect(queryMock.mock.calls[0][1]).toContain('00000000-0000-4000-8000-000000000001');
  });
  it('writes class creation and its audit event in one transaction', async () => {
    transactionMock.mockResolvedValue([
      [{ id: 'class-created', name: 'New class', teacher_id: '00000000-0000-4000-8000-000000000001' }],
      [],
    ]);
    const GET = await getHandler();
    const response = await GET(new Request('http://localhost/api/classes', {
      method: 'POST',
      headers: {
        cookie: 'frts_session=' + token('TEACHER'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'New class' }),
    }));
    expect(response.status).toBe(201);
    expect(transactionMock).toHaveBeenCalledOnce();
    const [queries] = transactionMock.mock.calls[0];
    expect(queries).toHaveLength(2);
    expect(queries[0].strings.join('?')).toContain('INSERT INTO classes');
    expect(queries[1].strings.join('?')).toContain('INSERT INTO audit_logs');
  });

  it('does not report a class mutation as successful when its audit transaction fails', async () => {
    transactionMock.mockRejectedValue(new Error('injected audit failure'));
    const GET = await getHandler();
    await expect(GET(new Request('http://localhost/api/classes', {
      method: 'POST',
      headers: {
        cookie: 'frts_session=' + token('TEACHER'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Must rollback' }),
    }))).rejects.toThrow('injected audit failure');
    expect(transactionMock).toHaveBeenCalledOnce();
  });

});
