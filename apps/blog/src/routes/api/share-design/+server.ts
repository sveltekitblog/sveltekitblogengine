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
import { sanitizeDesignPresetForSharing } from '@blog/shared';

export const GET: RequestHandler = async ({ platform, url }) => {
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

        // 2. 보안 검증 통과: 디자인 데이터 쿼리 수행
        const [blogSettingsRes, layoutsRes, widgetsRes, layoutWidgetsRes] = await Promise.all([
            db.prepare('SELECT * FROM blog_settings').all(),
            db.prepare('SELECT * FROM layouts').all(),
            db.prepare('SELECT * FROM widgets').all(),
            db.prepare('SELECT * FROM layout_widgets').all(),
        ]);

        const blogSettings = blogSettingsRes.results || [];
        const layouts = layoutsRes.results || [];
        const widgets = widgetsRes.results || [];
        const layoutWidgets = layoutWidgetsRes.results || [];

        // 3. 다중 디자인 슬롯(design_slots) 지원: 요청된 공개 활성 슬롯 또는 기본 활성 슬롯 디자인 추출
        const designSlotsRow = blogSettings.find((s: any) => s.key === 'design_slots');
        let activeSlotData: any = null;
        let resolvedSlotId = '1';
        if (designSlotsRow?.value) {
            try {
                const parsedSlots = JSON.parse(designSlotsRow.value);
                const requestedSlot = url.searchParams.get('slot')?.trim();
                const requestedSlotObj = requestedSlot ? parsedSlots.slots?.[requestedSlot] : null;
                if (requestedSlotObj && (requestedSlot === '1' || requestedSlotObj.enabled)) {
                    activeSlotData = requestedSlotObj;
                    resolvedSlotId = requestedSlot;
                } else {
                    const activeMode = parsedSlots.active_mode || '1';
                    activeSlotData = parsedSlots.slots?.[activeMode] || parsedSlots.slots?.['1'] || null;
                    resolvedSlotId = parsedSlots.slots?.[activeMode] ? activeMode : '1';
                }
            } catch {}
        }

        const safeParseJson = (val: any, fallback: any = {}) => {
            if (typeof val !== 'string') return val ?? fallback;
            try { return JSON.parse(val); } catch { return fallback; }
        };

        let presetName = `Slot ${resolvedSlotId}`;
        let designPayload: any;

        if (activeSlotData) {
            presetName = activeSlotData.name || presetName;
            const rawLayout = activeSlotData.layout || {};
            designPayload = {
                theme: activeSlotData.theme || {},
                header: activeSlotData.header || {},
                footer: activeSlotData.footer || {},
                site_title: {},
                widget_shadow_global: activeSlotData.widget_shadow_global || {},
                layout: {
                    id: rawLayout.id || 1,
                    name: rawLayout.name || presetName,
                    columnCount: rawLayout.columnCount || 1,
                    columnWidths: Array.isArray(rawLayout.columnWidths)
                        ? rawLayout.columnWidths.join(' ')
                        : (rawLayout.columnWidths || '1fr'),
                    mobileColumnCount: rawLayout.mobileColumnCount || 1,
                    mobileColumnWidths: Array.isArray(rawLayout.mobileColumnWidths)
                        ? rawLayout.mobileColumnWidths.join(' ')
                        : (rawLayout.mobileColumnWidths || '1fr'),
                },
                widgets: Array.isArray(activeSlotData.widgets)
                    ? activeSlotData.widgets.map((w: any, idx: number) => ({
                          ...w,
                          widget_id: Number(w.widget_id || w.id || idx + 1),
                          config: safeParseJson(w.config, {}),
                      }))
                    : [],
            };
        } else {
            // Fallback: 슬롯 데이터가 없는 레거시 DB에서 표준 design_preset 조립
            const getSetting = (key: string) => {
                const row = blogSettings.find((s: any) => s.key === key);
                return safeParseJson(row?.value, {});
            };
            const activeLayout: any = layouts.find((l: any) => l.is_active === 1) || layouts[0] || {};
            const widgetsMap = new Map<number, any>();
            for (const w of widgets as any[]) widgetsMap.set(Number(w.id), w);

            const mappedWidgets = (layoutWidgets as any[])
                .filter((lw) => !activeLayout.id || Number(lw.layout_id) === Number(activeLayout.id))
                .map((lw, idx) => {
                    const master = widgetsMap.get(Number(lw.widget_id)) || {};
                    return {
                        id: lw.id || idx + 1,
                        widget_id: Number(lw.widget_id || idx + 1),
                        name: master.name || `Widget ${idx + 1}`,
                        type: master.type || 'RecentPosts',
                        config: safeParseJson(master.config, {}),
                        column_index: lw.column_index ?? 0,
                        columnIndex: lw.column_index ?? 0,
                        sort_order: lw.sort_order ?? idx,
                        sortOrder: lw.sort_order ?? idx,
                        device: lw.device || 'desktop',
                        custom_title: safeParseJson(lw.custom_title, ''),
                    };
                });

            designPayload = {
                theme: getSetting('theme'),
                header: getSetting('header'),
                footer: getSetting('footer'),
                site_title: {},
                widget_shadow_global: getSetting('widget_shadow_global'),
                layout: {
                    id: activeLayout.id || 1,
                    name: activeLayout.name || 'Shared Layout',
                    columnCount: activeLayout.column_count || 1,
                    columnWidths: activeLayout.column_widths || '1fr',
                    mobileColumnCount: activeLayout.mobile_column_count || 1,
                    mobileColumnWidths: activeLayout.mobile_column_widths || '1fr',
                },
                widgets: mappedWidgets,
            };
        }

        // 4. @blog/shared 공용 정제 함수를 통과시켜 표준 design_preset 포맷 반환
        const sanitizedPreset = sanitizeDesignPresetForSharing({
            version: '3.0',
            backupType: 'design_preset',
            timestamp: new Date().toISOString(),
            presetName,
            design: designPayload,
        });

        return new Response(JSON.stringify(sanitizedPreset, null, 2), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="design-preset-slot-${resolvedSlotId}.json"`,
                // 캐싱을 방지하여 최신 디자인이 항상 즉시 추출되도록 보장
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (e: any) {
        console.error('Failed to export shared design settings:', e);
        return json({ error: true }, { status: 500 });
    }
};
