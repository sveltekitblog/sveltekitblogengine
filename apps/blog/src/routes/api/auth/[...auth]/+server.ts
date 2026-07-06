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

import { getAuth } from '$lib/auth';
import { userDb } from '@blog/shared/db';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

async function getEnabledProviders(platform: App.Platform | undefined): Promise<string[]> {
    const blog_d1 = platform?.env?.BLOG_DB;
    if (!blog_d1) return [];
    try {
        const { results } = await blog_d1.prepare("SELECT value FROM blog_settings WHERE key = 'auth_providers'").all();
        if (results && results[0] && results[0].value) {
            return JSON.parse(results[0].value as string);
        }
    } catch(e) {}
    return [];
}

export const GET: RequestHandler = async ({ request, platform }) => {
    const user_d1 = platform?.env?.USER_DB;
    if (!user_d1) {
        return new Response('Database not available', { status: 500 });
    }

    console.log("[Auth Debug] GET request to:", request.url);
    console.log("[Auth Debug] BETTER_AUTH_URL env:", env.BETTER_AUTH_URL);

    const enabledProviders = await getEnabledProviders(platform);
    const auth = getAuth(userDb(user_d1), enabledProviders);
    return auth.handler(request);
};

export const POST: RequestHandler = async ({ request, platform }) => {
    const user_d1 = platform?.env?.USER_DB;
    if (!user_d1) {
        return new Response('Database not available', { status: 500 });
    }

    console.log("[Auth Debug] POST request to:", request.url);
    console.log("[Auth Debug] BETTER_AUTH_URL env:", env.BETTER_AUTH_URL);

    const enabledProviders = await getEnabledProviders(platform);
    const auth = getAuth(userDb(user_d1), enabledProviders);
    return auth.handler(request);
};
