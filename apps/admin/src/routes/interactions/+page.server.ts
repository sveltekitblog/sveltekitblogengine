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

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
    const db = locals.blogDb;
    const userDb = locals.userDb;
    
    if (!db || !userDb) {
        throw error(500, 'Database connections missing');
    }

    try {
        // Fetch Comments
        const { results: commentResults } = await userDb.prepare(`
            SELECT 
                e.id, e.type, e.target_id as post_id, e.parent_id, e.content, 
                e.is_private, e.is_deleted, e.ip_address, e.created_at,
                u.name as user_name, u.image as user_image, u.email as user_email
            FROM entries e 
            LEFT JOIN user u ON e.user_id = u.id
            WHERE e.type = 'comment'
            ORDER BY e.created_at DESC
            LIMIT 200
        `).all();

        // Fetch Guestbooks
        const { results: gbResults } = await userDb.prepare(`
            SELECT 
                e.id, e.type, e.parent_id, e.content, 
                e.is_private, e.is_deleted, e.ip_address, e.created_at,
                u.name as user_name, u.image as user_image, u.email as user_email
            FROM entries e 
            LEFT JOIN user u ON e.user_id = u.id
            WHERE e.type = 'guestbook'
            ORDER BY e.created_at DESC
            LIMIT 200
        `).all();

        // Fetch Archived (Deleted) Entries
        const { results: archivedResults } = await userDb.prepare(`
            SELECT * FROM deleted_entries ORDER BY deleted_at DESC LIMIT 200
        `).all();

        let comments = Array.from(commentResults || []);
        const guestbooks = Array.from(gbResults || []);

        // Fetch Site URL
        let siteUrl = 'http://localhost:5173';
        try {
            const { results: settings } = await db.prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'").all();
            if (settings?.[0]?.value) siteUrl = JSON.parse(settings[0].value as string);
        } catch(e) {}

        // Map Post Titles for Comments
        if (comments.length > 0) {
            const cPostIds = [...new Set(comments.map((c: any) => c.post_id).filter(id => id != null))];
            
            if (cPostIds.length > 0) {
                const safeIds = cPostIds.map(id => `'${id}'`).join(',');
                // Search both slug and id, because frontend passes slug as targetId
                const { results: postTitles } = await db.prepare(`SELECT id, title, slug, category_slug FROM posts WHERE slug IN (${safeIds}) OR id IN (${safeIds})`).all();
                
                let titleMap: Record<string, any> = {};
                for (const row of postTitles as any[]) { 
                    titleMap[row.id] = { id: row.id, title: row.title, slug: row.slug, category_slug: row.category_slug }; 
                    if (row.slug) {
                        titleMap[row.slug] = { id: row.id, title: row.title, slug: row.slug, category_slug: row.category_slug }; 
                    }
                }
                
                comments = comments.map((c: any) => ({
                    ...c,
                    post_title: titleMap[c.post_id]?.title || '알 수 없는 포스트',
                    actual_post_id: titleMap[c.post_id]?.id || '',
                    post_slug: titleMap[c.post_id]?.slug || '',
                    category_slug: titleMap[c.post_id]?.category_slug || ''
                }));
            }
        }

        const archives = Array.from(archivedResults || []).map((row: any) => {
            let data = {};
            try { data = JSON.parse(row.original_data); } catch(e) {}
            return {
                ...row,
                parsed_data: data
            };
        });

        return {
            comments,
            guestbooks,
            archives,
            siteUrl
        };

    } catch (err: any) {
        console.error('Failed to load interactions:', err);
        return { comments: [], guestbooks: [], archives: [], error: 'Failed to load data' };
    }
};
