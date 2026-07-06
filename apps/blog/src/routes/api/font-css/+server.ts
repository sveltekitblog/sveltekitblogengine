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
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
    const fontNameRaw = url.searchParams.get('name');
    if (!fontNameRaw) {
        throw error(400, 'Missing font name');
    }

    try {
        const fontName = fontNameRaw.trim().replace(/['"]/g, '').replace(/\s+/g, '+');
        const googleUrl = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700;800;900&display=optional`;

        // 최신 브라우저 User-Agent 명시 (WOFF2 포맷 유도)
        const response = await fetch(googleUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            cf: {
                cacheTtl: 86400,
                cacheEverything: true
            }
        });

        if (!response.ok) {
            throw error(response.status, 'Failed to fetch font CSS');
        }

        let cssText = await response.text();
        
        // 외부 통신(gstatic) 경로를 내부 API Proxy(/api/font)로 일괄 치환
        cssText = cssText.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (match, p1) => {
            return `url(/api/font?url=${encodeURIComponent(p1)})`;
        });

        return new Response(cssText, {
            headers: {
                'Content-Type': 'text/css; charset=utf-8',
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (e: any) {
        throw error(500, e.message || 'Server error');
    }
};
