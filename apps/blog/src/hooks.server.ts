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

import { getAuth } from "$lib/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { BlogDB } from "$lib/server/db";
import { userDb } from "@blog/shared/db";
import type { Handle } from "@sveltejs/kit";
import { building } from "$app/environment";
import '$lib/server/storageAdapter';

export const handle: Handle = async ({ event, resolve }) => {
    const user_d1 = event.platform?.env.USER_DB;
    const blog_d1 = event.platform?.env.BLOG_DB;

    // Globally enforce IP logging setting
    let enableIpLogging = false;
    if (blog_d1) {
        try {
            const { results } = await blog_d1.prepare("SELECT value FROM blog_settings WHERE key = 'enable_ip_logging'").all();
            if (results && results[0] && results[0].value === 'true') {
                enableIpLogging = true;
            }
        } catch (e) { }
    }

    // Read auth settings
    let enabledProviders: string[] = [];
    let enableEmailLogin = true;
    if (blog_d1) {
        try {
            const { results } = await blog_d1.prepare("SELECT key, value FROM blog_settings WHERE key IN ('auth_providers', 'enable_email_login')").all();
            if (results) {
                const providersRow = results.find((r: any) => r.key === 'auth_providers');
                if (providersRow && providersRow.value) {
                    enabledProviders = JSON.parse(providersRow.value as string);
                }
                const emailRow = results.find((r: any) => r.key === 'enable_email_login');
                if (emailRow && emailRow.value !== undefined) {
                    enableEmailLogin = emailRow.value !== 'false';
                }
            }
        } catch (e) { }
    }

    if (!enableIpLogging) {
        try {
            event.request.headers.delete("cf-connecting-ip");
            event.request.headers.delete("x-forwarded-for");
            event.request.headers.delete("x-real-ip");
            Object.defineProperty(event, 'getClientAddress', { value: () => '', writable: true });
        } catch (e) { }
    }

    if (event.url.pathname.startsWith("/api/auth")) {
        if (!user_d1) {
            console.error("USER_DB not found");
            return resolve(event);
        }
        const auth = getAuth(userDb(user_d1), enabledProviders, enableEmailLogin, event.url.origin);
        return svelteKitHandler({ event, resolve, auth, building });
    }

    if (!building && user_d1 && blog_d1) {
        event.locals.db = new BlogDB(blog_d1, user_d1);
        event.locals.userDb = userDb(user_d1);

        try {
            const auth = getAuth(userDb(user_d1), enabledProviders, enableEmailLogin, event.url.origin);
            const session = await auth.api.getSession({
                headers: event.request.headers
            });
            event.locals.user = session?.user ?? null;
            event.locals.session = session?.session ?? null;
        } catch (e) {
            console.error('Auth session check failed:', e);
            event.locals.user = null;
            event.locals.session = null;
        }
        event.locals.enabledProviders = enabledProviders;
        event.locals.enableEmailLogin = enableEmailLogin;

        // Language evaluation
        let reqLang: string | undefined = undefined;
        const pathSegments = event.url.pathname.split('/').filter(Boolean);
        let allLangs: any[] = [];
        let langData;
        let dbDefaultLang = 'ko';

        try {
            const { results } = await blog_d1.prepare('SELECT * FROM languages ORDER BY sort_order ASC').all();
            if (results && results.length > 0) {
                allLangs = results as any[];
                dbDefaultLang = allLangs.find(l => l.is_default === 1)?.code || allLangs[0].code || 'ko';
                const potentialLang = pathSegments[0];
                if (potentialLang && allLangs.some(l => l.code === potentialLang)) {
                    reqLang = potentialLang;
                }
                if (reqLang) langData = allLangs.find(l => l.code === reqLang);
                if (!langData) langData = allLangs.find(l => l.is_default === 1) || allLangs[0];
            }
        } catch (e) { }

        event.locals.dbDefaultLang = dbDefaultLang;
        event.locals.lang = langData?.code || dbDefaultLang;
        event.locals.langData = langData || { code: dbDefaultLang, name: dbDefaultLang === 'en' ? 'English' : '한국어', is_default: 1, fallback_message: dbDefaultLang === 'en' ? 'This post is not provided in your language.' : '이 글은 제공되지 않는 언어입니다.' };
        event.locals.languages = allLangs;
    } else {
        event.locals.user = null;
        event.locals.session = null;
        event.locals.lang = 'ko';
        event.locals.dbDefaultLang = 'ko';
        event.locals.langData = { code: 'ko', name: '한국어', is_default: 1, fallback_message: '' };
        event.locals.languages = [];
        event.locals.enabledProviders = [];
    }

    const response = await resolve(event);

    // ---- Security Hardening: Global Security Headers ----
    // We restrict framing, prevent MIME sniffing, and set a robust CSP.
    // Note: frame-src includes 'self' and blob/data for sandboxed iFrames.
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://adservice.google.com https://tpc.googlesyndication.com https://*.google.com https://*.googlesyndication.com https://static.cloudflareinsights.com https://*.adtrafficquality.google",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://*.supabase.co https://*.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google",
        "frame-src 'self' data: blob: https://www.youtube.com https://player.vimeo.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://tpc.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.adtrafficquality.google",
        "frame-ancestors 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "upgrade-insecure-requests"
    ].join('; ');

    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    return response;
};
