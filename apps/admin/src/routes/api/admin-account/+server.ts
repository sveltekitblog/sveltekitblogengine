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
import type { RequestHandler } from './$types';

// Better Auth PBKDF2 비밀번호 암호화 해싱 헬퍼 함수
async function hashPassword(password: string) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
    );
    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 10000,
            hash: "SHA-256",
        },
        keyMaterial,
        256
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode(...hashArray));
    const saltBase64 = btoa(String.fromCharCode(...salt));
    return `pbkdf2:10000:${saltBase64}:${hashBase64}`;
}

export const POST: RequestHandler = async ({ request, locals }) => {
    const userDb = locals.userDb;
    const blogDb = locals.blogDb;
    if (!userDb || !blogDb) return json({ error: 'Database not bound' }, { status: 500 });

    try {
        const { name, email, password } = (await request.json()) as any;
        if (!name || !email || !password) {
            return json({ error: 'name, email and password are required' }, { status: 400 });
        }

        // 간단한 이메일 형식 및 패스워드 강도 검증
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json({ error: 'admin.settings.error_invalid_email' }, { status: 400 });
        }
        if (password.length < 8) {
            return json({ error: 'admin.settings.error_password_length' }, { status: 400 });
        }

        // 1. 이미 admin_user_id가 설정되어 있는지 확인
        const existingIdRow = await blogDb.prepare(
            "SELECT value FROM blog_settings WHERE key = 'admin_user_id'"
        ).first();

        let adminId = crypto.randomUUID();
        let isUpdatingGhost = false;

        if (existingIdRow?.value) {
            const tempId = existingIdRow.value as string;
            // 실제 user 테이블에 실물이 있는 유저인지 교차 검증
            const existingUser = await userDb.prepare(
                "SELECT id FROM user WHERE id = ?"
            ).bind(tempId).first();

            if (existingUser?.id) {
                // 실물이 진짜 존재하므로 신규 생성 거부
                return json({ error: 'admin.settings.admin_exists' }, { status: 409 });
            } else {
                // 설정에 ID는 있으나 유저 테이블에 없는 유령 상태 -> 기존 ID 그대로 승계 복구
                adminId = tempId;
                isUpdatingGhost = true;
            }
        }

        const now = Date.now();

        // 2. 동일한 email을 가진 유저가 이미 있는지 확인
        const existingEmailUser = await userDb.prepare(
            "SELECT id FROM user WHERE email = ?"
        ).bind(email).first();

        if (existingEmailUser?.id) {
            return json({ error: 'blog.auth.error_email_in_use' }, { status: 409 });
        }

        // 3. 비밀번호 PBKDF2 해싱 암호화
        const passwordHash = await hashPassword(password);

        // 4. user 테이블에 삽입 (비밀번호 제외)
        // 4. user 및 account 테이블 삽입용 Statement 준비
        const userStmt = userDb.prepare(`
            INSERT INTO user (id, name, email, email_verified, role, created_at, updated_at)
            VALUES (?, ?, ?, 1, 'admin', ?, ?)
        `).bind(adminId, name, email, now, now);

        const accountId = crypto.randomUUID();
        const accountStmt = userDb.prepare(`
            INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(accountId, adminId, 'credential', adminId, passwordHash, now, now);

        // 5. 배치 실행을 통해 원자성(Atomicity) 확보 및 롤백 안전장치 마련
        await userDb.batch([userStmt, accountStmt]);

        // 6. 유령 데이터 덮어쓰기 복구가 아닌 완전 신규 가입일 경우에만 blog_settings에 신규 ID 기록
        if (!isUpdatingGhost) {
            const updatedAt = new Date().toISOString();
            await blogDb.prepare(`
                INSERT INTO blog_settings (key, value, updated_at)
                VALUES ('admin_user_id', ?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
            `).bind(adminId, updatedAt).run();
        }

        return json({
            success: true,
            adminUser: { id: adminId, name, email }
        });
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};

// PATCH 핸들러 (관리자 정보 및 선택적 비밀번호 변경)
export const PATCH: RequestHandler = async ({ request, locals }) => {
    const userDb = locals.userDb;
    const blogDb = locals.blogDb;
    if (!userDb || !blogDb) return json({ error: 'Database not bound' }, { status: 500 });

    try {
        const { name, email, password } = (await request.json()) as any;
        if (!name) return json({ error: 'name is required' }, { status: 400 });

        // 저장된 관리자 ID 조회
        const adminIdRow = await blogDb.prepare(
            "SELECT value FROM blog_settings WHERE key = 'admin_user_id'"
        ).first();
        if (!adminIdRow?.value) {
            return json({ error: 'admin.settings.admin_not_found' }, { status: 404 });
        }

        const adminId = adminIdRow.value as string;
        const now = Date.now();

        // 관리자 이메일 정보 가져오기
        const adminUserRow = await userDb.prepare(
            "SELECT email FROM user WHERE id = ?"
        ).bind(adminId).first();
        if (!adminUserRow) {
            return json({ error: 'admin.settings.admin_not_found' }, { status: 404 });
        }

        let targetEmail = adminUserRow.email;

        // 이메일 변경 처리 및 다른 유저와의 중복 검사
        if (email && email.trim() !== adminUserRow.email) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return json({ error: 'admin.settings.error_invalid_email' }, { status: 400 });
            }
            const emailDuplicate = await userDb.prepare(
                "SELECT id FROM user WHERE email = ? AND id != ?"
            ).bind(email.trim(), adminId).first();
            if (emailDuplicate?.id) {
                return json({ error: 'blog.auth.error_email_in_use' }, { status: 409 });
            }
            targetEmail = email.trim();
        }

        // 1. user 테이블 업데이트용 단일 Statement 준비 (이름, 이메일 통합 수정)
        const updateUserStmt = userDb.prepare(`
            UPDATE user 
            SET name = ?, email = ?, updated_at = ? 
            WHERE id = ?
        `).bind(name, targetEmail, now, adminId);

        let accountStmt: any = null;
        // 비밀번호 수정 처리
        if (password) {
            if (password.length < 8) {
                return json({ error: 'admin.settings.error_password_length' }, { status: 400 });
            }
            const passwordHash = await hashPassword(password);

            // 기존 account 테이블 로컬 자격증명 조회
            const existingAccount = await userDb.prepare(
                "SELECT id FROM account WHERE user_id = ? AND provider_id = 'credential'"
            ).bind(adminId).first();

            if (existingAccount?.id) {
                // 비밀번호 업데이트
                accountStmt = userDb.prepare(`
                    UPDATE account 
                    SET password = ?, updated_at = ? 
                    WHERE user_id = ? AND provider_id = 'credential'
                `).bind(passwordHash, now, adminId);
            } else {
                // 소셜 로그인으로 가입된 상태에서 새로 비밀번호 설정을 원할 때 새로 삽입
                const accountId = crypto.randomUUID();
                accountStmt = userDb.prepare(`
                    INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).bind(accountId, adminId, 'credential', adminId, passwordHash, now, now);
            }
        }

        // 2. 단일 배치 실행 혹은 단독 실행으로 트랜잭션 안정성 보장
        if (accountStmt) {
            await userDb.batch([updateUserStmt, accountStmt]);
        } else {
            await updateUserStmt.run();
        }

        return json({
            success: true,
            adminUser: { id: adminId, name, email: targetEmail }
        });
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};
