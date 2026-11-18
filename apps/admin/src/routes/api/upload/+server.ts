/**
 * Copyright (C) 2026 SvelteKit Blog Engine
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

const BLOCKED_EXTENSIONS = new Set([
    'exe', 'bat', 'cmd', 'sh', 'msi', 'dmg', 'scr', 'vbs', 'com',
    'jar', 'bin', 'app', 'html', 'htm', 'js', 'mjs', 'cjs', 'php', 'ps1'
]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

export const POST: RequestHandler = async ({ request, platform, locals }) => {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const folder = formData.get('folder') as string;
        const filename = formData.get('filename') as string;

        if (!file || !folder || !filename) {
            return json({ error: 'Missing file, folder, or filename' }, { status: 400 });
        }

        const cleanFolder = folder.trim().replace(/^\/+|\/+$/g, '');
        const cleanFilename = filename.trim();
        if (
            !cleanFolder || !cleanFilename ||
            cleanFolder.includes('..') || cleanFolder.includes('\\') ||
            cleanFilename.includes('..') || cleanFilename.includes('/') || cleanFilename.includes('\\')
        ) {
            return json({ error: 'Invalid folder or filename' }, { status: 400 });
        }

        const ext = cleanFilename.split('.').pop()?.toLowerCase() ?? '';
        if (BLOCKED_EXTENSIONS.has(ext)) {
            return json({ error: 'File type is not allowed' }, { status: 400 });
        }

        if (file.size > MAX_UPLOAD_BYTES) {
            return json({ error: 'File size exceeds 25MB limit' }, { status: 413 });
        }

        const buffer = await file.arrayBuffer();
        const key = `${cleanFolder}/${cleanFilename}`;

        const db = locals.blogDb ?? null;
        const adapter = await getStorageAdapter(platform!, db);

        await adapter.put(key, buffer, { contentType: file.type });

        // Get site_url from settings
        let siteUrl = '';
        if (db) {
            const setting = await db
                .prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'")
                .first<{ value: string }>();
            if (setting?.value) siteUrl = setting.value;
        }
        if (siteUrl.endsWith('/')) siteUrl = siteUrl.slice(0, -1);

        // Adapter decides the public URL format (R2/KV → proxy, ImageKit → CDN)
        const publicUrl = adapter.getPublicUrl(key, siteUrl);

        return json({ url: publicUrl });

    } catch (e: any) {
        console.error('[Upload] Error:', e);
        return json({ error: e.message }, { status: 500 });
    }
};
