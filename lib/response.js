import { parse } from 'cookie';
import { verifySession, COOKIE_NAME } from './auth';
export function json(data, status = 200, init) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
}
export function error(message, status = 400, code) {
    return json({ error: message, code }, status);
}
export async function getBody(req) {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json'))
        return req.json();
    if (ct.includes('multipart/form-data') || ct.includes('form-data')) {
        const fd = await req.formData();
        const out = {};
        fd.forEach((v, k) => {
            if (out[k] !== undefined) {
                if (!Array.isArray(out[k]))
                    out[k] = [out[k]];
                out[k].push(v);
            }
            else {
                out[k] = v;
            }
        });
        return out;
    }
    const t = await req.text();
    try {
        return JSON.parse(t);
    }
    catch {
        return t;
    }
}
function getSessionFromCookie(cookieHeader) {
    if (!cookieHeader)
        return null;
    const token = parse(cookieHeader)[COOKIE_NAME];
    if (!token)
        return null;
    return verifySession(token);
}
export function withAuth(handler, allowedRoles = ['ADMIN', 'TEACHER', 'STUDENT']) {
    return async (req) => {
        const session = getSessionFromCookie(req.headers.get('cookie'));
        if (!session)
            return error('Unauthorized', 401, 'UNAUTHORIZED');
        if (!allowedRoles.includes(session.role))
            return error('Forbidden', 403, 'FORBIDDEN');
        req.session = session;
        return handler(req, session);
    };
}
