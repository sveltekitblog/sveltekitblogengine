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
import type { RequestEvent } from '@sveltejs/kit';

export const actions = {
    default: async ({ request, cookies, platform }: RequestEvent) => {
        const data = await request.formData();
        const password = data.get('password');

        // 환경 변수에서 비밀번호 가져오기
        const correctPassword = platform?.env?.ADMIN_PASSWORD;

        if (!correctPassword) {
            console.error('ADMIN_PASSWORD 환경 변수가 설정되지 않았습니다!');
            return fail(500, { error: 'admin.login.server_config_error' });
        }

        if (password !== correctPassword) {
            return fail(401, { error: 'admin.login.incorrect_password' });
        }

        // 세션 토큰 생성 (간단한 UUID)
        const sessionToken = crypto.randomUUID();

        // 쿠키 설정 (30일 유효, Cloudflare 프록시 환경의 프로토콜 감지 불일치 방지를 위해 secure: false로 조정)
        cookies.set('admin_session', sessionToken, {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30 // 30일
        });

        throw redirect(303, '/');
    }
};
