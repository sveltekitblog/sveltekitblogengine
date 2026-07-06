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

import { redirect } from '@sveltejs/kit';
import { AdminDB } from '$lib/server/db';
import { DEFAULT_THEME } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
    const blogDb = platform?.env?.BLOG_DB;
    if (!blogDb) {
        throw new Error("Database not available");
    }
    const db = new AdminDB(blogDb);
    const id = crypto.randomUUID();

    await db.saveTheme({
        id,
        name: 'New Theme',
        description: 'Created via Admin Panel',
        is_system: false,
        config: DEFAULT_THEME,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });

    throw redirect(303, `/themes/${id}`);
};
