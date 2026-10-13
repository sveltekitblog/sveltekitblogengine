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

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { runGa4Report, runGa4BatchReport, getGa4AccessToken } from '$lib/server/ga4';
import { runAdsenseReport, getAdsenseAccessToken, type AdSenseConfig } from '$lib/server/adsense';

type CFDetailItem = { name: string; views: number; visitors: number };
type CFDetailName = 'pages' | 'referrers' | 'countries' | 'devices' | 'browsers' | 'os';

const CF_DETAIL_NAMES: CFDetailName[] = ['pages', 'referrers', 'countries', 'devices', 'browsers', 'os'];

function aggregateCfDetails(rows: any[]): Record<CFDetailName, CFDetailItem[]> {
    const totals = Object.fromEntries(CF_DETAIL_NAMES.map(name => [name, new Map<string, CFDetailItem>()])) as Record<CFDetailName, Map<string, CFDetailItem>>;
    for (const row of rows) {
        try {
            const details = JSON.parse(row.details_json || '{}') as Partial<Record<CFDetailName, CFDetailItem[]>>;
            for (const name of CF_DETAIL_NAMES) {
                for (const item of details[name] || []) {
                    const current = totals[name].get(item.name) || { name: item.name, views: 0, visitors: 0 };
                    current.views += Number(item.views) || 0;
                    current.visitors += Number(item.visitors) || 0;
                    totals[name].set(item.name, current);
                }
            }
        } catch (error) {
            console.warn('Ignoring invalid CFA daily snapshot:', row.date, error);
        }
    }
    return Object.fromEntries(CF_DETAIL_NAMES.map(name => [name,
        Array.from(totals[name].values()).sort((a, b) => b.views - a.views || b.visitors - a.visitors)
    ])) as Record<CFDetailName, CFDetailItem[]>;
}

