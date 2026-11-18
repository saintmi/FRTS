import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { parse, serialize } from 'cookie';
export const AUTH_SECRET = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-change-me');
if (!AUTH_SECRET) throw new Error('AUTH_SECRET is required in production');
export const COOKIE_NAME = 'frts_session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
export async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}
export function comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}
export function signSession(payload) {
    return jwt.sign(payload, AUTH_SECRET, { expiresIn: COOKIE_MAX_AGE });
}
export function verifySession(token) {
    try {
        return jwt.verify(token, AUTH_SECRET);
    }
    catch {
        return null;
    }
}
export function getSessionFromCookie(cookieHeader) {
    if (!cookieHeader)
        return null;
    const cookies = parse(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token)
        return null;
    return verifySession(token);
}
export function setSessionCookie(token) {
    return serialize(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
    });
}
export function clearSessionCookie() {
    return serialize(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
}
