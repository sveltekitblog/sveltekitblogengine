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

// 전역 메모리에 스토리지 설정값 캐싱 (D1 조회 병목 방지)
let cachedSettings: Record<string, string> | null = null;
let cachedSettingsTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분 (300,000ms)

/**
 * Image serving route for cf-blog.
 * Reads storage_type from DB and serves from the appropriate backend.
 * Utilizes Cloudflare Edge Caching (Cache API) and in-memory DB caching to prevent overloads.
 */
export const GET: RequestHandler = async ({ request, params, platform, locals }) => {
    const path = params.path;

    if (!path) {
        return new Response('Path required', { status: 400 });
    }

    try {
        // ── 1. Read storage settings (with In-Memory Caching) ────────
        const db = (locals as any).blogDb ?? (locals as any).db?._d1 ?? platform?.env?.BLOG_DB;
        let storageType = 'kv';
        let settingsMap: Record<string, string> = {};

        const now = Date.now();
        if (cachedSettings && (now - cachedSettingsTimestamp < CACHE_TTL_MS)) {
            settingsMap = cachedSettings;
            if (settingsMap['storage_type']) storageType = settingsMap['storage_type'];
        } else if (db) {
            try {
                const keys = ['storage_type', 'supabase_storage_url', 'supabase_storage_key', 'supabase_storage_bucket', 'imagekit_url_endpoint', 'imagekit_proxy_mode', 'enable_cdn_cache', 'cdn_cache_ttl'];
                const placeholders = keys.map(() => '?').join(',');
                const rows = await db
                    .prepare(`SELECT key, value FROM blog_settings WHERE key IN (${placeholders})`)
                    .bind(...keys)
                    .all();
                for (const row of (rows.results || [])) {
                    settingsMap[row.key] = row.value;
                }
                if (settingsMap['storage_type']) storageType = settingsMap['storage_type'];
                
                // Cache configuration in global memory
                cachedSettings = settingsMap;
                cachedSettingsTimestamp = now;
            } catch (dbErr: any) {
                console.warn('[cf-blog Images] DB read failed, falling back to KV:', dbErr?.message);
            }
        }

        const enableCdnCache = settingsMap['enable_cdn_cache'] === 'true';
        const cdnCacheTtl = parseInt(settingsMap['cdn_cache_ttl'] || '600', 10);
        const cacheControl = enableCdnCache
            ? `public, max-age=${cdnCacheTtl}, immutable`
            : 'no-cache, no-store, must-revalidate';

        // ── 2. Cloudflare Edge Cache Match (Only when CDN caching is enabled) ───────────────────────────
        const cache = (caches as any).default;
        if (enableCdnCache) {
            const cachedResponse = await cache.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }
        }

        let response: Response;

        // ── 3. Fetch image from the selected Storage Adapter ─────────
        if (storageType === 'kv') {
            const kv = (platform?.env as any)?.IMAGES_KV;
            if (!kv) {
                return new Response('IMAGES_KV binding not configured', { status: 503 });
            }
            const { value: data, metadata } = (await kv.getWithMetadata(path, 'arrayBuffer')) as any;
            if (!data) {
                return new Response(`Image not found in KV: ${path}`, { status: 404 });
            }
            const contentType = inferContentType(path, (metadata as any)?.contentType);
            response = new Response(data as ArrayBuffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': cacheControl,
                },
            });
        }
        else if (storageType === 'imagekit') {
            const proxyMode = settingsMap['imagekit_proxy_mode'] === 'true';
            if (!proxyMode) {
                return new Response('ImageKit CDN direct mode: use CDN URL directly', { status: 400 });
            }
            const urlEndpoint = (settingsMap['imagekit_url_endpoint'] || '').replace(/\/$/, '');
            if (!urlEndpoint) return new Response('ImageKit URL endpoint not configured', { status: 503 });
            const res = await fetch(`${urlEndpoint}/${encodeURI(path)}`);
            if (!res.ok) return new Response(`ImageKit fetch failed: ${res.status}`, { status: res.status });
            response = new Response(await res.arrayBuffer(), {
                headers: {
                    'Content-Type': inferContentType(path, res.headers.get('content-type')),
                    'Cache-Control': cacheControl,
                },
            });
        }
        else if (storageType === 'supabase') {
            const storageUrl = settingsMap['supabase_storage_url'] || '';
            const serviceKey = settingsMap['supabase_storage_key'] || '';
            const bucket = settingsMap['supabase_storage_bucket'] || 'images';
            if (!storageUrl || !serviceKey) {
                return new Response('Supabase storage settings incomplete', { status: 503 });
            }
            const url = `${storageUrl.replace(/\/$/, '')}/object/${bucket}/${encodeURI(path)}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${serviceKey}` } });
            if (!res.ok) return new Response(`Supabase fetch failed: ${res.status}`, { status: res.status });
            response = new Response(await res.arrayBuffer(), {
                headers: {
                    'Content-Type': inferContentType(path, res.headers.get('content-type')),
                    'Cache-Control': cacheControl,
                },
            });
        }
        else {
            // Default Fallback: R2 Storage
            const r2 = (platform?.env as any)?.IMAGES;
            if (!r2) return new Response('R2 binding IMAGES not configured', { status: 503 });
            const obj = await r2.get(path);
            if (!obj) return new Response(`Image not found in R2: ${path}`, { status: 404 });
            const headers = new Headers();
            obj.writeHttpMetadata(headers);
            headers.set('Content-Type', inferContentType(path, headers.get('content-type')));
            headers.set('Cache-Control', cacheControl);
            response = new Response(obj.body, { headers });
        }

        // ── 4. Cache successful responses at Cloudflare Edge ─────────
        if (response.status === 200 && enableCdnCache) {
            await cache.put(request, response.clone());
        }

        return response;

    } catch (e: any) {
        const msg = e?.message ?? String(e);
        console.error('[cf-blog Image Serve] Error:', msg, e?.stack);
        return new Response(`Image serve error: ${msg}`, { status: 500 });
    }
};
