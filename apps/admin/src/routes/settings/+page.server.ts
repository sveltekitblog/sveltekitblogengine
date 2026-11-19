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

import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { hashDashboardPassword } from '$lib/server/dashboardPassword';

export const load: PageServerLoad = async ({ locals }) => {
    const db = locals.blogDb;
    const userDb = locals.userDb;
    if (!db) throw error(500, 'Database not found');

    try {
        const [{ results: settingsResults }, { results: languages }] = await Promise.all([
            db.prepare('SELECT key, value FROM blog_settings').all(),
            db.prepare('SELECT * FROM languages ORDER BY sort_order ASC, code ASC').all()
        ]);
        
        // Define default settings
        let settings: Record<string, string> = {
            site_title: 'My Blog',
            description: '',
            siteUrl: '',
            authorName: '',
            head_code: '',
            robots_txt: '',
            ads_txt: '',
            enable_ip_logging: 'false',
            enable_email_login: 'true',
            enable_cdn_cache: 'false',
            cdn_cache_ttl: '86400',
            auth_providers: '[]',
            timezone: 'Asia/Seoul',
            board_hub_url: 'https://hub.sveltekitblog.com',
            board_api_key: '',
            board_auto_syndicate: 'true',
            tag_page_noindex: 'true'
        };

        // Override with DB values
        if (settingsResults) {
            for (const row of settingsResults as any[]) {
                if (row.key in settings || row.key === 'enable_ip_logging' || row.key === 'enable_email_login' || row.key === 'enable_cdn_cache' || row.key === 'cdn_cache_ttl' || row.key === 'timezone' || row.key === 'board_hub_url' || row.key === 'board_api_key' || row.key === 'board_auto_syndicate' || row.key === 'tag_page_noindex') {
                    settings[row.key] = row.value;
                }
            }
        }

        // 관리자 계정 정보 조회
        let adminUser: { id: string; name: string; email: string } | null = null;
        if (userDb) {
            // blog_settings에서 저장된 관리자 ID를 가져옴
            const adminIdRow = await db.prepare("SELECT value FROM blog_settings WHERE key = 'admin_user_id'").first();
            if (adminIdRow?.value) {
                const adminRow = await userDb.prepare(
                    'SELECT id, name, email FROM user WHERE id = ?'
                ).bind(adminIdRow.value).first();
                if (adminRow) {
                    adminUser = adminRow as any;
                }
            }
        }

        // 대시보드 외부 비밀번호 설정 여부 확인
        const dashPassRow = settingsResults ? (settingsResults as any[]).find(r => r.key === 'dashboard_password') : null;
        const hasDashboardPassword = Boolean(dashPassRow?.value && String(dashPassRow.value).trim().length > 0);

        return {
            settings,
            languages: languages || [],
            adminUser,
            hasDashboardPassword
        };
    } catch (err) {
        console.error('Failed to load settings:', err);
        throw error(500, 'Failed to load settings');
    }
};

export const actions: Actions = {
    save: async ({ request, locals }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const settingsToSave = [
            'site_title',
            'description',
            'siteUrl',
            'authorName',
            'head_code',
            'robots_txt',
            'ads_txt',
            'enable_ip_logging',
            'enable_email_login',
            'enable_cdn_cache',
            'cdn_cache_ttl',
            'auth_providers',
            'timezone',
            'board_hub_url',
            'board_api_key',
            'board_auto_syndicate',
            'tag_page_noindex'
        ];

        try {
            const updatedAt = new Date().toISOString();
            const statements: any[] = [];
            
            // Generate UPSERT statements for each setting
            for (const key of settingsToSave) {
                let value;
                if (key === 'site_title' || key === 'description' || key === 'authorName') {
                    // These are expected to be JSON stringified from the frontend multi-lang inputs
                    // We just save the string as is.
                    value = data.get(key) as string || '{}';
                } else if (key === 'enable_ip_logging' || key === 'enable_email_login' || key === 'board_auto_syndicate' || key === 'tag_page_noindex') {
                    value = data.get(key) === 'true' ? 'true' : 'false';
                } else if (key === 'auth_providers') {
                    value = data.get(key) as string || '[]';
                } else {
                    value = data.get(key) as string || '';
                }

                statements.push(
                    db.prepare(`
                        INSERT INTO blog_settings (key, value, updated_at) 
                        VALUES (?, ?, ?) 
                        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
                    `).bind(key, value, updatedAt)
                );
            }

            // 대시보드 모바일 열람 비밀번호 처리
            const clearDashPass = data.get('clear_dashboard_password') === 'true';
            const rawDashPass = (data.get('dashboard_password') as string || '').trim();

            if (clearDashPass) {
                statements.push(
                    db.prepare(`
                        INSERT INTO blog_settings (key, value, updated_at) 
                        VALUES ('dashboard_password', '', ?) 
                        ON CONFLICT(key) DO UPDATE SET value='', updated_at=excluded.updated_at
                    `).bind(updatedAt)
                );
            } else if (rawDashPass) {
                const hash = await hashDashboardPassword(rawDashPass);
                statements.push(
                    db.prepare(`
                        INSERT INTO blog_settings (key, value, updated_at) 
                        VALUES ('dashboard_password', ?, ?) 
                        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
                    `).bind(hash, updatedAt)
                );
            }

            if (statements.length > 0) {
                await db.batch(statements);
            }

            return { success: true };
        } catch (err: any) {
            console.error('Failed to save settings:', err);
            return fail(500, { error: err.message || 'Failed to save settings' });
        }
    }
};
