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

/**
 * Storage Adapter - cf-blog (Read-Only Subset)
 * Used only for serving images via the /images/[...path] proxy route.
 * 
 * Supports: R2 (default), KV, Supabase Storage
 * ImageKit: images are served directly via CDN URL — this proxy is not used.
 */

interface ServeResult {
    body: ReadableStream | ArrayBuffer;
    contentType: string;
    etag?: string;
}

/**
 * Returns image data from the configured storage backend.
 * Reads storage_type and related settings from blog_settings DB in one batch.
 */
export async function getImageFromStorage(
    path: string,
    platform: App.Platform,
    db: any
): Promise<ServeResult | null> {
    const dbInstance = db ?? (platform?.env as any)?.BLOG_DB;
    const settingsMap: Record<string, string> = {};

    if (dbInstance) {
        try {
            const keys = [
                'storage_type',
                'supabase_storage_url', 'supabase_storage_key', 'supabase_storage_bucket',
                'imagekit_url_endpoint', 'imagekit_proxy_mode',
            ];
            const placeholders = keys.map(() => '?').join(',');
            const rows = await dbInstance
                .prepare(`SELECT key, value FROM blog_settings WHERE key IN (${placeholders})`)
                .bind(...keys)
                .all();
            const results = (rows.results || []) as Array<{ key: string; value: string }>;
            for (const row of results) {
                settingsMap[row.key] = row.value;
            }
        } catch {
            // Fall back to R2
        }
    }

    const type = settingsMap['storage_type'] || 'kv';

    // KV mode
    if (type === 'kv') {
        const kv = (platform?.env as any)?.IMAGES_KV;
        if (!kv) return null;
        const { value, metadata } = await kv.getWithMetadata<{ contentType: string }>(path, 'arrayBuffer');
        if (!value) return null;
        return {
            body: value,
            contentType: (metadata as any)?.contentType || 'application/octet-stream',
        };
    }

    // ImageKit: CDN direct mode → posts store full CDN URL, proxy route not used.
    // ImageKit: proxy mode → fetch from ImageKit and stream back through /images/ route.
    if (type === 'imagekit') {
        const proxyMode = settingsMap['imagekit_proxy_mode'] === 'true';
        if (!proxyMode) return null; // CDN direct: not served through this proxy

        const urlEndpoint = (settingsMap['imagekit_url_endpoint'] || '').replace(/\/$/, '');
        if (!urlEndpoint) return null;

        const res = await fetch(`${urlEndpoint}/${path}`);
        if (!res.ok) return null;
        return {
            body: await res.arrayBuffer(),
            contentType: res.headers.get('content-type') || 'application/octet-stream',
        };
    }

    // Supabase Storage
    if (type === 'supabase') {
        const storageUrl = settingsMap['supabase_storage_url'] || '';
        const serviceKey = settingsMap['supabase_storage_key'] || '';
        const bucket = settingsMap['supabase_storage_bucket'] || 'images';
        if (!storageUrl || !serviceKey) return null;

        const url = `${storageUrl.replace(/\/$/, '')}/object/${bucket}/${path}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${serviceKey}` },
        });
        if (!res.ok) return null;
        const body = await res.arrayBuffer();
        return {
            body,
            contentType: res.headers.get('content-type') || 'application/octet-stream',
        };
    }

    // Default: R2
    const r2 = (platform?.env as any)?.IMAGES;
    if (!r2) return null;
    try {
        const obj = await r2.get(path);
        if (!obj) return null;
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        return {
            body: obj.body,
            contentType: headers.get('content-type') || 'application/octet-stream',
            etag: obj.httpEtag,
        };
    } catch {
        return null;
    }
}
