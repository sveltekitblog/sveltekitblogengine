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

export const load: PageServerLoad = async ({ locals, url, parent, setHeaders }) => {
    const { layoutWidgets, settings, isMobile } = await parent();

    const enableCdnCache = settings?.enable_cdn_cache === 'true' || settings?.enable_cdn_cache === true;
    const cdnCacheTtl = Number(settings?.cdn_cache_ttl) || 86400;

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

    // Helper to get translated string
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

    let limit = 10;
    const pcWidget = layoutWidgets?.find((w: any) => w.type === 'PostContent' || w.type === 'post_content');
    if (pcWidget && pcWidget.config) {
        try {
            const rawConfig = typeof pcWidget.config === 'string' ? JSON.parse(pcWidget.config) : pcWidget.config;
            // Handle nested {desktop, mobile} config structure
            const config = isMobile && rawConfig.mobile ? rawConfig.mobile : (rawConfig.desktop || rawConfig);
            if (config.itemsPerPage) limit = Number(config.itemsPerPage);
        } catch (e) {
            console.error("Error parsing PostContent widget config", e);
        }
    }

    const pageNum = Number(url.searchParams.get('page')) || 1;
    const rawPosts = locals.db ? await locals.db.getRecentPosts(limit + 1, undefined, pageNum, limit, locals.lang || locals.dbDefaultLang, locals.dbDefaultLang) : [];
    const hasNextPage = rawPosts.length > limit;
    const posts = rawPosts.slice(0, limit);

    const siteTitle = getTrans(settings?.header?.logoText) || getTrans(settings?.site_title) || 'Blog';
    const siteDescription = getTrans(settings?.description) || 'Welcome to my blog';

    let lcpImage = "";
    if (posts && posts.length > 0) {
        if (posts[0].featuredImage) {
            const rawImg = posts[0].featuredImage;
            const desktopUrl = rawImg.replace("maxresdefault.jpg", "hqdefault.jpg")
                                     .replace("/mobile/", "/desktop/")
                                     .replace("/thumbnail/", "/desktop/");
            lcpImage = desktopUrl.replace("/desktop/", "/mobile/");
        } else {
            lcpImage = "/images/no_image_placeholder.webp";
        }
    }

    const seo = {
        title: siteTitle,
        description: siteDescription,
        url: url.href,
        image: settings?.logo || ''
    };

    return {
        posts,
        page: pageNum,
        limit,
        hasNextPage,
        seo,
        lcpImage
    };
};
