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
import { getStorageAdapter } from '$lib/server/storageAdapter';

// GET: List objects with optional prefix
export const GET: RequestHandler = async ({ url, platform, locals }) => {
    const prefix = url.searchParams.get('prefix') || '';
    const cursor = url.searchParams.get('cursor') || undefined;
    const action = url.searchParams.get('action') || undefined;

    const db = locals.blogDb ?? null;

    try {
        const adapter = await getStorageAdapter(platform!, db);
        const result = await adapter.list(prefix, cursor, { action });

        if (result.disabled) {
            // KV mode: scanning is disabled to avoid excessive Workers API call costs
            return json({
                objects: [],
                folders: [],
                truncated: false,
                disabled: true,
                disabledReason: result.disabledReason,
            });
        }

        // Get siteUrl for public image URL resolution
        let siteUrl = '';
        if (db) {
            try {
                const setting = await db
                    .prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'")
                    .first<{ value: string }>();
                if (setting?.value) siteUrl = setting.value;
            } catch (err) {
                console.warn('[Media List] Failed to fetch siteUrl from DB:', err);
            }
        }
        if (siteUrl.endsWith('/')) siteUrl = siteUrl.slice(0, -1);

        const objectsWithUrl = (result.objects || []).map((obj: any) => ({
            ...obj,
            url: adapter.getPublicUrl(obj.key, siteUrl)
        }));

        return json({
            objects: objectsWithUrl,
            folders: result.folders,
            truncated: result.truncated,
            cursor: result.cursor,
        });

    } catch (e: any) {
        console.error('[Media List] Error:', e);
        return json({ error: 'Failed to list media', details: e.message }, { status: 500 });
    }
};

// DELETE: Delete objects by key
export const DELETE: RequestHandler = async ({ request, platform, locals }) => {
    const db = locals.blogDb ?? null;

    try {
        const { keys } = await request.json();

        if (!Array.isArray(keys) || keys.length === 0) {
            return json({ error: 'No keys provided' }, { status: 400 });
        }

        const adapter = await getStorageAdapter(platform!, db);
        await adapter.delete(keys);

        return json({ success: true, deleted: keys.length });

    } catch (e: any) {
        console.error('[Media Delete] Error:', e);
        return json({ error: 'Failed to delete media', details: e.message }, { status: 500 });
    }
};
