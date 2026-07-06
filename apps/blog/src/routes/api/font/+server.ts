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
    const targetUrlRaw = url.searchParams.get('url');
    if (!targetUrlRaw) {
        throw error(400, 'Missing url parameter');
    }

    try {
        const targetUrl = new URL(targetUrlRaw);
        
        // 보안: Google Fonts 도메인(gstatic) 허용
        if (!targetUrl.hostname.endsWith('fonts.gstatic.com')) {
            throw error(403, 'Forbidden domain proxy');
        }

        const response = await fetch(targetUrl.toString(), {
            cf: {
                cacheTtl: 86400,
                cacheEverything: true
            }
        });

        if (!response.ok) {
            throw error(response.status, 'Failed to fetch font');
        }

        return new Response(response.body, {
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'font/woff2',
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (e: any) {
        throw error(500, e.message || 'Server error');
    }
};
