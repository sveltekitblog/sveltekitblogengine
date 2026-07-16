<!--
 Copyright (C) 2026 kimteamjang

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { PageData } from "./$types";
    import { t } from "$lib/i18n.svelte";
    import {
        BarChart2,
        MessageSquare,
        BookOpen,
        FileText,
        User,
        UserCheck,
        AlertCircle,
        TrendingUp,
        DollarSign,
    } from "lucide-svelte";
    import Chart from "chart.js/auto";

    let { data } = $props<{ data: PageData }>();

    let trafficChartCanvas: HTMLCanvasElement | undefined = $state();
    let sourceChartCanvas: HTMLCanvasElement | undefined = $state();
    let trafficChart: Chart | null = null;
    let sourceChart: Chart | null = null;

    let adsenseChartCanvas: HTMLCanvasElement | undefined = $state();
    let adsenseChart: Chart | null = null;

    onMount(() => {
        if (data.ga4Data) {
            initTrafficChart();
            initSourceChart();
        }
        if (data.adsenseData) {
            initAdsenseChart();
        }
    });

    function initAdsenseChart() {
        if (!adsenseChartCanvas || !data.adsenseData?.chart?.rows) return;

        const rows = data.adsenseData.chart.rows;
        const labels = rows.map((r: any) => {
            let dString = String(r.cells[0].value);
            if (dString.length === 8 && !dString.includes("-")) {
                return `${dString.substring(4, 6)}/${dString.substring(6, 8)}`;
            }
            if (dString.includes("-")) {
                const parts = dString.split("-");
                return `${parts[1]}/${parts[2]}`;
            }
            return dString;
        });

        const earnings = rows.map((r: any) => parseFloat(r.cells[1].value));
        const clicks   = rows.map((r: any) => parseInt(r.cells[3].value, 10));

        adsenseChart = new Chart(adsenseChartCanvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: t('admin.dashboard.chart.earnings', { default: '수익 (Earnings $)' }),
                        data: earnings,
                        borderColor: "#10b981",
                        backgroundColor: "rgba(16, 185, 129, 0.1)",
                        tension: 0.3,
                        fill: true,
                        yAxisID: "y",
                    },
                    {
                        label: t('admin.dashboard.chart.clicks', { default: '클릭 (Clicks)' }),
                        data: clicks,
                        borderColor: "#f59e0b",
                        backgroundColor: "rgba(245, 158, 11, 0.8)",
                        type: "bar",
                        yAxisID: "y1",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                scales: {
                    y:  { type: "linear", display: true, position: "left",  beginAtZero: true },
                    y1: { type: "linear", display: true, position: "right", beginAtZero: true, grid: { drawOnChartArea: false } },
                },
            },
        });
    }

    function getAdsenseMetric(report: any, index: number, defaultVal = "0") {
        const val = report?.rows?.[0]?.cells?.[index]?.value;
        return val
            ? parseFloat(val).toLocaleString(undefined, { maximumFractionDigits: 2 })
            : defaultVal;
    }

    function initTrafficChart() {
        if (!trafficChartCanvas || !data.ga4Data?.trafficData?.rows) return;

        const rows = data.ga4Data.trafficData.rows;
        const labels = rows.map((r: any) => {
            const dateStr = r.dimensionValues[0].value;
            return `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`;
        });
        const sessions    = rows.map((r: any) => parseInt(r.metricValues[0].value, 10));
        const activeUsers = rows.map((r: any) => parseInt(r.metricValues[1].value, 10));

        trafficChart = new Chart(trafficChartCanvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: t('admin.dashboard.chart.sessions', { default: '세션 (Sessions)' }),
                        data: sessions,
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59, 130, 246, 0.1)",
                        tension: 0.3,
                        fill: true,
                    },
                    {
                        label: t('admin.dashboard.chart.active_users', { default: '활성 사용자 (Active Users)' }),
                        data: activeUsers,
                        borderColor: "#10b981",
                        backgroundColor: "rgba(16, 185, 129, 0.1)",
                        tension: 0.3,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: { legend: { position: "bottom" } },
                scales: { y: { beginAtZero: true } },
            },
        });
    }

    function initSourceChart() {
        if (!sourceChartCanvas || !data.ga4Data?.sourceData?.rows) return;

        const rows     = data.ga4Data.sourceData.rows;
        const labels   = rows.map((r: any) => r.dimensionValues[0].value);
        const sessions = rows.map((r: any) => parseInt(r.metricValues[0].value, 10));

        sourceChart = new Chart(sourceChartCanvas, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    data: sessions,
                    backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"],
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "right" } },
            },
        });
    }

    function formatDate(date: string | number) {
        if (!date) return "-";
        const d = typeof date === "number" ? new Date(date) : new Date(date.replace(" ", "T"));
        if (isNaN(d.getTime())) {
            if (typeof date === "string" && date.length >= 16) return date.substring(0, 16);
            return "Invalid Date";
        }
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function stripHtml(html: string) {
        let tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }
</script>

<div class="dashboard-container">
    <header class="page-header">
        <h1><BarChart2 size={32} /> {t('admin.dashboard.title', { default: '관리 대시보드' })}</h1>
        <p class="subtitle">{t('admin.dashboard.subtitle', { default: '오늘의 블로그 현황과 통계를 확인하세요.' })}</p>
    </header>

    <!-- 요약 통계 카드 -->
    <section class="dashboard-section">
        <div class="stats-overview">
            <div class="stat-card">
                <div class="stat-icon"><User size={24} /></div>
                <div class="stat-info">
                    <div class="stat-label">{t('admin.dashboard.stats.visitors_yesterday', { default: '어제 방문자' })}</div>
                    <div class="stat-value">
                        {data.stats.yesterday.visitors.toLocaleString()}
                        <span class="unit">{t('admin.common.unit_person', { default: '명' })}</span>
                    </div>
                    <div class="stat-sub">
                        {data.stats.yesterday.views.toLocaleString()} {t('admin.common.views', { default: '조회' })}
                    </div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon highlight"><UserCheck size={24} /></div>
                <div class="stat-info">
                    <div class="stat-label">{t('admin.dashboard.stats.visitors_today', { default: '오늘 방문자' })}</div>
                    <div class="stat-value">
                        {data.stats.today.visitors.toLocaleString()}
                        <span class="unit">{t('admin.common.unit_person', { default: '명' })}</span>
                    </div>
                    <div class="stat-sub">
                        {data.stats.today.views.toLocaleString()} {t('admin.common.views', { default: '조회' })}
                    </div>
                </div>
            </div>
            <div class="stat-card primary">
                <div class="stat-icon"><BarChart2 size={24} /></div>
                <div class="stat-info">
                    <div class="stat-label">{t('admin.dashboard.stats.visitors_total', { default: '전체 방문자' })}</div>
                    <div class="stat-value">
                        {data.stats.total.visitors.toLocaleString()}
                        <span class="unit">{t('admin.common.unit_person', { default: '명' })}</span>
                    </div>
                    <div class="stat-sub">
                        {data.stats.total.views.toLocaleString()} {t('admin.common.views', { default: '조회' })}
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- GA4 차트 영역 -->
    <section class="dashboard-section">
        <div class="section-header">
            <h2><TrendingUp size={20} /> {t('admin.dashboard.reports.ga4_title', { default: '트래픽 리포트 (GA4)' })}</h2>
        </div>

        {#if data.isDummyData}
            <div class="ga4-alert warning mb-4">
                <div class="alert-icon"><AlertCircle size={24} /></div>
                <div class="alert-content">
                    <h3>{t('admin.dashboard.reports.ga4_dummy_warning', { default: 'Google Analytics 4가 설정되지 않아 더미 데이터(예시)를 표시 중입니다.' })}</h3>
                    <p>{t('admin.dashboard.reports.ga4_dummy_desc', { default: '차트 출력 확인용이며 실제 데이터가 아닙니다. 환경 변수(Secret)에 다음 키를 등록해주세요:' })} 
                        <code>GA4_PROPERTY_ID</code>, <code>GA4_CLIENT_EMAIL</code>, <code>GA4_PRIVATE_KEY</code>
                    </p>
                </div>
            </div>
        {/if}

        {#if data.ga4Error}
            <div class="ga4-alert error">
                <div class="alert-icon"><AlertCircle size={24} /></div>
                <div class="alert-content">
                    <h3>{t('admin.dashboard.reports.data_error_title', { default: '데이터를 불러오는 중 오류가 발생했습니다.' })}</h3>
                    <p>{data.ga4Error}</p>
                </div>
            </div>
        {:else if data.ga4Data}
            <div class="ga4-charts-grid">
                <div class="chart-card">
                    <h3 class="chart-title">{t('admin.dashboard.reports.recent_28d_traffic', { default: '최근 28일 트래픽 (일별)' })}</h3>
                    <div class="chart-wrapper">
                        <canvas bind:this={trafficChartCanvas}></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title">{t('admin.dashboard.reports.user_acquisition', { default: '사용자 획득 (소스/매체)' })}</h3>
                    <div class="chart-wrapper">
                        <canvas bind:this={sourceChartCanvas}></canvas>
                    </div>
                </div>
            </div>
        {:else}
            <div class="empty-state">{t('admin.dashboard.reports.ga4_loading', { default: 'GA4 데이터를 불러오는 중입니다...' })}</div>
        {/if}
    </section>

    <!-- 구글 애드센스 영역 -->
    <section class="dashboard-section">
        <div class="section-header">
            <h2><DollarSign size={20} /> {t('admin.dashboard.reports.adsense_title', { default: '실적 리포트 (AdSense)' })}</h2>
        </div>

        {#if data.isAdsenseDummyData}
            <div class="ga4-alert warning mb-4">
                <div class="alert-icon"><AlertCircle size={24} /></div>
                <div class="alert-content">
                    <h3>{t('admin.dashboard.reports.adsense_dummy_warning', { default: 'Google AdSense API가 설정되지 않아 더미 데이터(예시)를 표시 중입니다.' })}</h3>
                    <p>{t('admin.dashboard.reports.adsense_dummy_desc', { default: '차트 출력 확인용이며 실제 데이터가 아닙니다. 환경 변수(Secret)에 다음 키를 모두 등록해주세요:' })} 
                        <code>ADSENSE_ACCOUNT_ID</code>, <code>ADSENSE_CLIENT_ID</code>, 
                        <code>ADSENSE_CLIENT_SECRET</code>, <code>ADSENSE_REFRESH_TOKEN</code>
                    </p>
                </div>
            </div>
        {/if}

        {#if data.adsenseError}
            <div class="ga4-alert error">
                <div class="alert-icon"><AlertCircle size={24} /></div>
                <div class="alert-content">
                    <h3>{t('admin.dashboard.reports.data_error_title', { default: '데이터를 불러오는 중 오류가 발생했습니다.' })}</h3>
                    <p>{data.adsenseError}</p>
                </div>
            </div>
        {:else if data.adsenseData}
            <div class="stats-overview" style="margin-bottom: 1.5rem;">
                <div class="stat-card">
                    <div class="stat-icon"><DollarSign size={24} /></div>
                    <div class="stat-info">
                        <div class="stat-label">{t('admin.dashboard.stats.earnings_yesterday', { default: '어제 예상 수입' })}</div>
                        <div class="stat-value">
                            <span class="unit">$</span>{getAdsenseMetric(data.adsenseData.yesterday, 0)}
                        </div>
                        <div class="stat-sub">
                            {getAdsenseMetric(data.adsenseData.yesterday, 2)} {t('admin.common.clicks', { default: '클릭' })} / {getAdsenseMetric(data.adsenseData.yesterday, 1)} {t('admin.common.views_suffix', { default: '뷰' })}
                        </div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon highlight"><DollarSign size={24} /></div>
                    <div class="stat-info">
                        <div class="stat-label">{t('admin.dashboard.stats.earnings_today', { default: '오늘 예상 수입' })}</div>
                        <div class="stat-value">
                            <span class="unit">$</span>{getAdsenseMetric(data.adsenseData.today, 0)}
                        </div>
                        <div class="stat-sub">
                            {getAdsenseMetric(data.adsenseData.today, 2)} {t('admin.common.clicks', { default: '클릭' })} / {getAdsenseMetric(data.adsenseData.today, 1)} {t('admin.common.views_suffix', { default: '뷰' })}
                        </div>
                    </div>
                </div>
                <div
                    class="stat-card primary"
                    style="background: linear-gradient(135deg, #047857 0%, #064e3b 100%);"
                >
                    <div class="stat-icon"><DollarSign size={24} /></div>
                    <div class="stat-info">
                        <div class="stat-label">{t('admin.dashboard.stats.earnings_month', { default: '이번 달 예상 수입' })}</div>
                        <div class="stat-value">
                            <span class="unit">$</span>{getAdsenseMetric(data.adsenseData.month, 0)}
                        </div>
                        <div class="stat-sub">
                            {getAdsenseMetric(data.adsenseData.month, 2)} {t('admin.common.clicks', { default: '클릭' })} / {getAdsenseMetric(data.adsenseData.month, 1)} {t('admin.common.views_suffix', { default: '뷰' })}
                        </div>
                    </div>
                </div>
            </div>

            <div class="ga4-charts-grid" style="grid-template-columns: 1fr;">
                <div class="chart-card">
                    <h3 class="chart-title">{t('admin.dashboard.chart.earnings_trend_30d', { default: '최근 30일 예상 수입 및 클릭 트렌드' })}</h3>
                    <div class="chart-wrapper">
                        <canvas bind:this={adsenseChartCanvas}></canvas>
                    </div>
                </div>
            </div>
        {:else}
            <div class="empty-state">{t('admin.dashboard.reports.adsense_loading', { default: 'AdSense 데이터를 불러오는 중입니다...' })}</div>
        {/if}
    </section>

    <!-- 목록 그리드 -->
    <div class="dashboard-grid">
        <section class="dashboard-section">
            <div class="section-header">
                <h2><MessageSquare size={20} /> {t('admin.dashboard.recent.comments_title', { default: '최근 댓글' })}</h2>
                <span class="count-badge">{data.recentComments.length}</span>
            </div>
            <div class="list-container">
                {#if data.recentComments.length === 0}
                    <div class="empty-state">{t('admin.dashboard.recent.empty_comments', { default: '최근 등록된 댓글이 없습니다.' })}</div>
                {:else}
                    <div class="entry-list">
                        {#each (data.recentComments as any[]) as comment}
                            <div class="entry-item">
                                <div class="entry-meta">
                                    <span class="author">{comment.user_name || "익명"}</span>
                                    <span class="date">{formatDate(comment.created_at)}</span>
                                </div>
                                <div class="entry-content">{stripHtml(comment.content)}</div>
                                <div class="entry-target">
                                    <BookOpen size={14} style="display: inline-block; vertical-align: middle; margin-right: 4px;" />
                                    <a href="/posts/{comment.post_id}" class="post-link">{comment.post_title}</a>
                                </div>
                            </div>
                        {/each}
                    </div>
                    <a href="/interactions?tab=comment" class="btn-text" style="display: block; padding: 1rem; text-align: center; border-top: 1px solid #f1f5f9;">{t('admin.dashboard.recent.view_all', { default: '댓글 전체보기' })}</a>
                {/if}
            </div>
        </section>

        <section class="dashboard-section">
            <div class="section-header">
                <h2><UserCheck size={20} /> {t('admin.dashboard.recent.guestbook_title', { default: '최근 방명록' })}</h2>
                <span class="count-badge">{data.recentGuestbooks.length}</span>
            </div>
            <div class="list-container">
                {#if data.recentGuestbooks.length === 0}
                    <div class="empty-state">{t('admin.dashboard.recent.empty_guestbook', { default: '최근 등록된 방명록이 없습니다.' })}</div>
                {:else}
                    <div class="entry-list">
                        {#each (data.recentGuestbooks as any[]) as gb}
                            <div class="entry-item">
                                <div class="entry-meta">
                                    <span class="author">{gb.user_name || "익명"}</span>
                                    <span class="date">{formatDate(gb.created_at)}</span>
                                    {#if gb.is_private}
                                        <span class="private-badge">{t('admin.dashboard.recent.private_guestbook', { default: '비밀글' })}</span>
                                    {/if}
                                </div>
                                <div class="entry-content">{gb.content}</div>
                            </div>
                        {/each}
                    </div>
                    <a href="/interactions?tab=guestbook" class="btn-text" style="display: block; padding: 1rem; text-align: center; border-top: 1px solid #f1f5f9;">{t('admin.dashboard.recent.view_all', { default: '방명록 전체보기' })}</a>
                {/if}
            </div>
        </section>

        <section class="dashboard-section">
            <div class="section-header">
                <h2><FileText size={20} /> {t('admin.dashboard.recent.posts_title', { default: '최근 포스트' })}</h2>
                <a href="/posts" class="btn-text">{t('admin.dashboard.recent.view_all', { default: '모두 보기' })}</a>
            </div>
            <div class="table-responsive">
                {#if data.recentPosts.length === 0}
                    <div class="empty-state">{t('admin.posts.main.empty', { default: '작성된 포스트가 없습니다.' })}</div>
                {:else}
                    <table>
                        <thead>
                            <tr>
                                <th>Post</th>
                                <th class="center">Views</th>
                                <th class="center">Status</th>
                                <th class="right">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each (data.recentPosts as any[]) as post}
                                <tr>
                                    <td>
                                        <a href="/posts/{post.id}" class="post-title-link">{post.title}</a>
                                        <div class="slug">/{post.slug}</div>
                                    </td>
                                    <td class="center font-mono">{post.view_count || 0}</td>
                                    <td class="center"><span class="badge {post.status}">{post.status}</span></td>
                                    <td class="right">{formatDate(post.created_at)}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>
        </section>
    </div>
</div>

<style>
    .dashboard-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 2rem;
    }
    .page-header {
        margin-bottom: 2rem;
    }
    .page-header h1 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        font-size: 1.75rem;
        color: #111827;
        font-weight: 700;
    }
    .subtitle {
        color: #64748b;
        margin-top: 0.5rem;
        font-size: 1rem;
    }

    .dashboard-section {
        margin-bottom: 2rem;
    }
    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
    }
    .section-header h2 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        font-size: 1.25rem;
        color: #1e293b;
        font-weight: 600;
    }
    .count-badge {
        background: #e2e8f0;
        color: #475569;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.2rem 0.6rem;
        border-radius: 1rem;
    }
    .btn-text {
        color: #3b82f6;
        text-decoration: none;
        font-weight: 500;
        font-size: 0.875rem;
        transition: color 0.2s;
    }
    .btn-text:hover {
        color: #2563eb;
    }

    /* Stats Overview */
    .stats-overview {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
    }
    .stat-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
        padding: 1.5rem;
        display: flex;
        align-items: center;
        gap: 1.25rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .stat-card.primary {
        background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
        color: white;
    }
    .stat-card.primary .stat-label, .stat-card.primary .stat-sub {
        color: rgba(255, 255, 255, 0.8);
    }
    .stat-icon {
        width: 48px;
        height: 48px;
        background: #f1f5f9;
        color: #3b82f6;
        border-radius: 0.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .stat-icon.highlight {
        background: #eff6ff;
        color: #2563eb;
    }
    .stat-card.primary .stat-icon {
        background: rgba(255, 255, 255, 0.1);
        color: white;
    }
    .stat-info {
        flex: 1;
    }
    .stat-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 0.25rem;
    }
    .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e293b;
    }
    .stat-card.primary .stat-value {
        color: white;
    }
    .stat-value .unit {
        font-size: 1rem;
        margin-right: 2px;
    }
    .stat-sub {
        font-size: 0.75rem;
        color: #94a3b8;
        margin-top: 0.25rem;
    }

    /* Dashboard Grid */
    .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
        gap: 1.5rem;
    }
    @media (max-width: 768px) {
        .dashboard-grid {
            grid-template-columns: 1fr;
        }
    }
    .list-container {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
        overflow: hidden;
    }

    /* Entry List (Comments, Guestbook) */
    .entry-list {
        display: flex;
        flex-direction: column;
    }
    .entry-item {
        padding: 1.25rem;
        border-bottom: 1px solid #f1f5f9;
    }
    .entry-item:last-child {
        border-bottom: none;
    }
    .entry-meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
    }
    .author {
        font-weight: 600;
        color: #1e293b;
    }
    .date {
        color: #94a3b8;
        font-size: 0.75rem;
    }
    .private-badge {
        background: #fee2e2;
        color: #991b1b;
        font-size: 0.65rem;
        padding: 0.1rem 0.4rem;
        border-radius: 0.25rem;
        font-weight: 600;
    }
    .entry-content {
        color: #475569;
        font-size: 0.875rem;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .entry-target {
        margin-top: 0.5rem;
        font-size: 0.75rem;
        color: #64748b;
    }
    .post-link {
        color: #3b82f6;
        text-decoration: none;
        font-weight: 500;
    }
    .post-link:hover {
        text-decoration: underline;
    }

    /* Table (Posts) */
    .table-responsive {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
        overflow-x: auto;
    }
    table {
        width: 100%;
        border-collapse: collapse;
    }
    th {
        background: #f8fafc;
        padding: 1rem 1.5rem;
        font-weight: 600;
        font-size: 0.75rem;
        color: #64748b;
        text-transform: uppercase;
        border-bottom: 1px solid #e2e8f0;
        text-align: left;
    }
    td {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.875rem;
        color: #334155;
    }
    tr:last-child td {
        border-bottom: none;
    }
    .center {
        text-align: center;
    }
    .right {
        text-align: right;
    }
    .font-mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .post-title-link {
        font-weight: 600;
        color: #1e293b;
        text-decoration: none;
        transition: color 0.2s;
    }
    .post-title-link:hover {
        color: #3b82f6;
    }
    .slug {
        font-size: 0.75rem;
        color: #94a3b8;
        margin-top: 0.25rem;
    }
    .badge {
        display: inline-flex;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: capitalize;
    }
    .badge.published {
        background: #dcfce7;
        color: #166534;
    }
    .badge.draft {
        background: #f1f5f9;
        color: #475569;
    }

    /* GA4 Section */
    .ga4-alert {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: 0.75rem;
        margin-bottom: 1.5rem;
    }
    .ga4-alert.warning {
        background: #fffbeb;
        border: 1px solid #fde68a;
    }
    .ga4-alert.warning .alert-icon {
        color: #d97706;
    }
    .ga4-alert.warning h3 {
        color: #92400e;
    }
    .ga4-alert.error {
        background: #fef2f2;
        border: 1px solid #fecaca;
    }
    .ga4-alert.error .alert-icon {
        color: #dc2626;
    }
    .ga4-alert.error h3 {
        color: #991b1b;
    }
    .alert-content h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
        font-weight: 600;
    }
    .alert-content p {
        margin: 0;
        font-size: 0.875rem;
        color: #475569;
        line-height: 1.5;
    }
    .alert-content code {
        background: rgba(0, 0, 0, 0.05);
        padding: 0.1rem 0.3rem;
        border-radius: 0.25rem;
        font-family: monospace;
    }

    .ga4-charts-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 1.5rem;
        min-width: 0;
    }
    @media (max-width: 1024px) {
        .ga4-charts-grid {
            grid-template-columns: 1fr;
        }
    }
    .chart-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 1.25rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
        min-width: 0;
    }
    .chart-title {
        margin: 0 0 1rem 0;
        font-size: 1rem;
        font-weight: 600;
        color: #334155;
    }
    .chart-wrapper {
        position: relative;
        height: 300px;
        width: 100%;
    }
</style>
