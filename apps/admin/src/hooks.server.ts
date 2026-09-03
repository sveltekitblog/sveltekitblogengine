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

import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    // [IP 접근 제어] CFP 환경변수에 ALLOWED_IP가 설정되어 있으면 IP 체크
    const allowedIP = event.platform?.env?.ALLOWED_IP;
    if (allowedIP) {
        const clientIP = event.request.headers.get('cf-connecting-ip') || '';
        // 콤마(,)나 공백으로 나뉜 허용 IP 목록을 파싱하여 다중 매칭 검증
        const allowedIPs = allowedIP.split(/[\s,]+/).map(ip => ip.trim()).filter(Boolean);
        if (!allowedIPs.includes(clientIP)) {
            return new Response('403 Forbidden', { status: 403 });
        }
    }

    // 로그인 페이지 및 이미지는 인증 체크 패스
    if (event.url.pathname === '/login' || event.url.pathname.startsWith('/images/')) {
        return resolve(event);
    }

    // 세션 쿠키 확인
    const session = event.cookies.get('admin_session');

    if (!session) {
        throw redirect(303, '/login');
    }

    // D1 바인딩을 event.locals에 저장 (편의성)
    event.locals.blogDb = event.platform?.env?.BLOG_DB;
    event.locals.userDb = event.platform?.env?.USER_DB;

    return resolve(event);
};
