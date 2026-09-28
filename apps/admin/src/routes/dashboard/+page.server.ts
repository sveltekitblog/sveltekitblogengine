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
import { runCfAnalyticsReport, type CFAnalyticsConfig } from '$lib/server/cf-analytics';
import { runAdsenseReport, getAdsenseAccessToken, type AdSenseConfig } from '$lib/server/adsense';

export const load: PageServerLoad = async ({ locals, platform, parent, url }) => {
    const db = locals.blogDb;
    const userDb = platform?.env?.USER_DB;

    if (!db) throw error(500, 'Database not found');

    try {
        const parentData = await parent();
        const defaultLang = parentData?.dbDefaultLang || 'ko';

        // Visitor Stats
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        // Load dashboard settings
        const { results: settingsResults } = await db.prepare('SELECT key, value FROM blog_settings').all();
        let limitPosts = 5, limitComments = 10, limitGuestbooks = 5;

        if (settingsResults) {
            for (const row of settingsResults as any[]) {
                if (row.key === 'dashboard_recent_posts')      limitPosts      = parseInt(row.value, 10) || 5;
                if (row.key === 'dashboard_recent_comments')   limitComments   = parseInt(row.value, 10) || 10;
                if (row.key === 'dashboard_recent_guestbooks') limitGuestbooks = parseInt(row.value, 10) || 5;
            }
        }

        // Recent Posts
        let { results: recentPostsRaw } = await db.prepare(`
            SELECT id, title, slug, created_at, status
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
                for (const row of viewResults as any[]) { viewMap[row.post_id] = row.total_views || 0; }
                recentPosts = recentPosts.map((p: any) => ({ ...p, view_count: viewMap[p.id as string] || 0 }));
            } catch (e) { console.warn('Failed to load views for recent posts:', e); }
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

        // 1) Cloudflare Web Analytics Config
        const cfConfig: CFAnalyticsConfig = {
            accountId: (platform?.env as any)?.CF_ACCOUNT_ID as string,
            apiToken:  (platform?.env as any)?.CF_API_TOKEN  as string,
            siteTag:   (platform?.env as any)?.CF_WEB_ANALYTICS_SITE_TAG as string
        };
        const isCfConfigured = Boolean(cfConfig.accountId && cfConfig.apiToken && cfConfig.siteTag);

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

        const d28Ago = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];

        if (activeProvider === 'cf') {
            // ── Cloudflare Web Analytics (기본 엔진 + D1 증분 캐싱) ─────────────
            if (isCfConfigured) {
                try {
                    // D1에 저장된 최근 28일치 데이터 상태 확인
                    const lastStatRow: any = await db.prepare(
                        'SELECT MAX(date) as last_date, COUNT(*) as cnt FROM visitor_stats WHERE date >= ?'
                    ).bind(d28Ago).first();
                    const lastDate = lastStatRow?.last_date;
                    const countInD1 = lastStatRow?.cnt || 0;

                    // D1에 과거 27일 이상 채워져 있고 오늘 이전 데이터가 확정되어 있으면 오늘 하루치만 API 조회
                    const needFullSync = !lastDate || countInD1 < 27;
                    const startDate = needFullSync ? d28Ago : today;

                    const cfResult = await runCfAnalyticsReport(cfConfig, startDate, today);

                    // 조회된 최신 일자 데이터를 D1에 동기화
                    // CF API가 count=0인 row를 반환할 경우 기존 데이터를 0으로 덮어쓰지 않도록 필터
                    const meaningfulRows = cfResult.trafficRows.filter(row => row.pageViews > 0 || row.visitors > 0);
                    if (meaningfulRows.length > 0) {
                        const batchStmts = meaningfulRows.map(row => 
                            db.prepare(`
                                INSERT INTO visitor_stats (date, unique_visitors, page_views)
                                VALUES (?, ?, ?)
                                ON CONFLICT(date) DO UPDATE SET
                                    unique_visitors = excluded.unique_visitors,
                                    page_views = excluded.page_views
                            `).bind(row.date, row.visitors, row.pageViews)
                        );
                        await db.batch(batchStmts);
                    }

                    sourceData = {
                        rows: cfResult.sourceRows.map(s => ({
                            dimensionValues: [{ value: s.source }],
                            metricValues: [{ value: String(s.visits) }]
                        }))
                    };
                } catch (e: any) {
                    console.error('CF Analytics fetch error:', e);
                    analyticsError = `Cloudflare Analytics 통신 오류: ${e.message}`;
                }
            } else {
                isDummyData = true;
            }

            // 화면 차트용 일별 데이터는 D1에서 28일치 일괄 조회 (초고속 캐시 로드)
            const { results: dbStats } = await db.prepare(
                'SELECT date, unique_visitors, page_views FROM visitor_stats WHERE date >= ? ORDER BY date ASC'
            ).bind(d28Ago).all();

            const statsRows = (dbStats as any[]) || [];
            // 0값 행(page_views=0 AND unique_visitors=0)은 유효 데이터로 취급하지 않음
            // CF API가 count=0 행을 반환해 저장된 기존 오염 데이터 방어
            const validStatsRows = statsRows.filter((r: any) => (r.page_views || 0) > 0 || (r.unique_visitors || 0) > 0);

            if (validStatsRows.length > 0 && !isDummyData) {
                trafficData = {
                    rows: validStatsRows.map((r: any) => ({
                        dimensionValues: [{ value: String(r.date).replace(/-/g, '') }],
                        metricValues: [{ value: String(r.page_views) }, { value: String(r.unique_visitors) }]
                    }))
                };
            } else {
                isDummyData = true;
                trafficData = {
                    rows: Array.from({ length: 28 }).map((_, i) => ({
                        dimensionValues: [{ value: '202609' + (i + 1).toString().padStart(2, '0') }],
                        metricValues: [{ value: '150' }, { value: '80' }]
                    }))
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
                    rows: Array.from({ length: 28 }).map((_, i) => ({
                        dimensionValues: [{ value: '202609' + (i + 1).toString().padStart(2, '0') }],
                        metricValues: [{ value: '150' }, { value: '80' }]
                    }))
                };
                sourceData = {
                    rows: [{ dimensionValues: [{ value: 'google / organic' }], metricValues: [{ value: '1420' }] }]
                };
            }
        }

        const yesterdayStats: any = await db.prepare('SELECT * FROM visitor_stats WHERE date = ?').bind(yesterday).first();
        const todayStats:     any = await db.prepare('SELECT * FROM visitor_stats WHERE date = ?').bind(today).first();
        const totalStats:     any = await db.prepare('SELECT SUM(unique_visitors) as total, SUM(page_views) as total_views FROM visitor_stats').first();

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
                yesterday: { visitors: yesterdayStats?.unique_visitors || 0, views: yesterdayStats?.page_views || 0 },
                today:     { visitors: todayStats?.unique_visitors     || 0, views: todayStats?.page_views     || 0 },
                total:     { visitors: totalStats?.total               || 0, views: totalStats?.total_views    || 0 }
            },
            recentPosts,
            recentComments,
            recentGuestbooks,
            activeProvider,
            isCfConfigured,
            isGa4Configured,
            analyticsData: { trafficData, sourceData },
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
