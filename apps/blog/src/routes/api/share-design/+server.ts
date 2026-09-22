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

        // 3. 다중 디자인 슬롯(design_slots) 지원: 현재 활성 슬롯 디자인 우선 추출
        const designSlotsRow = blogSettings.find((s: any) => s.key === 'design_slots');
        let activeSlotData: any = null;
        if (designSlotsRow?.value) {
            try {
                const parsedSlots = JSON.parse(designSlotsRow.value);
                const activeMode = parsedSlots.active_mode || '1';
                activeSlotData = parsedSlots.slots?.[activeMode] || parsedSlots.slots?.['1'] || null;
            } catch {}
        }

        let exportSettings: any[] = [];
        let exportLayouts: any[] = layouts;
        let exportWidgets: any[] = widgets;
        let exportLayoutWidgets: any[] = layoutWidgets;

        if (activeSlotData) {
            // 현재 활성 슬롯 스냅샷을 기반으로 공유 데이터 구성
            const cleanHeader = JSON.parse(JSON.stringify(activeSlotData.header || {}));
            for (const key of HEADER_TEXT_KEYS) delete cleanHeader[key];

            const cleanFooter = JSON.parse(JSON.stringify(activeSlotData.footer || {}));
            for (const key of FOOTER_TEXT_KEYS) delete cleanFooter[key];

            exportSettings = [
                { key: 'theme', value: JSON.stringify(activeSlotData.theme || {}) },
                { key: 'header', value: JSON.stringify(cleanHeader) },
                { key: 'footer', value: JSON.stringify(cleanFooter) },
                { key: 'widget_shadow_global', value: JSON.stringify(activeSlotData.widget_shadow_global || {}) }
            ];

            // 커스텀 CSS 보존
            const headerCssRow = blogSettings.find((s: any) => s.key === 'header_css');
            const footerCssRow = blogSettings.find((s: any) => s.key === 'footer_css');
            if (headerCssRow?.value) exportSettings.push({ key: 'header_css', value: headerCssRow.value });
            if (footerCssRow?.value) exportSettings.push({ key: 'footer_css', value: footerCssRow.value });

            // 슬롯 레이아웃 추출
            if (activeSlotData.layout) {
                exportLayouts = [{
                    id: 1,
                    name: activeSlotData.name || 'Shared Layout',
                    column_count: activeSlotData.layout.columnCount || 1,
                    column_widths: Array.isArray(activeSlotData.layout.columnWidths) ? activeSlotData.layout.columnWidths.join(' ') : (activeSlotData.layout.columnWidths || '1fr'),
                    mobile_column_count: activeSlotData.layout.mobileColumnCount || 1,
                    mobile_column_widths: Array.isArray(activeSlotData.layout.mobileColumnWidths) ? activeSlotData.layout.mobileColumnWidths.join(' ') : (activeSlotData.layout.mobileColumnWidths || '1fr'),
                    is_active: 1
                }];
            }

            // 슬롯 위젯 목록 추출 및 정규화
            if (Array.isArray(activeSlotData.widgets)) {
                exportWidgets = [];
                exportLayoutWidgets = [];
                activeSlotData.widgets.forEach((w: any, idx: number) => {
                    const wId = Number(w.widget_id || w.id || (idx + 1));
                    exportWidgets.push({
                        id: wId,
                        name: w.name || `Widget ${wId}`,
                        type: w.type || 'RecentPosts',
                        config: typeof w.config === 'object' ? JSON.stringify(w.config) : (w.config || '{}')
                    });
                    exportLayoutWidgets.push({
                        id: idx + 1,
                        layout_id: 1,
                        widget_id: wId,
                        column_index: w.column_index ?? w.columnIndex ?? 0,
                        sort_order: w.sort_order ?? w.sortOrder ?? idx,
                        device: w.device || 'desktop',
                        custom_title: typeof w.custom_title === 'object' ? JSON.stringify(w.custom_title) : (w.custom_title || null)
                    });
                });
            }
        } else {
            // Fallback: 슬롯 데이터가 없는 경우 기존 화이트리스트 단일 테이블 필터링 적용
            exportSettings = blogSettings
                .filter((s: any) => DESIGN_SETTING_KEYS.includes(s.key))
                .map((s: any) => {
                    if (s.key === 'header' || s.key === 'footer') {
                        try {
                            const parsed = JSON.parse(s.value);
                            const textKeys = s.key === 'header' ? HEADER_TEXT_KEYS : FOOTER_TEXT_KEYS;
                            for (const key of textKeys) delete parsed[key];
                            return { ...s, value: JSON.stringify(parsed) };
                        } catch {
                            return s;
                        }
                    }
                    return s;
                });
        }

        // 4. 표준 백업 포맷 구성 및 반환
        const backupData = {
            timestamp: new Date().toISOString(),
            version: '3.0',
            backupType: 'design',
            data: {
                blog_settings: exportSettings,
                layouts: exportLayouts,
                widgets: exportWidgets,
                layout_widgets: exportLayoutWidgets,
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
