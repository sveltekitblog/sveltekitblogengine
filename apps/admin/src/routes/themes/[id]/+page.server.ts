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

import { fail, redirect } from '@sveltejs/kit';
import { AdminDB } from '$lib/server/db';
import type { PageServerLoad, Actions } from './$types';
import type { ThemeVariant } from '$lib/types';

export const load: PageServerLoad = async ({ params, platform }) => {
    const blogDb = platform?.env?.BLOG_DB;
    if (!blogDb) {
        throw new Error("Database not available");
    }
    const db = new AdminDB(blogDb);
    const theme = await db.getTheme(params.id);

    if (!theme) {
        throw redirect(303, '/themes');
    }

    return { theme };
};

export const actions: Actions = {
    save: async ({ request, platform, params }) => {
        const data = await request.formData();
        const name = data.get('name') as string;
        const description = data.get('description') as string;
        const configJson = data.get('config') as string;

        try {
            const config = JSON.parse(configJson);
            const blogDb = platform?.env?.BLOG_DB;
            if (!blogDb) {
                return fail(500, { error: 'Database not available' });
            }
            const db = new AdminDB(blogDb);

            // Get existing to preserve created_at and id
            const existing = await db.getTheme(params.id);
            if (!existing) return fail(404, { error: 'Theme not found' });

            const updated: ThemeVariant = {
                ...existing,
                name,
                description,
                config,
                updated_at: new Date().toISOString() // DB helper handles this too but good to be explicit
            };

            await db.saveTheme(updated);

            return { success: true };
        } catch (e: any) {
            return fail(400, { error: e.message });
        }
    }
};
