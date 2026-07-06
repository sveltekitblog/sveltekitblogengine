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
    const db = locals.blogDb;
    if (!db) {
        return json({ error: 'Database not found' }, { status: 500 });
    }

    try {
        const body = (await request.json()) as any;
        const { action, payload } = body;

        if (action === 'save_category_group') {
            const { slug, translations } = payload;
            if (!slug || !translations) {
                return json({ error: 'Invalid payload' }, { status: 400 });
            }

            // translations is an array of {lang, name}
            const statements = [];
            for (const t of translations) {
                if (t.name && t.name.trim() !== '') {
                    statements.push(
                        db.prepare(`
                            INSERT INTO categories (slug, lang, name)
                            VALUES (?, ?, ?)
                            ON CONFLICT(slug, lang) DO UPDATE SET name=excluded.name
                        `).bind(slug, t.lang, t.name)
                    );
                }
            }
            
            if (statements.length > 0) {
                await db.batch(statements);
            }

            return json({ success: true });
        } else if (action === 'delete_category_group') {
            const { slug } = payload;
            if (!slug) {
                return json({ error: 'Invalid payload' }, { status: 400 });
            }

            // Delete all language versions of this category
            await db.prepare('DELETE FROM categories WHERE slug = ?').bind(slug).run();
            return json({ success: true });
        } else if (action === 'update_slug') {
            const { oldSlug, newSlug } = payload;
            if (!oldSlug || !newSlug) return json({ error: 'Invalid payload' }, { status: 400 });
            
            // To update slug (which is part of composite PK), we must update all rows.
            await db.prepare('UPDATE categories SET slug = ? WHERE slug = ?').bind(newSlug, oldSlug).run();
            // We should also update posts using this category!
            await db.prepare('UPDATE posts SET category_slug = ? WHERE category_slug = ?').bind(newSlug, oldSlug).run();
            
            return json({ success: true });
        }

        return json({ error: 'Unknown action' }, { status: 400 });

    } catch (err: any) {
        console.error('API Error /api/categories:', err);
        return json({ error: err.message }, { status: 500 });
    }
};
