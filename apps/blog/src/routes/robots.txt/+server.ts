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

export const prerender = false; // 동적 서빙 명시
import { text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
    const defaultRobotsTxt = "User-agent: *\nAllow: /\n";
    const db = locals.db;
    if (!db) {
        return text(defaultRobotsTxt, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    try {
        const settings = await db.getSettings();
        const content = settings.robots_txt ? settings.robots_txt : defaultRobotsTxt;

        return text(content, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=600' // 10분 캐싱
            }
        });
    } catch (err) {
        console.error('Failed to load robots.txt from db:', err);
        return text(defaultRobotsTxt, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
};
