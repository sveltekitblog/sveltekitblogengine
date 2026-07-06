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

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
    const { tag } = params;
    const db = locals.db;

    if (!db) {
        console.error('Database not available in locals');
        error(500, 'Database connection error');
    }

    try {
        const posts = await db.getPostsByTag(tag, locals.lang || locals.dbDefaultLang, locals.dbDefaultLang);
        const settings = await db.getSettings(locals.lang || locals.dbDefaultLang, locals.dbDefaultLang);

        const getTrans = (val: any) => {
            if (!val) return "";
            if (typeof val === 'string' && val.startsWith('{')) {
                try {
                    const parsed = JSON.parse(val);
                    return parsed[locals.lang || locals.dbDefaultLang] || parsed[locals.dbDefaultLang] || val;
                } catch(e) { return val; }
            }
            if (typeof val === 'object' && val !== null) {
                return val[locals.lang || locals.dbDefaultLang] || val[locals.dbDefaultLang] || Object.values(val)[0] || "";
            }
            return val;
        };

        const siteTitle = getTrans(settings?.site_title) || 'Blog';
        
        return {
            tag,
            posts,
            seo: {
                title: `#${tag} - ${siteTitle}`,
                description: `#${tag} 태그와 관련된 포스트 목록입니다.`,
                url: url.href,
                image: settings?.logo || ''
            },
            settings
        };
    } catch (err) {
        console.error('Error loading tag posts:', err);
        error(500, 'Error loading posts');
    }
};
