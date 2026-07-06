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

/**
 * Keys stored in blog_settings for each storage type.
 * All sensitive values (API keys) are stored in blog_settings for simplicity;
 * for production use, consider using wrangler secrets for key-value pairs.
 */
const STORAGE_KEYS = [
    'storage_type',
    // ImageKit
    'imagekit_private_key',
    'imagekit_public_key',
    'imagekit_url_endpoint',
    'imagekit_proxy_mode',
    // Supabase Storage
    'supabase_storage_url',      // e.g. https://<ref>.supabase.co/storage/v1
    'supabase_storage_key',      // service_role key
    'supabase_storage_bucket',   // bucket name, e.g. images
];

// GET: Return all storage settings
export const GET: RequestHandler = async ({ platform, locals }) => {
    const db = locals.blogDb ?? platform?.env?.BLOG_DB;
    if (!db) return json({ error: 'Database not available' }, { status: 500 });

    try {
        const placeholders = STORAGE_KEYS.map(() => '?').join(',');
        const rows = await db
            .prepare(`SELECT key, value FROM blog_settings WHERE key IN (${placeholders})`)
            .bind(...STORAGE_KEYS)
            .all<{ key: string; value: string }>();

        const settings: Record<string, string> = {};
        for (const row of rows.results) {
            settings[row.key] = row.value;
        }
        // Defaults
        if (!settings['storage_type']) settings['storage_type'] = 'kv';

        return json({ settings });
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
};

// POST: Update storage settings
export const POST: RequestHandler = async ({ request, platform, locals }) => {
    const db = locals.blogDb ?? platform?.env?.BLOG_DB;
    if (!db) return json({ error: 'Database not available' }, { status: 500 });

    try {
        const body = await request.json() as Record<string, string>;

        // Only allow known keys
        const allowed = STORAGE_KEYS.filter((k) => k in body);
        if (allowed.length === 0) {
            return json({ error: 'No valid settings provided' }, { status: 400 });
        }

        const now = new Date().toISOString();

        // Use INSERT OR IGNORE + UPDATE pattern to avoid NOT NULL constraint on updated_at.
        // INSERT OR REPLACE internally does DELETE + INSERT, which drops columns not specified.
        const statements = allowed.flatMap((key) => [
            db.prepare(
                'INSERT OR IGNORE INTO blog_settings (key, value, updated_at) VALUES (?, ?, ?)'
            ).bind(key, body[key] ?? '', now),
            db.prepare(
                'UPDATE blog_settings SET value = ?, updated_at = ? WHERE key = ?'
            ).bind(body[key] ?? '', now, key),
        ]);

        await db.batch(statements);

        return json({ success: true, updated: allowed });
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
};
