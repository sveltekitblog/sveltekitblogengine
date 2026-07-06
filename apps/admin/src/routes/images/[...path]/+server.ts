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

import type { RequestHandler } from './$types';

const EXT_CONTENT_TYPE: Record<string, string> = {
    webp: 'image/webp',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
};

function inferContentType(path: string, storedType?: string | null): string {
    if (storedType && storedType !== 'application/octet-stream') return storedType;
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    return EXT_CONTENT_TYPE[ext] ?? 'application/octet-stream';
}

/**
 * Image serving route for cf-admin.
 * KV and R2 are handled directly via platform bindings (fast path).
 * ImageKit proxy and Supabase are handled by reading settings from DB.
 */
export const GET: RequestHandler = async ({ params, platform, locals }) => {
    const path = params.path;

    if (!path) {
        return new Response('Path required', { status: 400 });
    }

    try {
        // ── 1. Read all storage settings from DB ─────────────────────
        const db = locals.blogDb ?? platform?.env?.BLOG_DB;
        let storageType = 'kv';
        const settings: Record<string, string> = {};

        if (db) {
            try {
                const keys = ['storage_type', 'imagekit_url_endpoint', 'imagekit_proxy_mode',
                    'supabase_storage_url', 'supabase_storage_key', 'supabase_storage_bucket', 'enable_cdn_cache', 'cdn_cache_ttl'];
                const placeholders = keys.map(() => '?').join(',');
                const rows = await db
                    .prepare(`SELECT key, value FROM blog_settings WHERE key IN (${placeholders})`)
                    .bind(...keys)
                    .all();
                for (const row of (rows.results || []) as { key: string; value: string }[]) {
                    settings[row.key] = row.value;
                }
                if (settings['storage_type']) storageType = settings['storage_type'];
            } catch (dbErr: any) {
                console.warn('[Images] DB read failed, using default storage_type=kv:', dbErr?.message);
            }
        }

        const enableCdnCache = settings['enable_cdn_cache'] === 'true';
        const cdnCacheTtl = parseInt(settings['cdn_cache_ttl'] || '600', 10);
        const cacheControl = enableCdnCache
            ? `public, max-age=${cdnCacheTtl}, immutable`
            : 'no-cache, no-store, must-revalidate';

        // ── 2. KV ────────────────────────────────────────────────────
        if (storageType === 'kv') {
            const kv = platform?.env?.IMAGES_KV;
            if (!kv) {
                return new Response('IMAGES_KV binding not configured', { status: 503 });
            }
            const { value: data, metadata } = await kv.getWithMetadata<{ contentType?: string }>(path, 'arrayBuffer');
            if (!data) {
                return new Response(`Image not found in KV: ${path}`, { status: 404 });
            }
            const contentType = inferContentType(path, (metadata as any)?.contentType);
            return new Response(data as ArrayBuffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': cacheControl,
                },
            });
        }

        // ── 3. R2 ────────────────────────────────────────────────────
        if (storageType === 'r2') {
            const r2 = platform?.env?.IMAGES;
            if (!r2) {
                return new Response('R2 binding IMAGES not configured', { status: 503 });
            }
            const obj = await r2.get(path);
            if (!obj) {
                return new Response(`Image not found in R2: ${path}`, { status: 404 });
            }
            const headers = new Headers();
            obj.writeHttpMetadata(headers);
            headers.set('Content-Type', inferContentType(path, headers.get('content-type')));
            headers.set('Cache-Control', cacheControl);
            return new Response(obj.body, { headers });
        }

        // ── 4. ImageKit proxy mode ────────────────────────────────────
        if (storageType === 'imagekit') {
            const proxyMode = settings['imagekit_proxy_mode'] === 'true';
            if (!proxyMode) {
                // Direct CDN mode: images are served by ImageKit CDN directly, not here
                return new Response('ImageKit is in direct CDN mode; images are not proxied via this route.', { status: 400 });
            }
            const urlEndpoint = (settings['imagekit_url_endpoint'] || '').replace(/\/$/, '');
            if (!urlEndpoint) {
                return new Response('ImageKit URL endpoint not configured', { status: 503 });
            }
            const res = await fetch(`${urlEndpoint}/${encodeURI(path)}`);
            if (!res.ok) {
                return new Response(`ImageKit CDN returned ${res.status} for ${path}`, { status: res.status });
            }
            return new Response(await res.arrayBuffer(), {
                headers: {
                    'Content-Type': inferContentType(path, res.headers.get('content-type')),
                    'Cache-Control': cacheControl,
                },
            });
        }

        // ── 5. Supabase Storage ───────────────────────────────────────
        if (storageType === 'supabase') {
            const storageUrl = (settings['supabase_storage_url'] || '').replace(/\/$/, '');
            const serviceKey = settings['supabase_storage_key'] || '';
            const bucket = settings['supabase_storage_bucket'] || 'images';
            if (!storageUrl || !serviceKey) {
                return new Response('Supabase storage settings incomplete', { status: 503 });
            }
            const res = await fetch(`${storageUrl}/object/${bucket}/${encodeURI(path)}`, {
                headers: { Authorization: `Bearer ${serviceKey}` },
            });
            if (!res.ok) {
                return new Response(`Supabase returned ${res.status} for ${path}`, { status: res.status });
            }
            return new Response(await res.arrayBuffer(), {
                headers: {
                    'Content-Type': inferContentType(path, res.headers.get('content-type')),
                    'Cache-Control': cacheControl,
                },
            });
        }

        return new Response(`Unknown storage type: '${storageType}'`, { status: 400 });

    } catch (e: any) {
        const msg = e?.message ?? String(e);
        console.error('[Admin Image Serve] Error:', msg);
        return new Response(`Image serve error: ${msg}`, { status: 500 });
    }
};
