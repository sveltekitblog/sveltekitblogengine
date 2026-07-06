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

import { json } from '@sveltejs/kit';

export const POST = async ({ request, locals }) => {
    const dbDefaultLang = locals.dbDefaultLang || 'ko';
    const { slug, lang = dbDefaultLang } = await request.json() as { slug: string, lang?: string };
    const db = locals.db;

    if (!slug || !db) {
        return json({ error: 'Invalid request' }, { status: 400 });
    }

    try {
        await db.incrementViewCount(slug, lang);
        const count = await db.getViewCount(slug, lang);
        return json({ views: count });
    } catch (e) {
        console.error('Error incrementing view count:', e);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};

export const GET = async ({ url, locals }) => {
    const slug = url.searchParams.get('slug');
    const dbDefaultLang = locals.dbDefaultLang || 'ko';
    const lang = url.searchParams.get('lang') || dbDefaultLang;
    const db = locals.db;

    if (!slug || !db) {
        return json({ error: 'Invalid request' }, { status: 400 });
    }

    try {
        const count = await db.getViewCount(slug, lang);
        return json({ views: count });
    } catch (e) {
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
