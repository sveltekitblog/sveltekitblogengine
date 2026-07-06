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

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
    const settings = await locals.db.getSettings(locals.lang || locals.dbDefaultLang, locals.dbDefaultLang);
    
    const getTrans = (val: any) => {
        if (!val) return "";
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return parsed[locals.lang || locals.dbDefaultLang] || parsed[locals.dbDefaultLang] || val;
            } catch(e) { return val; }
        }
        if (typeof val === 'object') {
            return val[locals.lang || locals.dbDefaultLang] || val[locals.dbDefaultLang] || Object.values(val)[0] || "";
        }
        return val;
    };

    const siteTitle = getTrans(settings?.site_title) || 'Blog';
    const guestbookTitle = (locals.lang || locals.dbDefaultLang) === 'ko' ? '방명록' : 'Guestbook';

    const enableCdnCache = settings?.enable_cdn_cache === 'true' || settings?.enable_cdn_cache === true;

    if (locals.user) {
        setHeaders({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        });
    } else if (enableCdnCache) {
        // 브라우저 로컬 캐싱은 완전히 금지하여 로그인 꼬임 방지, 오직 Cloudflare 에지만 3분 캐싱 지시
        setHeaders({
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'Cloudflare-CDN-Cache-Control': 'public, max-age=180, stale-while-revalidate=180',
            'Vary': 'Cookie'
        });
    } else {
        setHeaders({
            'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
    }

    return {
        user: locals.user,
        seo: {
            title: `${guestbookTitle} - ${siteTitle}`,
            description: guestbookTitle,
            url: `${settings?.siteUrl || ''}${locals.lang !== locals.dbDefaultLang ? `/${locals.lang}` : ''}/guestbook`
        }
    };
};