export const load: PageServerLoad = async ({ locals, platform, parent, url }) => {
    const db = locals.blogDb;
    const userDb = platform?.env?.USER_DB;

    if (!db) throw error(500, 'Database not found');

    try {
        const parentData = await parent();
        const defaultLang = parentData?.dbDefaultLang || 'ko';

        // Load dashboard settings
        const { results: settingsResults } = await db.prepare('SELECT key, value FROM blog_settings').all();
        let limitPosts = 5, limitComments = 10, limitGuestbooks = 5;
        let siteTimezone = 'UTC';

        if (settingsResults) {
            for (const row of settingsResults as any[]) {
                if (row.key === 'dashboard_recent_posts')      limitPosts      = parseInt(row.value, 10) || 5;
                if (row.key === 'dashboard_recent_comments')   limitComments   = parseInt(row.value, 10) || 10;
                if (row.key === 'dashboard_recent_guestbooks') limitGuestbooks = parseInt(row.value, 10) || 5;
                if (row.key === 'timezone' && row.value?.trim()) siteTimezone   = row.value.trim();
            }
        }

        // 사이트 대표 시간대 기준 오늘, 어제, 28일 전 YYYY-MM-DD 산출
        const getSiteDate = (tz: string, offsetDays = 0): string => {
            try {
                const d = new Date(Date.now() + offsetDays * 86400 * 1000);
                return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
            } catch {
                const d = new Date(Date.now() + offsetDays * 86400 * 1000);
                return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
            }
        };
        const yesterday = getSiteDate(siteTimezone, -1);
        const today     = getSiteDate(siteTimezone, 0);
        const d28Ago    = getSiteDate(siteTimezone, -28);

        // Recent Posts
        let { results: recentPostsRaw } = await db.prepare(`
            SELECT id, title, slug, created_at, status, view_count
            FROM posts ORDER BY created_at DESC LIMIT ?
        `).bind(limitPosts).all();

        let recentPosts = Array.from(recentPostsRaw || []);
        if (userDb && recentPosts.length > 0) {
            try {
                const postIds = recentPosts.map((p: any) => `'${p.id}'`).join(',');
                const { results: viewResults } = await userDb.prepare(`
                    SELECT post_id, SUM(views) as total_views FROM post_views WHERE post_id IN (${postIds}) GROUP BY post_id
                `).all();
                let viewMap: Record<string, number> = {};
                for (const row of (viewResults || []) as any[]) { viewMap[row.post_id] = row.total_views || 0; }
                recentPosts = recentPosts.map((p: any) => ({
                    ...p,
                    view_count: (p.id in viewMap) ? viewMap[p.id as string] : (p.view_count || 0)
                }));
            } catch (e) { console.warn('Failed to load views for recent posts from USER_DB:', e); }
        } else {
            recentPosts = recentPosts.map((p: any) => ({
                ...p,
                view_count: p.view_count || 0
            }));
        }

        // Recent Comments & Guestbooks
        let recentComments: any[]   = [];
        let recentGuestbooks: any[] = [];

        if (userDb) {
            try {
                const { results: commentResults } = await userDb.prepare(`
                    SELECT e.id, e.content, e.created_at, e.target_id as post_id, u.name as user_name, u.image as user_image
                    FROM entries e LEFT JOIN user u ON e.user_id = u.id
                    WHERE e.type = 'comment' AND e.is_deleted = 0
                    ORDER BY e.created_at DESC LIMIT ?
                `).bind(limitComments).all();

                if (commentResults && commentResults.length > 0) {
                    const cPostIds = [...new Set(commentResults.map((c: any) => c.post_id).filter((id: any) => id != null))];
                    if (cPostIds.length > 0) {
                        const safeIds = cPostIds.map(id => `'${id}'`).join(',');
                        const { results: postTitles } = await db.prepare(`SELECT id, title, slug, lang FROM posts WHERE slug IN (${safeIds}) OR id IN (${safeIds})`).all();
                        let titleMap: Record<string, any> = {};
                        for (const row of (postTitles || []) as any[]) {
                            const keys = [row.id, row.slug].filter(Boolean);
                            for (const key of keys) {
                                const current = titleMap[key];
                                if (!current || (current.lang !== defaultLang && row.lang === defaultLang)) {
                                    titleMap[key] = { id: row.id, title: row.title, slug: row.slug, lang: row.lang };
                                }
                            }
                        }
                        recentComments = commentResults.map((c: any) => ({
                            ...c,
                            post_title: titleMap[c.post_id]?.title || '알 수 없는 포스트',
                            post_id: titleMap[c.post_id]?.id || c.post_id,
                            post_slug: titleMap[c.post_id]?.slug || ''
                        }));
                    } else { recentComments = commentResults; }
                }

                const { results: gbResults } = await userDb.prepare(`
                    SELECT e.id, e.content, e.created_at, e.is_private, u.name as user_name, u.image as user_image
                    FROM entries e LEFT JOIN user u ON e.user_id = u.id
                    WHERE e.type = 'guestbook' AND e.is_deleted = 0
                    ORDER BY e.created_at DESC LIMIT ?
                `).bind(limitGuestbooks).all();
                recentGuestbooks = gbResults || [];
            } catch (e) { console.warn('Failed to load user-db entries:', e); }
        }

        // ── Visitor Analytics & AdSense ───────────────────────────────────────
        const requestedProvider = (url.searchParams.get('provider') || 'cf').toLowerCase();
        const activeProvider = requestedProvider === 'ga4' ? 'ga4' : 'cf';

        // CFA data is collected by the separate scheduled Worker. The dashboard
        // deliberately has no CFA API token and reads only durable D1 snapshots.
        let cfSnapshots: any[] = [];
        let cfSyncState: any = null;
        try {
            const { results: cfSnapshotRows } = await db.prepare(`
                SELECT date, page_views, visitors, details_json, sample_interval, is_exact, fetched_at
                FROM cf_daily_snapshots
                WHERE date >= ?
                ORDER BY date ASC
            `).bind(d28Ago).all();
            cfSnapshots = (cfSnapshotRows || []) as any[];
            cfSyncState = await db.prepare(`
                SELECT initialized_at, last_synced_at, last_error FROM cf_sync_state WHERE id = 1
            `).first();
        } catch (e) {
            console.warn('[Dashboard] cf_daily_snapshots or cf_sync_state table does not exist yet. Falling back to dummy data.', e);
        }
        const isCfConfigured = Boolean(cfSyncState || cfSnapshots.length > 0);

        // 2) GA4 Config
        const ga4Config = {
            propertyId:  (platform?.env as any)?.GA4_PROPERTY_ID  as string,
            clientEmail: (platform?.env as any)?.GA4_CLIENT_EMAIL  as string,
            privateKey:  (platform?.env as any)?.GA4_PRIVATE_KEY   as string,
        };
        const isGa4Configured = Boolean(ga4Config.propertyId && ga4Config.clientEmail && ga4Config.privateKey);

        let analyticsError: string | null = null;
        let isDummyData = false;
        let trafficData: any = null;
        let sourceData: any = null;
        let cfDetails: {
            pages: CFDetailItem[];
            referrers: CFDetailItem[];
            countries: CFDetailItem[];
            devices: CFDetailItem[];
            browsers: CFDetailItem[];
            os: CFDetailItem[];
            today?: Record<CFDetailName, CFDetailItem[]>;
            days7?: Record<CFDetailName, CFDetailItem[]>;
            byDate?: Record<string, Record<CFDetailName, CFDetailItem[]>>;
        } | null = null;
        let availableDates: string[] = [];

        if (activeProvider === 'cf') {
            if (cfSnapshots.length > 0) {
                const detailsByDate: Record<string, Record<CFDetailName, CFDetailItem[]>> = {};
                for (const row of cfSnapshots) {
                    detailsByDate[row.date] = aggregateCfDetails([row]);
                }
                availableDates = cfSnapshots.map((r: any) => r.date).reverse();
                const details7d = aggregateCfDetails(cfSnapshots.slice(-7));
                const detailsToday = aggregateCfDetails(cfSnapshots.filter((r: any) => r.date === today));
                trafficData = {
                    rows: cfSnapshots.map((r: any) => ({
                        dimensionValues: [{ value: String(r.date).replace(/-/g, '') }],
                        metricValues: [{ value: String(r.page_views) }, { value: String(r.visitors) }]
                    }))
                };
                sourceData = {
                    rows: details7d.referrers.map(item => ({
                        dimensionValues: [{ value: item.name }],
                        metricValues: [{ value: String(item.visitors || item.views) }]
                    }))
                };
                cfDetails = {
                    ...details7d,
                    days7: details7d,
                    today: detailsToday,
                    byDate: detailsByDate
                };
            } else {
                isDummyData = true;
                trafficData = {
                    // 더미 날짜: d28Ago 기준 오늘까지 실제 날짜 동적 생성 (하드코딩 제거)
                    rows: Array.from({ length: 28 }).map((_, i) => {
                        const d = new Date(new Date(d28Ago).getTime() + i * 86400000);
                        const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
                        return {
                            dimensionValues: [{ value: dateStr }],
                            metricValues: [{ value: '150' }, { value: '80' }]
                        };
                    })
                };
                sourceData = {
                    rows: [{ dimensionValues: [{ value: 'Direct / None' }], metricValues: [{ value: '1420' }] }]
                };
            }
        } else {
            // ── Google Analytics 4 (선택 엔진) ─────────────────────────────────
            if (isGa4Configured) {
                try {
                    const ga4Token = await getGa4AccessToken(ga4Config);
                    const batchResult = await runGa4BatchReport(ga4Config, [
                        {
                            dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
                            dimensions: [{ name: 'date' }],
                            metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
                            orderBys: [{ dimension: { dimensionName: 'date' } }]
                        },
                        {
                            dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
                            dimensions: [{ name: 'sessionSourceMedium' }],
                            metrics: [{ name: 'sessions' }],
                            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                            limit: 5
                        }
                    ], ga4Token);

                    const [gTraffic, gSource] = batchResult.reports ?? [];
                    trafficData = gTraffic;
                    sourceData = gSource;
                } catch (e: any) {
                    console.error('GA4 Fetch error:', e);
                    analyticsError = `GA4 데이터 통신 오류: ${e.message}`;
                }
            } else {
                isDummyData = true;
                trafficData = {
                    // 더미 날짜: d28Ago 기준 오늘까지 실제 날짜 동적 생성 (하드코딩 제거)
                    rows: Array.from({ length: 28 }).map((_, i) => {
                        const d = new Date(new Date(d28Ago).getTime() + i * 86400000);
                        const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
                        return {
                            dimensionValues: [{ value: dateStr }],
                            metricValues: [{ value: '150' }, { value: '80' }]
                        };
                    })
                };
                sourceData = {
                    rows: [{ dimensionValues: [{ value: 'google / organic' }], metricValues: [{ value: '1420' }] }]
                };
            }
        }

        const yesterdayStats: any = await db.prepare('SELECT * FROM visitor_stats WHERE date = ?').bind(yesterday).first();
        const todayStats:     any = await db.prepare('SELECT * FROM visitor_stats WHERE date = ?').bind(today).first();
        const totalStats:     any = await db.prepare('SELECT SUM(unique_visitors) as total, SUM(page_views) as total_views FROM visitor_stats').first();

        // 상단 카드와 하단 차트 수치 일원화: cf_daily_snapshots 우선 매핑
        const yesterdaySnapshot = cfSnapshots.find((r: any) => r.date === yesterday);
        const todaySnapshot     = cfSnapshots.find((r: any) => r.date === today);
        const yesterdayVisitors = yesterdaySnapshot ? yesterdaySnapshot.visitors : (yesterdayStats?.unique_visitors || 0);
        const yesterdayViews    = yesterdaySnapshot ? yesterdaySnapshot.page_views : (yesterdayStats?.page_views || 0);
        const todayVisitors     = todaySnapshot     ? todaySnapshot.visitors     : (todayStats?.unique_visitors || 0);
        const todayViews        = todaySnapshot     ? todaySnapshot.page_views     : (todayStats?.page_views || 0);

        // AdSense
        let adsenseData: any = null;
        let adsenseError: string | null = null;
        let isAdsenseDummyData = false;

        const adsenseConfig: AdSenseConfig = {
            accountId:    (platform?.env as any)?.ADSENSE_ACCOUNT_ID    as string,
            clientId:     (platform?.env as any)?.ADSENSE_CLIENT_ID     as string,
            clientSecret: (platform?.env as any)?.ADSENSE_CLIENT_SECRET as string,
            refreshToken: (platform?.env as any)?.ADSENSE_REFRESH_TOKEN as string,
        };

        if (adsenseConfig.accountId && adsenseConfig.clientId && adsenseConfig.clientSecret && adsenseConfig.refreshToken) {
            try {
                const adsenseToken = await getAdsenseAccessToken(adsenseConfig);
                const chartQs = new URLSearchParams();
                chartQs.append('metrics', 'ESTIMATED_EARNINGS');
                chartQs.append('metrics', 'PAGE_VIEWS');
                chartQs.append('metrics', 'CLICKS');
                chartQs.append('dateRange', 'LAST_30_DAYS');
                chartQs.append('dimensions', 'DATE');

                const chartRes = await runAdsenseReport(adsenseConfig, chartQs, adsenseToken);
                const currentMonth = today.substring(0, 7);
                const allRows: any[] = chartRes.rows || [];
                const findRow = (dateStr: string) => allRows.find((r: any) => r.cells[0].value === dateStr);
                const makeStatRow = (row: any) => row ? { rows: [{ cells: [row.cells[1], row.cells[2], row.cells[3]] }] } : { rows: [] };
                const monthRows = allRows.filter((r: any) => String(r.cells[0].value).startsWith(currentMonth));
                const monthEarnings = monthRows.reduce((s: number, r: any) => s + parseFloat(r.cells[1].value || '0'), 0);
                const monthViews    = monthRows.reduce((s: number, r: any) => s + parseInt(r.cells[2].value || '0', 10), 0);
                const monthClicks   = monthRows.reduce((s: number, r: any) => s + parseInt(r.cells[3].value || '0', 10), 0);

                adsenseData = {
                    today:     makeStatRow(findRow(today)),
                    yesterday: makeStatRow(findRow(yesterday)),
                    month: { rows: [{ cells: [{ value: monthEarnings.toFixed(2) }, { value: String(monthViews) }, { value: String(monthClicks) }] }] },
                    chart: chartRes
                };
            } catch (e: any) {
                console.error('AdSense Fetch error:', e);
                adsenseError = `애드센스 통신 오류: ${e.message}`;
            }
        } else {
            isAdsenseDummyData = true;
            adsenseData = { 
                today: { rows: [{ cells: [{ value: '4.24' }, { value: '450' }, { value: '15' }] }] },
                yesterday: { rows: [{ cells: [{ value: '8.56' }, { value: '890' }, { value: '27' }] }] },
                month: { rows: [{ cells: [{ value: '145.12' }, { value: '14500' }, { value: '380' }] }] },
                chart: { rows: [] }
            };
        }

        return {
            stats: {
                yesterday: { visitors: yesterdayVisitors, views: yesterdayViews, date: yesterday },
                today:     { visitors: todayVisitors,     views: todayViews,     date: today },
                total:     { visitors: totalStats?.total               || 0, views: totalStats?.total_views    || 0 }
            },
            availableDates,
            recentPosts,
            recentComments,
            recentGuestbooks,
            siteTimezone,
            activeProvider,
            isCfConfigured,
            isGa4Configured,
            analyticsData: { trafficData, sourceData },
            cfDetails,
            cfSync: cfSyncState ? {
                initializedAt: cfSyncState.initialized_at,
                lastSyncedAt: cfSyncState.last_synced_at,
                lastError: cfSyncState.last_error
            } : null,
            analyticsError,
            ga4Data: { trafficData, sourceData }, // 하위 호환성 유지
            ga4Error: analyticsError,
            isDummyData,
            adsenseData,
            adsenseError,
            isAdsenseDummyData
        };

    } catch (err) {
        console.error('Failed to load dashboard data:', err);
        throw error(500, 'Failed to load dashboard data');
    }
};
