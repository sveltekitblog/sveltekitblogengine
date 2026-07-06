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

export const load: PageServerLoad = async ({ params, locals, url, parent, setHeaders }) => {
    const { category } = params;
    const parentData = await parent();
    const { layoutWidgets, settings, categories, isMobile } = parentData;

    const enableCdnCache = settings?.enable_cdn_cache === 'true' || settings?.enable_cdn_cache === true;
    const cdnCacheTtl = Number(settings?.cdn_cache_ttl) || 600;

    if (locals.user) {
        setHeaders({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        });
    } else if (enableCdnCache) {
        setHeaders({
            'Cache-Control': `public, max-age=10, s-maxage=${cdnCacheTtl}`
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

    // Check if there is a CMS page with this slug
    if (locals.db) {
        const cmsPage = await locals.db.getPostBySlugAndLang('all', category, locals.lang || locals.dbDefaultLang, locals.dbDefaultLang);
        if (cmsPage && cmsPage.type === 'page') {
            const pageTitle = getTrans(cmsPage.title);
            const seo = {
                title: `${pageTitle} - ${getTrans(settings?.site_title) || 'Blog'}`,
                description: getTrans(cmsPage.excerpt) || pageTitle,
                url: url.href,
                image: cmsPage.featured_image || settings?.logo || ''
            };
            return { type: 'cms_page', page: cmsPage, layoutWidgets, category, seo };
        }
    }

    // Check for Custom Page in Footer config (Legacy HTML)
    if (settings && settings.footer) {
        let footerConfig = settings.footer;
        if (typeof footerConfig === 'string') {
            try { footerConfig = JSON.parse(footerConfig); } catch(e){}
        }
        if (footerConfig.navLinks && Array.isArray(footerConfig.navLinks)) {
            const customPage = footerConfig.navLinks.find((link: any) => link.url === `/${category}` && link.htmlContent);
            if (customPage) {
                const label = getTrans(customPage.label);
                const seo = {
                    title: `${label} - ${getTrans(settings?.site_title) || 'Blog'}`,
                    description: `${label} 페이지입니다.`,
                    url: url.href,
                    image: settings?.logo || ''
                };
                return { type: 'custom_page', page: customPage, layoutWidgets, category, seo };
            }
        }
    }

    // Verify if this category is valid
    const isValidCategory = (categories || []).some((c: any) => c.slug === category);
    if (!isValidCategory) {
        throw error(404, 'Category Not Found');
    }

    let limit = 20; // default for category maybe different but let's sync with widget if available
    const pcWidget = layoutWidgets?.find((w: any) => w.type === 'PostContent' || w.type === 'post_content');
    if (pcWidget && pcWidget.config) {
        try {
            const rawConfig = typeof pcWidget.config === 'string' ? JSON.parse(pcWidget.config) : pcWidget.config;
            // Handle nested {desktop, mobile} config structure
            const config = isMobile && rawConfig.mobile ? rawConfig.mobile : (rawConfig.desktop || rawConfig);
            if (config.itemsPerPage) limit = Number(config.itemsPerPage);
        } catch (e) {
            console.error("Error parsing PostContent widget config in category", e);
        }
    }

    const pageNum = Number(url.searchParams.get('page')) || 1;
    const rawPosts = locals.db ? await locals.db.getRecentPosts(limit + 1, category, pageNum, limit, locals.lang || locals.dbDefaultLang, locals.dbDefaultLang) : [];
    const hasNextPage = rawPosts.length > limit;
    const posts = rawPosts.slice(0, limit);

    const siteTitle = getTrans(settings?.site_title) || 'Blog';
    let seo = {
        title: `${category} - ${siteTitle}`,
        description: `${category} 카테고리의 포스트 목록입니다. ${getTrans(settings?.description)}`,
        url: url.href,
        image: settings?.logo || ''
    };

    return {
        type: 'category',
        category,
        posts,
        page: pageNum,
        limit,
        hasNextPage,
        layoutWidgets,
        seo
    };
};
