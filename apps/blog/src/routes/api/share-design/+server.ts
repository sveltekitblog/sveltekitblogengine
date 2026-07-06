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

const DESIGN_SETTING_KEYS = ['theme', 'header', 'footer', 'widget_shadow_global'];

// 디자인 공유 시 제외할 텍스트/콘텐츠 필드 (사용자별 고유 값)
const HEADER_TEXT_KEYS = ['loginLabel', 'profileLabel', 'menuItems'];
const FOOTER_TEXT_KEYS = ['copyright', 'socialLinks', 'navLinks'];

export const GET: RequestHandler = async ({ platform }) => {
    const db = platform?.env?.BLOG_DB;
    if (!db) {
        return json({ error: 'Database binding (BLOG_DB) not found' }, { status: 500 });
    }

    try {
        // 1. 보안 검증: 디자인 공유 활성화 여부 확인
        const footerSetting = await db
            .prepare("SELECT value FROM blog_settings WHERE key = 'footer'")
            .first<{ value: string }>();

        if (!footerSetting) {
            return json({ error: 'Design sharing is disabled (Settings not found)' }, { status: 403 });
        }

        let parsedFooter;
        try {
            parsedFooter = JSON.parse(footerSetting.value);
        } catch (e) {
            return json({ error: 'Design sharing is disabled (Invalid footer settings)' }, { status: 403 });
        }

        if (!parsedFooter || !parsedFooter.shareDesign) {
            return json({ error: 'Design sharing is disabled' }, { status: 403 });
        }

        // 2. 보안 검증 통과: 화이트리스트 디자인 데이터 쿼리 수행
        const [blogSettingsRes, layoutsRes, widgetsRes, layoutWidgetsRes, languagesRes] = await Promise.all([
            db.prepare('SELECT * FROM blog_settings').all(),
            db.prepare('SELECT * FROM layouts').all(),
            db.prepare('SELECT * FROM widgets').all(),
            db.prepare('SELECT * FROM layout_widgets').all(),
            db.prepare('SELECT * FROM languages').all()
        ]);

        const blogSettings = blogSettingsRes.results || [];
        const layouts = layoutsRes.results || [];
        const widgets = widgetsRes.results || [];
        const layoutWidgets = layoutWidgetsRes.results || [];
        const languages = languagesRes.results || [];

        // 3. 화이트리스트 필터링 적용 (개인정보 원천 차단) + 텍스트 필드 제거 (디자인만 공유)
        const filteredSettings = blogSettings
            .filter((s: any) => DESIGN_SETTING_KEYS.includes(s.key))
            .map((s: any) => {
                if (s.key === 'header' || s.key === 'footer') {
                    try {
                        const parsed = JSON.parse(s.value);
                        const textKeys = s.key === 'header' ? HEADER_TEXT_KEYS : FOOTER_TEXT_KEYS;
                        for (const key of textKeys) {
                            delete parsed[key];
                        }
                        return { ...s, value: JSON.stringify(parsed) };
                    } catch {
                        return s;
                    }
                }
                return s;
            });

        // 4. 표준 백업 포맷 구성 및 반환
        const backupData = {
            timestamp: new Date().toISOString(),
            version: '3.0',
            backupType: 'design',
            data: {
                blog_settings: filteredSettings,
                layouts,
                widgets,
                layout_widgets: layoutWidgets,
                languages
            }
        };

        return new Response(JSON.stringify(backupData, null, 2), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': 'attachment; filename="blog-design-share.json"',
                // 캐싱을 방지하여 최신 디자인이 항상 즉시 추출되도록 보장
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (e: any) {
        console.error('Failed to export shared design settings:', e);
        return json({ error: 'Failed to export shared design settings', details: e.message }, { status: 500 });
    }
};
