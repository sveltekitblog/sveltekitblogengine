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

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { runGa4Report, runGa4BatchReport, getGa4AccessToken } from '$lib/server/ga4';
import { runAdsenseReport, getAdsenseAccessToken, type AdSenseConfig } from '$lib/server/adsense';

export const load: PageServerLoad = async ({ locals, platform }) => {
    const db = locals.blogDb;
    const userDb = platform?.env?.USER_DB;

    if (!db) throw error(500, 'Database not found');

    try {
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
                    const cPostIds = commentResults.map((c: any) => `'${c.post_id}'`).filter((id: string) => id !== "'null'").join(',');
                    if (cPostIds) {
                        const { results: postTitles } = await db.prepare(`SELECT id, title, slug FROM posts WHERE id IN (${cPostIds})`).all();
                        let titleMap: Record<string, any> = {};
                        for (const row of postTitles as any[]) { titleMap[row.id] = { title: row.title, slug: row.slug }; }
                        recentComments = commentResults.map((c: any) => ({
                            ...c,
                            post_title: titleMap[c.post_id]?.title || '알 수 없는 포스트',
                            post_slug:  titleMap[c.post_id]?.slug  || ''
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

        // ── GA4 & AdSense (Awaited) ───────────────────────────────────────────
        
        let ga4Data: any = null;
        let ga4Error: string | null = null;
        let isDummyData = false;

        const ga4Config = {
            propertyId:  (platform?.env as any)?.GA4_PROPERTY_ID  as string,
            clientEmail: (platform?.env as any)?.GA4_CLIENT_EMAIL  as string,
            privateKey:  (platform?.env as any)?.GA4_PRIVATE_KEY   as string,
        };

        if (ga4Config.propertyId && ga4Config.clientEmail && ga4Config.privateKey) {
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

                const [trafficData, sourceData] = batchResult.reports ?? [];
                ga4Data = { trafficData, sourceData };

                // Sync GA4 to DB
                if (ga4Data?.trafficData?.rows) {
                    const batchStatements = [];
                    for (const row of ga4Data.trafficData.rows) {
                        const dateStr = row.dimensionValues[0].value;
                        const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                        const sessions    = parseInt(row.metricValues[0].value, 10) || 0;
                        const activeUsers = parseInt(row.metricValues[1].value, 10) || 0;
                        batchStatements.push(
                            db.prepare(`
                                INSERT INTO visitor_stats (date, unique_visitors, page_views)
                                VALUES (?, ?, ?)
                                ON CONFLICT(date) DO UPDATE SET
                                    unique_visitors=excluded.unique_visitors,
                                    page_views=excluded.page_views
                            `).bind(formattedDate, activeUsers, sessions)
                        );
                    }
                    if (batchStatements.length > 0) { await db.batch(batchStatements); }
                }
            } catch (e: any) {
                console.error('GA4 Fetch error:', e);
                ga4Error = `데이터 통신 오류: ${e.message}`;
            }
        } else {
            isDummyData = true;
            // Dummy generator (compact)
            ga4Data = {
                trafficData: { rows: Array.from({ length: 28 }).map((_, i) => ({
                    dimensionValues: [{ value: '202310' + (i+1).toString().padStart(2,'0') }],
                    metricValues: [{ value: '150' }, { value: '80' }]
                })) },
                sourceData: { rows: [{ dimensionValues: [{ value: 'google / organic' }], metricValues: [{ value: '1420' }] }] }
            };
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
            ga4Data,
            ga4Error,
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
