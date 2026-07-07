/**
 * Copyright (C) 2026 kimteamjang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    const userDb = locals.userDb;
    const blogDb = locals.blogDb;
    if (!userDb || !blogDb) return json({ error: 'Database not bound' }, { status: 500 });
    
    try {
        const body = (await request.json()) as any;
        
        if (body.action === 'restore') {
            const { id, ids } = body;
            const targetIds = ids && Array.isArray(ids) ? ids : (id ? [id] : []);
            
            for (const targetId of targetIds) {
                const archive = await userDb.prepare(`SELECT * FROM deleted_entries WHERE id = ?`).bind(targetId).first();
                if (archive && archive.original_data) {
                    const data = JSON.parse(archive.original_data as string);
                    // Handle both Drizzle camelCase and raw SQL snake_case keys
                    await userDb.prepare(`
                        INSERT OR REPLACE INTO entries (id, type, target_id, user_id, parent_id, content, is_private, is_deleted, ip_address, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        data.id, 
                        data.type, 
                        data.targetId ?? data.target_id ?? null, 
                        data.userId ?? data.user_id, 
                        data.parentId ?? data.parent_id ?? null, 
                        data.content, 
                        (data.isPrivate || data.is_private) ? 1 : 0, 
                        (data.isDeleted || data.is_deleted) ? 1 : 0, 
                        data.ipAddress ?? data.ip_address ?? null, 
                        data.createdAt ?? data.created_at
                    ).run();
                    await userDb.prepare(`DELETE FROM deleted_entries WHERE id = ?`).bind(targetId).run();
                }
            }
            return json({ success: true });
        }

        const { target_id, parent_id, content, type } = body;
        
        if (!content || !type) return json({ error: 'Missing content or type' }, { status: 400 });

        // 1. 저장된 관리자 계정 ID 조회
        const adminIdRow = await blogDb.prepare(
            "SELECT value FROM blog_settings WHERE key = 'admin_user_id'"
        ).first();

        if (!adminIdRow?.value) {
            return json({ 
                error: 'admin.interactions.no_admin_account' 
            }, { status: 400 });
        }

        const adminUserId = adminIdRow.value as string;

        // 2. 유저 존재 확인 (user-db에 실제로 있는지 검증)
        const adminUserRow = await userDb.prepare('SELECT id FROM user WHERE id = ?').bind(adminUserId).first();
        if (!adminUserRow) {
            return json({ 
                error: 'admin.interactions.admin_data_corrupted' 
            }, { status: 400 });
        }

        // 3. Insert reply entry
        const entryId = crypto.randomUUID();
        await userDb.prepare(`
            INSERT INTO entries (id, type, target_id, user_id, parent_id, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+9 hours'))
        `).bind(
            entryId, 
            type, 
            target_id || null, 
            adminUserId, 
            parent_id || null, 
            content
        ).run();

        return json({ success: true, id: entryId });
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};

export const PUT: RequestHandler = async ({ request, locals }) => {
    const userDb = locals.userDb;
    if (!userDb) return json({ error: 'Database not bound' }, { status: 500 });
    
    try {
        const body = (await request.json()) as any;
        const { id, content } = body;
        if (!id || !content) return json({ error: 'Missing variables' }, { status: 400 });

        await userDb.prepare(`UPDATE entries SET content = ? WHERE id = ?`).bind(content, id).run();
        return json({ success: true });
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
    const userDb = locals.userDb;
    if (!userDb) return json({ error: 'Database not bound' }, { status: 500 });
    
    try {
        const body = (await request.json()) as any;
        const { id, is_deleted } = body;
        if (!id || is_deleted === undefined) return json({ error: 'Missing variables' }, { status: 400 });

        await userDb.prepare(`UPDATE entries SET is_deleted = ? WHERE id = ?`).bind(is_deleted ? 1 : 0, id).run();
        return json({ success: true });
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async ({ request, url, locals }) => {
    const userDb = locals.userDb;
    if (!userDb) return json({ error: 'Database not bound' }, { status: 500 });

    try {
        // DELETE requires ID or IDs from query params
        const id = url.searchParams.get('id');
        const idsStr = url.searchParams.get('ids');
        const action = url.searchParams.get('action');
        if (!id && !idsStr) return json({ error: 'Missing ID or IDs' }, { status: 400 });

        const targetIds = idsStr ? idsStr.split(',') : (id ? [id] : []);

        if (action === 'hard_purge') {
            for (const targetId of targetIds) {
                await userDb.prepare(`DELETE FROM deleted_entries WHERE id = ?`).bind(targetId).run();
            }
            return json({ success: true });
        }

        // Archive target entry
        const target = await userDb.prepare(`
            SELECT e.*, u.name as user_name, u.email as user_email
            FROM entries e
            LEFT JOIN user u ON e.user_id = u.id
            WHERE e.id = ?
        `).bind(id).first();
        if (target) {
            await userDb.prepare(`
                INSERT OR IGNORE INTO deleted_entries (id, deleted_by, original_data, deleted_at)
                VALUES (?, 'admin', ?, datetime('now', '+9 hours'))
            `).bind(target.id, JSON.stringify(target)).run();
        }

        // Archive child entries
        const children = await userDb.prepare(`
            SELECT e.*, u.name as user_name, u.email as user_email
            FROM entries e
            LEFT JOIN user u ON e.user_id = u.id
            WHERE e.parent_id = ?
        `).bind(id).all();
        if (children && children.results) {
            for (const child of children.results) {
                await userDb.prepare(`
                    INSERT OR IGNORE INTO deleted_entries (id, deleted_by, original_data, deleted_at)
                    VALUES (?, 'admin', ?, datetime('now', '+9 hours'))
                `).bind(child.id as string, JSON.stringify(child)).run();
            }
        }

        await userDb.prepare(`DELETE FROM entries WHERE id = ?`).bind(id).run();
        await userDb.prepare(`DELETE FROM entries WHERE parent_id = ?`).bind(id).run();

        return json({ success: true });
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};
