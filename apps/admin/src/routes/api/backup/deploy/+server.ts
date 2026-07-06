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

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, locals }) => {
    // 1. Session validation (Single admin check via cookies)
    const session = cookies.get('admin_session');
    if (!session) {
        throw error(401, 'Unauthorized');
    }

    const db = locals.blogDb;
    if (!db) {
        throw error(500, 'Database not found');
    }

    try {
        // 2. Query deploy configuration from D1
        const { results } = await db.prepare("SELECT value FROM blog_settings WHERE key = 'deploy_config'").all();
        if (!results || results.length === 0 || !results[0].value) {
            throw error(404, 'Deploy configuration not found in database. Please run deployment to synchronize it.');
        }

        const deployConfig = JSON.parse(results[0].value as string);

        // 3. Return JSON response with direct attachment download header
        return new Response(JSON.stringify(deployConfig, null, 4), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename=wrangler.backup.json'
            }
        });
    } catch (e: any) {
        console.error('Failed to fetch deploy configuration:', e);
        throw error(500, e.message || 'Internal Server Error');
    }
};
