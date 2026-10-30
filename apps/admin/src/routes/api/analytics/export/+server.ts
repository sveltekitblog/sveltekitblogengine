/**
 * Copyright (C) 2026 SvelteKit Blog Engine
 * API endpoint to export CFA analytics data (All-in-One: CSV / Custom: XLSX Multi-Sheet)
 */

import { fallbackDictionary } from '@blog/shared/i18n';
import * as XLSX from 'xlsx';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Lang = 'ko' | 'en' | 'ja';

// i18n 딕셔너리 기반 컬럼명 및 시트명 조회 헬퍼
function h(key: string, lang: Lang): string {
    const node = fallbackDictionary[`admin.dashboard.export.col.${key}`];
    return node?.[lang] || node?.['en'] || key;
}

function sheetName(key: string, lang: Lang): string {
    const node = fallbackDictionary[`admin.dashboard.export.sheet.${key}`];
    return node?.[lang] || node?.['en'] || key;
}

function escapeCsvCell(val: any): string {
    const s = String(val ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

function formatTopItems(items: any[] | undefined, max: number, isViewMetric = false): string {
    if (!items || !Array.isArray(items) || items.length === 0) return '-';
    return items
        .slice(0, max)
        .map((it: any) => {
            const name = String(it.name || 'Unknown').trim();
            const count = isViewMetric ? (it.views ?? it.visitors ?? 0) : (it.visitors ?? it.views ?? 0);
            return `${name} (${count})`;
        })
        .join(', ');
}

export const GET: RequestHandler = async ({ url, locals }) => {
    const db = locals.blogDb;
    if (!db) throw error(500, 'Database not found');

    const period = url.searchParams.get('period') || '28d';
    const mode = url.searchParams.get('mode') || 'all';
    const sectionsParam = url.searchParams.get('sections') || 'trend,pages,referrers,countries,devices,browsers';
    const lang = (url.searchParams.get('lang') || 'ko') as Lang;

    const sections = new Set(sectionsParam.split(','));

    // 사이트 대표 시간대 조회
    const tzRow = await db.prepare("SELECT value FROM blog_settings WHERE key = 'timezone'").first<{ value: string }>();
    const timeZone = tzRow?.value?.trim() || 'UTC';

    const getSiteDate = (offsetDays = 0): string => {
        try {
            const d = new Date(Date.now() + offsetDays * 86400 * 1000);
            return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        } catch {
            const d = new Date(Date.now() + offsetDays * 86400 * 1000);
            return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        }
    };

    const todayStr = getSiteDate(0);
    let startDateStr = getSiteDate(-28);

    if (period === '7d') startDateStr = getSiteDate(-7);
    else if (period === '28d') startDateStr = getSiteDate(-28);
    else if (period === 'month') startDateStr = `${todayStr.slice(0, 7)}-01`;
    else if (period === '90d') startDateStr = getSiteDate(-90);
    else if (period === 'year') startDateStr = getSiteDate(-365);

    const csvLines: string[] = [];

    // D1에서 해당 기간의 일자별 스냅샷 전체 조회
    const { results: snapshotRows } = await db.prepare(`
        SELECT date, page_views, visitors, details_json
        FROM cf_daily_snapshots
        WHERE date >= ? AND date <= ?
        ORDER BY date ASC
    `).bind(startDateStr, todayStr).all<{ date: string; page_views: number; visitors: number; details_json: string }>();

    const snapshotList = snapshotRows || [];

    // ── [1. 종합 분석 리포트 (All-in-One Mode)]: 1일 1행 압축 와이드 테이블 ───
    if (mode === 'all') {
        // 헤더 출력
        csvLines.push([
            h('date', lang),
            h('visitors', lang),
            h('views', lang),
            h('top_referrers', lang),
            h('top_pages', lang),
            h('top_countries', lang),
            h('top_browsers', lang),
            h('top_devices', lang)
        ].join(','));

        // 일자별 1행 압축 출력 (365일이어도 정확히 365행)
        for (const row of snapshotList) {
            let details: any = {};
            try {
                details = JSON.parse(row.details_json || '{}');
            } catch {}

            const referrersStr = formatTopItems(details.referrers, 3, false);
            const pagesStr     = formatTopItems(details.pages, 3, true);
            const countriesStr = formatTopItems(details.countries, 3, false);
            const browsersStr  = formatTopItems(details.browsers, 2, false);
            const devicesStr   = formatTopItems(details.devices, 2, false);

            csvLines.push([
                escapeCsvCell(row.date),
                row.visitors || 0,
                row.page_views || 0,
                escapeCsvCell(referrersStr),
                escapeCsvCell(pagesStr),
                escapeCsvCell(countriesStr),
                escapeCsvCell(browsersStr),
                escapeCsvCell(devicesStr)
            ].join(','));
        }
    } else {
        // ── [2. 맞춤 항목 선택 (Custom Mode)]: xlsx 멀티시트 ─────────────────
        const wb = XLSX.utils.book_new();

        // ① 트래픽 추이 시트
        if (sections.has('trend')) {
            const rows = snapshotList.map(row => ({
                [h('date', lang)]:     row.date,
                [h('visitors', lang)]: row.visitors || 0,
                [h('views', lang)]:    row.page_views || 0,
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName('trend', lang));
        }

        // ② 인기 페이지 시트
        if (sections.has('pages')) {
            const rows: Record<string, any>[] = [];
            for (const row of snapshotList) {
                let details: any = {};
                try { details = JSON.parse(row.details_json || '{}'); } catch {}
                if (Array.isArray(details.pages)) {
                    details.pages.forEach((item: any, idx: number) => {
                        rows.push({
                            [h('date', lang)]:           row.date,
                            [h('daily_visitors', lang)]: row.visitors || 0,
                            [h('daily_views', lang)]:    row.page_views || 0,
                            [h('rank', lang)]:            idx + 1,
                            [h('page_path', lang)]:      item.name || 'Unknown',
                            [h('views', lang)]:           item.views ?? 0,
                        });
                    });
                }
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName('pages', lang));
        }

        // ③ 유입 출처 시트
        if (sections.has('referrers')) {
            const rows: Record<string, any>[] = [];
            for (const row of snapshotList) {
                let details: any = {};
                try { details = JSON.parse(row.details_json || '{}'); } catch {}
                if (Array.isArray(details.referrers)) {
                    details.referrers.forEach((item: any, idx: number) => {
                        rows.push({
                            [h('date', lang)]:           row.date,
                            [h('daily_visitors', lang)]: row.visitors || 0,
                            [h('daily_views', lang)]:    row.page_views || 0,
                            [h('rank', lang)]:            idx + 1,
                            [h('referrer', lang)]:       item.name || 'Unknown',
                            [h('visitors', lang)]:        item.visitors ?? 0,
                        });
                    });
                }
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName('referrers', lang));
        }

        // ④ 접속 국가 시트
        if (sections.has('countries')) {
            const rows: Record<string, any>[] = [];
            for (const row of snapshotList) {
                let details: any = {};
                try { details = JSON.parse(row.details_json || '{}'); } catch {}
                if (Array.isArray(details.countries)) {
                    details.countries.forEach((item: any, idx: number) => {
                        rows.push({
                            [h('date', lang)]:           row.date,
                            [h('daily_visitors', lang)]: row.visitors || 0,
                            [h('daily_views', lang)]:    row.page_views || 0,
                            [h('rank', lang)]:            idx + 1,
                            [h('country', lang)]:        item.name || 'Unknown',
                            [h('visitors', lang)]:        item.visitors ?? 0,
                        });
                    });
                }
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName('countries', lang));
        }

        // ⑤ 브라우저 시트
        if (sections.has('browsers')) {
            const rows: Record<string, any>[] = [];
            for (const row of snapshotList) {
                let details: any = {};
                try { details = JSON.parse(row.details_json || '{}'); } catch {}
                if (Array.isArray(details.browsers)) {
                    details.browsers.forEach((item: any, idx: number) => {
                        rows.push({
                            [h('date', lang)]:           row.date,
                            [h('daily_visitors', lang)]: row.visitors || 0,
                            [h('daily_views', lang)]:    row.page_views || 0,
                            [h('rank', lang)]:            idx + 1,
                            [h('browser', lang)]:        item.name || 'Unknown',
                            [h('visitors', lang)]:        item.visitors ?? 0,
                        });
                    });
                }
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName('browsers', lang));
        }

        // ⑥ 장치 유형 시트
        if (sections.has('devices')) {
            const rows: Record<string, any>[] = [];
            for (const row of snapshotList) {
                let details: any = {};
                try { details = JSON.parse(row.details_json || '{}'); } catch {}
                if (Array.isArray(details.devices)) {
                    details.devices.forEach((item: any, idx: number) => {
                        rows.push({
                            [h('date', lang)]:             row.date,
                            [h('daily_visitors', lang)]:   row.visitors || 0,
                            [h('daily_views', lang)]:      row.page_views || 0,
                            [h('rank', lang)]:              idx + 1,
                            [h('device_type', lang)]:      item.name || 'Unknown',
                            [h('visitors', lang)]:          item.visitors ?? 0,
                        });
                    });
                }
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName('devices', lang));
        }

        const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const xlsxFilename = `skbe_analytics_${period}_${todayStr}.xlsx`;
        return new Response(xlsxBuf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${xlsxFilename}"`,
                'Cache-Control': 'no-store'
            }
        });
    }

    // ── mode=all: CSV 응답 ────────────────────────────────────────────────
    const filename = `skbe_analytics_${period}_${todayStr}.csv`;
    // UTF-8 BOM(\uFEFF) 주입으로 Excel 한글 깨짐 원천 방어
    return new Response('\uFEFF' + csvLines.join('\r\n'), {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store'
        }
    });
};
