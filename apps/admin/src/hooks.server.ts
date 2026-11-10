/**
 * Copyright (C) 2026 SvelteKit Blog Engine
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

import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    // 1. D1 바인딩을 최우선으로 locals에 저장 (모든 라우트에서 DB 접근 보장)
    event.locals.blogDb = event.platform?.env?.BLOG_DB;
    event.locals.userDb = event.platform?.env?.USER_DB;
    event.locals.isDashboardOnly = false;

    const pathname = event.url.pathname;

    // 2. 정적 자산(CSS/JS 번들, 이미지, 파비콘)은 IP/인증 체크 없이 즉시 통과
    if (
        pathname.startsWith('/_app/') ||
        pathname.startsWith('/images/') ||
        pathname === '/favicon.png'
    ) {
        return resolve(event);
    }

    // 3. [IP 접근 제어] ALLOWED_IP 설정 시 외부 IP 판별
    const allowedIP = event.platform?.env?.ALLOWED_IP;
    let isExternalIP = false;

    if (allowedIP) {
        const clientIP = event.request.headers.get('cf-connecting-ip') || '';
        const allowedIPs = allowedIP.split(/[\s,]+/).map(ip => ip.trim()).filter(Boolean);
        const isAllowed = allowedIPs.includes(clientIP);

        // 허용되지 않은 외부 IP인 경우:
        if (!isAllowed) {
            isExternalIP = true;
            // 외부 IP에서는 대시보드 관련 라우트(데이터 페칭 /__data.json 포함)만 통과 허용
            const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
            if (!isDashboardRoute) {
                // 기본 /login, /posts, /settings, /api/analytics/export, 모든 /api/* 원천 차단
                return new Response('403 Forbidden', { status: 403 });
            }
        }
    }

    const adminSession = event.cookies.get('admin_session');
    const dashboardSession = event.cookies.get('dashboard_session');

    // 4. 대시보드 로그인 라우트 (/dashboard/login 및 하위 데이터 요청)
    const isDashLogin = pathname === '/dashboard/login' || pathname.startsWith('/dashboard/login/');
    if (isDashLogin) {
        // 외부 IP인 경우 오직 dashboard_session만 인정 (adminSession 무시)
        const hasValidSession = isExternalIP ? !!dashboardSession : (adminSession || dashboardSession);
        if (hasValidSession && event.request.method === 'GET' && pathname === '/dashboard/login') {
            throw redirect(302, '/dashboard');
        }
        return resolve(event);
    }

    // 5. 대시보드 페이지 라우트 (/dashboard 및 하위 데이터 요청)
    const isDashPage = (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) && !isDashLogin;
    if (isDashPage) {
        // [외부 IP인 경우] admin_session 무시하고 오직 dashboard_session만 요구 + 모바일 모드 강제
        if (isExternalIP) {
            if (!dashboardSession) {
                throw redirect(303, '/dashboard/login');
            }
            event.locals.isDashboardOnly = true;
            return resolve(event);
        }

        // [허용 IP(데스크톱)인 경우] 기존 어드민 세션 또는 대시보드 세션 허용 (풀 어드민 유지)
        if (!adminSession && !dashboardSession) {
            throw redirect(303, '/dashboard/login');
        }
        event.locals.isDashboardOnly = Boolean(dashboardSession && !adminSession);
        return resolve(event);
    }

    // 6. 기본 관리자 라우트 (/login 및 기타 관리 페이지)
    // 기본 로그인 페이지는 인증 체크 패스 (단, 외부 IP는 3단계에서 이미 403 차단됨)
    if (pathname === '/login') {
        return resolve(event);
    }

    // 최고 관리자 세션이 없으면 기본 로그인으로 리다이렉트
    // (dashboard_session만 보유한 사용자는 일반 관리 페이지 접근 불가)
    if (!adminSession) {
        throw redirect(303, '/login');
    }

    return resolve(event);
};
