/**
 * Server-side sessions for the standalone admin application.
 *
 * Cookie values are deliberately not trusted on their own.  Only a SHA-256
 * digest is persisted, so a database read cannot be replayed as a session.
 */
export type AdminSessionType = 'admin' | 'dashboard';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

async function digest(value: string): Promise<string> {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createAdminSession(db: D1Database, type: AdminSessionType): Promise<string> {
    const token = crypto.randomUUID();
    const tokenHash = await digest(token);
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_SECONDS * 1000;

    await db.batch([
        db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
        db.prepare(`
            INSERT INTO admin_sessions (id, token_hash, session_type, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).bind(crypto.randomUUID(), tokenHash, type, expiresAt, now)
    ]);

    return token;
}

export async function hasValidAdminSession(
    db: D1Database | undefined,
    token: string | undefined,
    type: AdminSessionType
): Promise<boolean> {
    if (!db || !token) return false;

    const tokenHash = await digest(token);
    const row = await db.prepare(`
        SELECT 1 FROM admin_sessions
        WHERE token_hash = ? AND session_type = ? AND expires_at > ?
        LIMIT 1
    `).bind(tokenHash, type, Date.now()).first();

    return Boolean(row);
}

export async function revokeAdminSession(db: D1Database | undefined, token: string | undefined): Promise<void> {
    if (!db || !token) return;
    await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await digest(token)).run();
}

export const ADMIN_SESSION_MAX_AGE = SESSION_TTL_SECONDS;
