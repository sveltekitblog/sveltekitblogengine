<!--
 Copyright (C) 2026 SvelteKit Blog Engine

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
    import { goto } from "$app/navigation";
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
        Compass,
        Globe,
        Smartphone,
        Cpu,
        Layout,
        Download,
        FileSpreadsheet,
        X,
    } from "lucide-svelte";
    import Chart from "chart.js/auto";

    let { data } = $props<{ data: PageData }>();

    let trafficChartCanvas: HTMLCanvasElement | undefined = $state();
    let sourceChartCanvas: HTMLCanvasElement | undefined = $state();
    let trafficChart: Chart | null = null;
    let sourceChart: Chart | null = null;

    let dimensionChartCanvas: HTMLCanvasElement | undefined = $state();
    let dimensionChart: Chart | null = null;
    let cfaDimensionTab = $state<'referrers' | 'countries' | 'pages' | 'browsers' | 'devices'>('referrers');

    // CSV 내보내기 모달 관련 상태
    let isExportModalOpen = $state(false);
    let exportPeriod = $state<'7d' | '28d' | 'month' | '90d' | 'year'>('28d');
    let exportMode = $state<'all' | 'custom'>('all');
    let exportSections = $state({
        traffic: true,
        pages: true,
        referrers: true,
        countries: true,
        devices: true
    });
    let isExporting = $state(false);

    let adsenseChartCanvas: HTMLCanvasElement | undefined = $state();
    let adsenseChart: Chart | null = null;

    // CFA 리포트 기간 선택 상태 ('today' | 'yesterday' | '7d' | 'date:YYYY-MM-DD')
    let cfaPeriod = $state<string>("today");
    let selectedDateDropdown = $state<string>("");

    let activeCfDetails = $derived.by(() => {
        if (cfaPeriod === "today") {
            return data.cfDetails?.today || data.cfDetails;
        }
        if (cfaPeriod === "yesterday") {
            const yDate = data.stats?.yesterday?.date;
            if (yDate && data.cfDetails?.byDate?.[yDate]) {
                return data.cfDetails.byDate[yDate];
            }
        }
        if (cfaPeriod === "7d") {
            return data.cfDetails?.days7 || data.cfDetails;
        }
        if (cfaPeriod.startsWith("date:") && data.cfDetails?.byDate) {
            const dateKey = cfaPeriod.replace("date:", "");
            if (data.cfDetails.byDate[dateKey]) {
                return data.cfDetails.byDate[dateKey];
            }
        }
        return data.cfDetails?.today || data.cfDetails;
    });

    let currentPeriodLabel = $derived.by(() => {
        if (cfaPeriod === "today") return data.stats?.today?.date || t('admin.dashboard.reports.period_today', { default: '오늘' });
        if (cfaPeriod === "yesterday")
            return data.stats?.yesterday?.date || t('admin.dashboard.reports.period_yesterday', { default: '어제' });
        if (cfaPeriod === "7d") return t('admin.dashboard.reports.period_7d', { default: '최근 7일' });
        if (cfaPeriod.startsWith("date:"))
            return cfaPeriod.replace("date:", "");
        return cfaPeriod;
    });

    // 선택된 기간의 총 페이지뷰 및 방문자수 산출
    let selectedPeriodSummary = $derived.by(() => {
        if (cfaPeriod === "today") {
            return {
                views: data.stats?.today?.views || 0,
                visitors: data.stats?.today?.visitors || 0
            };
        }
        if (cfaPeriod === "yesterday") {
            return {
                views: data.stats?.yesterday?.views || 0,
                visitors: data.stats?.yesterday?.visitors || 0
            };
        }
        if (cfaPeriod === "7d") {
            const rows = data.analyticsData?.trafficData?.rows || [];
            const last7 = rows.slice(-7);
            const views = last7.reduce((acc: number, r: any) => acc + (parseInt(r.metricValues?.[0]?.value, 10) || 0), 0);
            const visitors = last7.reduce((acc: number, r: any) => acc + (parseInt(r.metricValues?.[1]?.value, 10) || 0), 0);
            return { views, visitors };
        }
        if (cfaPeriod.startsWith("date:")) {
            const dateStr = cfaPeriod.replace("date:", "").replace(/-/g, "");
            const rows = data.analyticsData?.trafficData?.rows || [];
            const matched = rows.find((r: any) => r.dimensionValues?.[0]?.value === dateStr);
            if (matched) {
                return {
                    views: parseInt(matched.metricValues?.[0]?.value, 10) || 0,
                    visitors: parseInt(matched.metricValues?.[1]?.value, 10) || 0
                };
            }
        }
        return {
            views: data.stats?.today?.views || 0,
            visitors: data.stats?.today?.visitors || 0
        };
    });

    async function handleDownloadCsv() {
        if (exportMode === 'custom') {
            const hasChecked = Object.values(exportSections).some(Boolean);
            if (!hasChecked) {
                alert(t('admin.dashboard.export.error_no_section', { default: '최소 하나 이상의 항목을 선택해 주세요.' }));
                return;
            }
        }

        isExporting = true;
        try {
            const activeSections = Object.entries(exportSections)
                .filter(([, checked]) => checked)
                .map(([key]) => key)
                .join(',');

            const currentLang = (typeof window !== 'undefined' ? localStorage.getItem('admin_lang') : '') || 'ko';
            const params = new URLSearchParams({
                period: exportPeriod,
                mode: exportMode,
                sections: activeSections,
                lang: currentLang
            });

            const res = await fetch(`/api/analytics/export?${params.toString()}`);
            if (!res.ok) throw new Error('Export request failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            let filename = `skbe_analytics_${exportPeriod}.${exportMode === 'custom' ? 'xlsx' : 'csv'}`;
            const disposition = res.headers.get('Content-Disposition');
            if (disposition && disposition.includes('filename=')) {
                const match = disposition.match(/filename=["']?([^"']+)["']?/);
                if (match && match[1]) {
                    filename = match[1];
                }
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            isExportModalOpen = false;
        } catch (e: any) {
            alert('CSV 다운로드 실패: ' + e.message);
        } finally {
            isExporting = false;
        }
    }

    onMount(() => {
        initAllCharts();
    });

    $effect(() => {
        // data.activeProvider 또는 analyticsData 변경 시 차트 재초기화 (switchProvider 대응)
        data.activeProvider;
        data.analyticsData;
        initAllCharts();
    });

    $effect(() => {
        // 기간이나 디멘션 탭이 변경될 때 수평 막대 차트 실시간 갱신
        cfaPeriod;
        cfaDimensionTab;
        activeCfDetails;
        tick().then(() => initDimensionChart());
    });

    function initAllCharts() {
        initTrafficChart();
        initSourceChart();
        if (data.adsenseData) initAdsenseChart();
        if (data.activeProvider === 'cf') initDimensionChart();
    }

    function initDimensionChart() {
        if (!dimensionChartCanvas || data.activeProvider !== 'cf') return;
        if (dimensionChart) {
            dimensionChart.destroy();
            dimensionChart = null;
        }
        const items = activeCfDetails?.[cfaDimensionTab] || [];
        if (!items || items.length === 0) return;

        const topItems = items.slice(0, 7);
        const labels = topItems.map((item: any) => item.name || 'Unknown');
        const values = topItems.map((item: any) => Number(item.visitors || item.views || 0));

        const tabColors: Record<string, { bg: string; border: string }> = {
            referrers: { bg: 'rgba(59, 130, 246, 0.7)', border: '#3b82f6' },
            countries: { bg: 'rgba(16, 185, 129, 0.7)', border: '#10b981' },
            pages:     { bg: 'rgba(245, 158, 11, 0.7)', border: '#f59e0b' },
            browsers:  { bg: 'rgba(139, 92, 246, 0.7)', border: '#8b5cf6' },
            devices:   { bg: 'rgba(236, 72, 153, 0.7)', border: '#ec4899' }
        };
        const currentStyle = tabColors[cfaDimensionTab] || tabColors.referrers;

        dimensionChart = new Chart(dimensionChartCanvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: t('admin.common.unit_person', { default: '방문자 (Visitors)' }),
                        data: values,
                        backgroundColor: currentStyle.bg,
                        borderColor: currentStyle.border,
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                indexAxis: 'y', // 수평 막대 그래프
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    },
                    y: {
                        ticks: {
                            callback: function(val, index) {
                                const lbl = labels[index] || '';
                                return lbl.length > 25 ? lbl.substring(0, 25) + '…' : lbl;
                            }
                        }
                    }
                }
            }
        });
    }

    function switchProvider(provider: string) {
        if (data.activeProvider === provider) return;
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("provider", provider);
        goto(currentUrl.pathname + currentUrl.search, {
            keepFocus: true,
            noScroll: true,
            invalidateAll: true,
        });
    }

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
        const clicks = rows.map((r: any) => parseInt(r.cells[3].value, 10));

        adsenseChart = new Chart(adsenseChartCanvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: t("admin.dashboard.chart.earnings", {
                            default: "수익 (Earnings $)",
                        }),
                        data: earnings,
                        borderColor: "#10b981",
                        backgroundColor: "rgba(16, 185, 129, 0.1)",
                        tension: 0.3,
                        fill: true,
                        yAxisID: "y",
                    },
                    {
                        label: t("admin.dashboard.chart.clicks", {
                            default: "클릭 (Clicks)",
                        }),
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
                    y: {
                        type: "linear",
                        display: true,
                        position: "left",
                        beginAtZero: true,
                    },
                    y1: {
                        type: "linear",
                        display: true,
                        position: "right",
                        beginAtZero: true,
                        grid: { drawOnChartArea: false },
                    },
                },
            },
        });
    }

    function getAdsenseMetric(report: any, index: number, defaultVal = "0") {
        const val = report?.rows?.[0]?.cells?.[index]?.value;
        return val
            ? parseFloat(val).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
              })
            : defaultVal;
    }

    function initTrafficChart() {
        const trafficData =
            data.analyticsData?.trafficData || data.ga4Data?.trafficData;
        if (!trafficChartCanvas || !trafficData?.rows) return;

        if (trafficChart) {
            trafficChart.destroy();
            trafficChart = null;
        }

        const rows = trafficData.rows;
        const labels = rows.map((r: any) => {
            const dateStr = r.dimensionValues[0].value;
            return `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`;
        });
        const isCf = data.activeProvider === "cf";
        const metric1Label = isCf
            ? t("admin.common.views", { default: "조회수 (Page Views)" })
            : t("admin.dashboard.chart.sessions", {
                  default: "세션 (Sessions)",
              });
        const metric2Label = isCf
            ? t("admin.common.unit_person", { default: "방문자 (Visitors)" })
            : t("admin.dashboard.chart.active_users", {
                  default: "활성 사용자 (Active Users)",
              });
        const sessions = rows.map((r: any) =>
            parseInt(r.metricValues[0].value, 10),
        );
        const activeUsers = rows.map((r: any) =>
            parseInt(r.metricValues[1].value, 10),
        );

        trafficChart = new Chart(trafficChartCanvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: metric1Label,
                        data: sessions,
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59, 130, 246, 0.1)",
                        tension: 0.3,
                        fill: true,
                    },
                    {
                        label: metric2Label,
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
        const sourceData =
            data.analyticsData?.sourceData || data.ga4Data?.sourceData;
        if (!sourceChartCanvas || !sourceData?.rows) return;

        if (sourceChart) {
            sourceChart.destroy();
            sourceChart = null;
        }

        const rows = sourceData.rows;
        const labels = rows.map((r: any) => r.dimensionValues[0].value);
        const sessions = rows.map((r: any) =>
            parseInt(r.metricValues[0].value, 10),
        );

        sourceChart = new Chart(sourceChartCanvas, {
            type: "doughnut",
            data: {
                labels,
                datasets: [
                    {
                        data: sessions,
                        backgroundColor: [
                            "#3b82f6",
                            "#10b981",
                            "#f59e0b",
                            "#ef4444",
                            "#8b5cf6",
                            "#64748b",
                        ],
                    },
                ],
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
        const d =
            typeof date === "number"
                ? new Date(date)
                : new Date(date.replace(" ", "T"));
        if (isNaN(d.getTime())) {
            if (typeof date === "string" && date.length >= 16)
                return date.substring(0, 16);
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
        <h1>
            <BarChart2 size={32} />
            {t("admin.dashboard.title", { default: "관리 대시보드" })}
        </h1>
        <p class="subtitle">
            {t("admin.dashboard.subtitle", {
                default: "오늘의 블로그 현황과 통계를 확인하세요.",
            })}
        </p>
    </header>

    <!-- 요약 통계 카드 -->
    <section class="dashboard-section">
        <div class="stats-overview">
            <div class="stat-card">
                <div class="stat-icon"><User size={24} /></div>
                <div class="stat-info">
                    <div class="stat-label">
                        {t("admin.dashboard.stats.visitors_yesterday", {
                            default: "어제 방문자",
                        })}
                        {#if data.stats?.yesterday?.date}<span
                                class="text-xs text-muted font-mono font-normal"
                                >({data.stats.yesterday.date})</span
                            >{/if}
                    </div>
                    <div class="stat-value">
                        {data.stats.yesterday.visitors.toLocaleString()}
                        <span class="unit"
                            >{t("admin.common.unit_person", {
                                default: "명",
                            })}</span
                        >
                    </div>
                    <div class="stat-sub">
                        {data.stats.yesterday.views.toLocaleString()}
                        {t("admin.common.views", { default: "조회" })}
                    </div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon highlight"><UserCheck size={24} /></div>
                <div class="stat-info">
                    <div class="stat-label">
                        {t("admin.dashboard.stats.visitors_today", {
                            default: "오늘 방문자",
                        })}
                        {#if data.stats?.today?.date}<span
                                class="text-xs text-muted font-mono font-normal"
                                >({data.stats.today.date})</span
                            >{/if}
                    </div>
                    <div class="stat-value">
                        {data.stats.today.visitors.toLocaleString()}
                        <span class="unit"
                            >{t("admin.common.unit_person", {
                                default: "명",
                            })}</span
                        >
                    </div>
                    <div class="stat-sub">
                        {data.stats.today.views.toLocaleString()}
                        {t("admin.common.views", { default: "조회" })}
                    </div>
                </div>
            </div>
            <div class="stat-card primary">
                <div class="stat-icon"><BarChart2 size={24} /></div>
                <div class="stat-info">
                    <div class="stat-label">
                        {t("admin.dashboard.stats.visitors_total", {
                            default: "전체 방문자",
                        })}
                    </div>
                    <div class="stat-value">
                        {data.stats.total.visitors.toLocaleString()}
                        <span class="unit"
                            >{t("admin.common.unit_person", {
                                default: "명",
                            })}</span
                        >
                    </div>
                    <div class="stat-sub">
                        {data.stats.total.views.toLocaleString()}
                        {t("admin.common.views", { default: "조회" })}
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- 트래픽 리포트 영역 (Cloudflare Web Analytics / GA4) -->
    <section class="dashboard-section">
        <div class="section-header analytics-header">
            <div class="header-title-group">
                <h2>
                    <TrendingUp size={20} />
                    {data.activeProvider === "cf"
                        ? t("admin.dashboard.reports.cf_title", {
                              default:
                                  "트래픽 리포트 (Cloudflare Web Analytics)",
                          })
                        : t("admin.dashboard.reports.ga4_title", {
                              default: "트래픽 리포트 (GA4)",
                          })}
                </h2>
                {#if data.siteTimezone}
                    <span class="timezone-badge" title="사이트 대표 시간대"
                        >🕒 {data.siteTimezone}</span
                    >
                {/if}
            </div>
            <div class="provider-toggle-wrap">
                <div class="provider-toggle">
                    <button
                        type="button"
                        class="provider-btn"
                        class:active={data.activeProvider === "cf"}
                        onclick={() => switchProvider("cf")}
                    >
                        {t("admin.dashboard.reports.provider_cf", {
                            default: "Cloudflare",
                        })}
                    </button>
                    <button
                        type="button"
                        class="provider-btn"
                        class:active={data.activeProvider === "ga4"}
                        onclick={() => switchProvider("ga4")}
                    >
                        {t("admin.dashboard.reports.provider_ga4", {
                            default: "GA4",
                        })}
                    </button>
                </div>
                {#if data.activeProvider === "cf"}
                    <button
                        type="button"
                        class="btn-export-csv"
                        onclick={() => (isExportModalOpen = true)}
                        title={t("admin.dashboard.export.button_title", { default: "분석 데이터 CSV 내보내기" })}
                    >
                        <Download size={15} />
                        <span>{t("admin.dashboard.export.btn_open", { default: "CSV 내보내기" })}</span>
                    </button>
                {/if}
            </div>
        </div>

        {#if data.isDummyData}
            <div class="ga4-alert warning mb-4">
                <div class="alert-icon"><AlertCircle size={24} /></div>
                <div class="alert-content">
                    {#if data.activeProvider === "cf"}
                        <h3>
                            {t("admin.dashboard.reports.cf_dummy_warning", {
                                default:
                                    "Cloudflare Web Analytics가 설정되지 않아 더미 데이터(예시)를 표시 중입니다.",
                            })}
                        </h3>
                        <p>
                            {t("admin.dashboard.reports.cf_dummy_desc", {
                                default:
                                    "차트 출력 확인용이며 실제 데이터가 아닙니다. 환경 변수(Secret)에 다음 키를 등록해주세요:",
                            })}
                            <code>CF_ACCOUNT_ID</code>,
                            <code>CF_API_TOKEN</code>,
                            <code>CF_WEB_ANALYTICS_SITE_TAG</code>
                        </p>
                    {:else}
                        <h3>
                            {t("admin.dashboard.reports.ga4_dummy_warning", {
                                default:
                                    "Google Analytics 4가 설정되지 않아 더미 데이터(예시)를 표시 중입니다.",
                            })}
                        </h3>
                        <p>
                            {t("admin.dashboard.reports.ga4_dummy_desc", {
                                default:
                                    "차트 출력 확인용이며 실제 데이터가 아닙니다. 환경 변수(Secret)에 다음 키를 등록해주세요:",
                            })}
                            <code>GA4_PROPERTY_ID</code>,
                            <code>GA4_CLIENT_EMAIL</code>,
                            <code>GA4_PRIVATE_KEY</code>
                        </p>
                    {/if}
                </div>
            </div>
        {/if}

        {#if data.analyticsError || data.ga4Error}
            <div class="ga4-alert error">
                <div class="alert-icon"><AlertCircle size={24} /></div>
                <div class="alert-content">
                    <h3>
                        {t("admin.dashboard.reports.data_error_title", {
                            default:
                                "데이터를 불러오는 중 오류가 발생했습니다.",
                        })}
                    </h3>
                    <p>{data.analyticsError || data.ga4Error}</p>
                </div>
            </div>
        {/if}
        {#if data.analyticsData || data.ga4Data}
            {#if data.activeProvider === "cf"}
                <!-- Cloudflare Web Analytics 종합 현황판 -->
                <div class="chart-card mb-4">
                    <h3 class="chart-title">
                        {t("admin.dashboard.reports.recent_28d_traffic", {
                            default: "최근 28일 트래픽 (일별)",
                        })}
                    </h3>
                    <div class="chart-wrapper">
                        <canvas bind:this={trafficChartCanvas}></canvas>
                    </div>
                </div>

                {#if data.cfDetails}
                    <!-- CFA 리포트 기간 선택 토글 바 -->
                    <div class="cfa-period-bar mb-3">
                        <div class="period-toggle-group">
                            <button
                                type="button"
                                class="period-toggle-btn"
                                class:active={cfaPeriod === "today"}
                                onclick={() => {
                                    cfaPeriod = "today";
                                    selectedDateDropdown = "";
                                }}
                            >
                                {t('admin.dashboard.reports.period_today', { default: '오늘' })} ({data.stats?.today?.date || t('admin.dashboard.reports.period_today', { default: '오늘' })})
                            </button>
                            <button
                                type="button"
                                class="period-toggle-btn"
                                class:active={cfaPeriod === "yesterday"}
                                onclick={() => {
                                    cfaPeriod = "yesterday";
                                    selectedDateDropdown = "";
                                }}
                            >
                                {t('admin.dashboard.reports.period_yesterday', { default: '어제' })} ({data.stats?.yesterday?.date || t('admin.dashboard.reports.period_yesterday', { default: '어제' })})
                            </button>
                            <button
                                type="button"
                                class="period-toggle-btn"
                                class:active={cfaPeriod === "7d"}
                                onclick={() => {
                                    cfaPeriod = "7d";
                                    selectedDateDropdown = "";
                                }}
                            >
                                {t("admin.dashboard.reports.period_7d", {
                                    default: "최근 7일",
                                })}
                            </button>

                            {#if data.availableDates && data.availableDates.length > 0}
                                <select
                                    class="period-date-select"
                                    bind:value={selectedDateDropdown}
                                    onchange={() => {
                                        if (selectedDateDropdown) {
                                            cfaPeriod = `date:${selectedDateDropdown}`;
                                        }
                                    }}
                                >
                                    <option
                                        value=""
                                        disabled
                                        selected={!cfaPeriod.startsWith(
                                            "date:",
                                        )}
                                        >{t('admin.dashboard.reports.select_specific_date', { default: '📅 특정 날짜 선택 (YYYY-MM-DD)' })}</option
                                    >
                                    {#each data.availableDates as d}
                                        <option value={d}>{d}</option>
                                    {/each}
                                </select>
                            {/if}
                        </div>
                    </div>

                    <!-- 1. 선택 날짜 방문 요약 카드 (Visits Summary) -->
                    <div class="cfa-summary-cards mb-4">
                        <div class="cfa-summary-metric-card">
                            <div class="metric-icon views"><FileText size={20} /></div>
                            <div class="metric-info">
                                <div class="metric-label">
                                    {t('admin.dashboard.reports.cfa_summary_views', { default: '페이지뷰' })}
                                    <span class="period-sub">({currentPeriodLabel})</span>
                                </div>
                                <div class="metric-val">{selectedPeriodSummary.views.toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="cfa-summary-metric-card">
                            <div class="metric-icon visits"><UserCheck size={20} /></div>
                            <div class="metric-info">
                                <div class="metric-label">
                                    {t('admin.dashboard.reports.cfa_summary_visits', { default: '방문 세션' })}
                                    <span class="period-sub">({currentPeriodLabel})</span>
                                </div>
                                <div class="metric-val">{selectedPeriodSummary.visitors.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>

                    <!-- 2. 신규 디멘션 시각화 분석 차트 (Horizontal Bar Chart) -->
                    <div class="chart-card cfa-dimension-card mb-4">
                        <div class="cfa-dimension-header">
                            <h3 class="chart-title">
                                <TrendingUp size={18} />
                                {t('admin.dashboard.reports.cfa_chart_title', { default: '세부 분석 차트' })}
                                <span class="period-badge">({currentPeriodLabel})</span>
                            </h3>
                            <div class="dimension-tabs">
                                <button
                                    type="button"
                                    class="dim-tab-btn"
                                    class:active={cfaDimensionTab === 'referrers'}
                                    onclick={() => cfaDimensionTab = 'referrers'}
                                >
                                    <Compass size={14} />
                                    {t('admin.dashboard.reports.cfa_tab_referrers', { default: '참조자' })}
                                </button>
                                <button
                                    type="button"
                                    class="dim-tab-btn"
                                    class:active={cfaDimensionTab === 'countries'}
                                    onclick={() => cfaDimensionTab = 'countries'}
                                >
                                    <Globe size={14} />
                                    {t('admin.dashboard.reports.cfa_tab_countries', { default: '국가' })}
                                </button>
                                <button
                                    type="button"
                                    class="dim-tab-btn"
                                    class:active={cfaDimensionTab === 'pages'}
                                    onclick={() => cfaDimensionTab = 'pages'}
                                >
                                    <FileText size={14} />
                                    {t('admin.dashboard.reports.cfa_tab_paths', { default: '경로' })}
                                </button>
                                <button
                                    type="button"
                                    class="dim-tab-btn"
                                    class:active={cfaDimensionTab === 'browsers'}
                                    onclick={() => cfaDimensionTab = 'browsers'}
                                >
                                    <Layout size={14} />
                                    {t('admin.dashboard.reports.cfa_tab_browsers', { default: '브라우저' })}
                                </button>
                                <button
                                    type="button"
                                    class="dim-tab-btn"
                                    class:active={cfaDimensionTab === 'devices'}
                                    onclick={() => cfaDimensionTab = 'devices'}
                                >
                                    <Smartphone size={14} />
                                    {t('admin.dashboard.reports.cfa_tab_devices', { default: '장치 유형' })}
                                </button>
                            </div>
                        </div>
                        <div class="chart-wrapper dimension-chart-wrapper">
                            {#if activeCfDetails && activeCfDetails[cfaDimensionTab] && activeCfDetails[cfaDimensionTab].length > 0}
                                <canvas bind:this={dimensionChartCanvas}></canvas>
                            {:else}
                                <div class="no-data-text chart-empty">
                                    {t('admin.dashboard.reports.cfa_chart_no_data', { default: '선택한 기간에 분석 데이터가 없습니다.' })}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <div class="cfa-details-grid mb-4">
                        <!-- 인기 페이지 Top 5 -->
                        <div class="detail-card">
                            <h4 class="detail-title">
                                <FileText size={18} />
                                {t("admin.dashboard.reports.cfa_top_pages", {
                                    default: "인기 페이지 Top 5",
                                })}
                                <span class="period-badge"
                                    >({currentPeriodLabel})</span
                                >
                            </h4>
                            {#if activeCfDetails && activeCfDetails.pages && activeCfDetails.pages.length > 0}
                                <div class="detail-table-wrap">
                                    <table class="detail-table">
                                        <thead>
                                            <tr>
                                                <th
                                                    >{t(
                                                        "admin.dashboard.reports.col_path",
                                                        { default: "경로" },
                                                    )}</th
                                                >
                                                <th class="right"
                                                    >{t(
                                                        "admin.dashboard.reports.col_views",
                                                        { default: "조회수" },
                                                    )}</th
                                                >
                                                <th class="right"
                                                    >{t(
                                                        "admin.dashboard.reports.col_visitors",
                                                        { default: "방문자" },
                                                    )}</th
                                                >
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each activeCfDetails.pages.slice(0, 5) as p}
                                                <tr>
                                                    <td
                                                        class="font-mono text-truncate"
                                                        title={p.name}
                                                        >{p.name}</td
                                                    >
                                                    <td
                                                        class="right font-semibold"
                                                        >{p.views.toLocaleString()}</td
                                                    >
                                                    <td class="right text-muted"
                                                        >{p.visitors.toLocaleString()}</td
                                                    >
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            {:else}
                                <div class="no-data-text">
                                    {t("admin.dashboard.reports.no_pages", {
                                        default:
                                            "수집된 페이지 데이터가 없습니다.",
                                    })}
                                </div>
                            {/if}
                        </div>

                        <!-- 유입 참조자 Top 5 -->
                        <div class="detail-card">
                            <h4 class="detail-title">
                                <Compass size={18} />
                                {t(
                                    "admin.dashboard.reports.cfa_top_referrers",
                                    { default: "유입 참조자 Top 5" },
                                )}
                                <span class="period-badge"
                                    >({currentPeriodLabel})</span
                                >
                            </h4>
                            {#if activeCfDetails && activeCfDetails.referrers && activeCfDetails.referrers.length > 0}
                                <div class="detail-table-wrap">
                                    <table class="detail-table">
                                        <thead>
                                            <tr>
                                                <th
                                                    >{t(
                                                        "admin.dashboard.reports.col_referrer",
                                                        {
                                                            default:
                                                                "참조자 (출처)",
                                                        },
                                                    )}</th
                                                >
                                                <th class="right"
                                                    >{t(
                                                        "admin.dashboard.reports.col_sessions",
                                                        {
                                                            default:
                                                                "방문 세션",
                                                        },
                                                    )}</th
                                                >
                                                <th class="right"
                                                    >{t(
                                                        "admin.dashboard.reports.col_views",
                                                        { default: "조회수" },
                                                    )}</th
                                                >
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each activeCfDetails.referrers.slice(0, 5) as r}
                                                <tr>
                                                    <td
                                                        class="text-truncate"
                                                        title={r.name}
                                                        >{r.name}</td
                                                    >
                                                    <td
                                                        class="right font-semibold"
                                                        >{r.visitors.toLocaleString()}</td
                                                    >
                                                    <td class="right text-muted"
                                                        >{r.views.toLocaleString()}</td
                                                    >
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            {:else}
                                <div class="no-data-text">
                                    {t("admin.dashboard.reports.no_referrers", {
                                        default:
                                            "수집된 유입 참조자 데이터가 없습니다.",
                                    })}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- 하단 4열 요약 현황 카드 -->
                    <div class="cfa-summary-grid mb-4">
                        <div class="summary-card">
                            <div class="summary-header">
                                <Globe size={15} />
                                {t("admin.dashboard.reports.cfa_countries", {
                                    default: "국가별 방문",
                                })}
                            </div>
                            <div class="summary-list">
                                {#if activeCfDetails && activeCfDetails.countries && activeCfDetails.countries.length > 0}
                                    {#each activeCfDetails.countries.slice(0, 3) as c}
                                        <div class="summary-item">
                                            <span
                                                class="item-name"
                                                title={c.name}>{c.name}</span
                                            >
                                            <span class="item-val"
                                                >{c.visitors}{t(
                                                    "admin.common.unit_person",
                                                    { default: "명" },
                                                )}</span
                                            >
                                        </div>
                                    {/each}
                                {:else}
                                    <div class="no-data-text">-</div>
                                {/if}
                            </div>
                        </div>

                        <div class="summary-card">
                            <div class="summary-header">
                                <Smartphone size={15} />
                                {t("admin.dashboard.reports.cfa_devices", {
                                    default: "장치 유형",
                                })}
                            </div>
                            <div class="summary-list">
                                {#if activeCfDetails && activeCfDetails.devices && activeCfDetails.devices.length > 0}
                                    {#each activeCfDetails.devices.slice(0, 3) as d}
                                        <div class="summary-item">
                                            <span class="item-name"
                                                >{d.name}</span
                                            >
                                            <span class="item-val"
                                                >{d.visitors}{t(
                                                    "admin.common.unit_person",
                                                    { default: "명" },
                                                )}</span
                                            >
                                        </div>
                                    {/each}
                                {:else}
                                    <div class="no-data-text">-</div>
                                {/if}
                            </div>
                        </div>

                        <div class="summary-card">
                            <div class="summary-header">
                                <Layout size={15} />
                                {t("admin.dashboard.reports.cfa_browsers", {
                                    default: "브라우저",
                                })}
                            </div>
                            <div class="summary-list">
                                {#if activeCfDetails && activeCfDetails.browsers && activeCfDetails.browsers.length > 0}
                                    {#each activeCfDetails.browsers.slice(0, 3) as b}
                                        <div class="summary-item">
                                            <span
                                                class="item-name"
                                                title={b.name}>{b.name}</span
                                            >
                                            <span class="item-val"
                                                >{b.visitors}{t(
                                                    "admin.common.unit_person",
                                                    { default: "명" },
                                                )}</span
                                            >
                                        </div>
                                    {/each}
                                {:else}
                                    <div class="no-data-text">-</div>
                                {/if}
                            </div>
                        </div>

                        <div class="summary-card">
                            <div class="summary-header">
                                <Cpu size={15} />
                                {t("admin.dashboard.reports.cfa_os", {
                                    default: "운영체제",
                                })}
                            </div>
                            <div class="summary-list">
                                {#if activeCfDetails && activeCfDetails.os && activeCfDetails.os.length > 0}
                                    {#each activeCfDetails.os.slice(0, 3) as o}
                                        <div class="summary-item">
                                            <span
                                                class="item-name"
                                                title={o.name}>{o.name}</span
                                            >
                                            <span class="item-val"
                                                >{o.visitors}{t(
                                                    "admin.common.unit_person",
                                                    { default: "명" },
                                                )}</span
                                            >
                                        </div>
                                    {/each}
                                {:else}
                                    <div class="no-data-text">-</div>
                                {/if}
                            </div>
                        </div>
                    </div>
                {/if}
            {:else}
                <!-- GA4 전용 차트 그리드 유지 -->
                <div class="ga4-charts-grid">
                    <div class="chart-card">
                        <h3 class="chart-title">
                            {t("admin.dashboard.reports.recent_28d_traffic", {
                                default: "최근 28일 트래픽 (일별)",
                            })}
                        </h3>
                        <div class="chart-wrapper">
                            <canvas bind:this={trafficChartCanvas}></canvas>
                        </div>
                    </div>
                    <div class="chart-card">
                        <h3 class="chart-title">
                            {t("admin.dashboard.reports.user_acquisition", {
                                default: "사용자 획득 (소스/매체)",
                            })}
                        </h3>
                        <div class="chart-wrapper">
                            <canvas bind:this={sourceChartCanvas}></canvas>
                        </div>
                    </div>
                </div>
            {/if}
        {:else}
            <div class="empty-state">
                {t("admin.dashboard.reports.ga4_loading", {
                    default: "트래픽 데이터를 불러오는 중입니다...",
                })}
            </div>
        {/if}
    </section>

    <!-- 구글 애드센스 영역 -->
    <section class="dashboard-section">
        <div class="section-header">
            <h2>
                <DollarSign size={20} />
                {t("admin.dashboard.reports.adsense_title", {
                    default: "실적 리포트 (AdSense)",
                })}
            </h2>
        </div>

        {#if data.isAdsenseDummyData}
            <div class="ga4-alert warning mb-4">
                <div class="alert-icon"><AlertCircle size={24} /></div>
                <div class="alert-content">
                    <h3>
                        {t("admin.dashboard.reports.adsense_dummy_warning", {
                            default:
                                "Google AdSense API가 설정되지 않아 더미 데이터(예시)를 표시 중입니다.",
                        })}
                    </h3>
                    <p>
                        {t("admin.dashboard.reports.adsense_dummy_desc", {
                            default:
                                "차트 출력 확인용이며 실제 데이터가 아닙니다. 환경 변수(Secret)에 다음 키를 모두 등록해주세요:",
                        })}
                        <code>ADSENSE_ACCOUNT_ID</code>,
                        <code>ADSENSE_CLIENT_ID</code>,
                        <code>ADSENSE_CLIENT_SECRET</code>,
                        <code>ADSENSE_REFRESH_TOKEN</code>
                    </p>
                </div>
            </div>
        {/if}

        {#if data.adsenseError}
            <div class="ga4-alert error">
                <div class="alert-icon"><AlertCircle size={24} /></div>
                <div class="alert-content">
                    <h3>
                        {t("admin.dashboard.reports.data_error_title", {
                            default:
                                "데이터를 불러오는 중 오류가 발생했습니다.",
                        })}
                    </h3>
                    <p>{data.adsenseError}</p>
                </div>
            </div>
        {:else if data.adsenseData}
            <div class="stats-overview" style="margin-bottom: 1.5rem;">
                <div class="stat-card">
                    <div class="stat-icon"><DollarSign size={24} /></div>
                    <div class="stat-info">
                        <div class="stat-label">
                            {t("admin.dashboard.stats.earnings_yesterday", {
                                default: "어제 예상 수입",
                            })}
                        </div>
                        <div class="stat-value">
                            <span class="unit">$</span>{getAdsenseMetric(
                                data.adsenseData.yesterday,
                                0,
                            )}
                        </div>
                        <div class="stat-sub">
                            {getAdsenseMetric(data.adsenseData.yesterday, 2)}
                            {t("admin.common.clicks", { default: "클릭" })} / {getAdsenseMetric(
                                data.adsenseData.yesterday,
                                1,
                            )}
                            {t("admin.common.views_suffix", { default: "뷰" })}
                        </div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon highlight">
                        <DollarSign size={24} />
                    </div>
                    <div class="stat-info">
                        <div class="stat-label">
                            {t("admin.dashboard.stats.earnings_today", {
                                default: "오늘 예상 수입",
                            })}
                        </div>
                        <div class="stat-value">
                            <span class="unit">$</span>{getAdsenseMetric(
                                data.adsenseData.today,
                                0,
                            )}
                        </div>
                        <div class="stat-sub">
                            {getAdsenseMetric(data.adsenseData.today, 2)}
                            {t("admin.common.clicks", { default: "클릭" })} / {getAdsenseMetric(
                                data.adsenseData.today,
                                1,
                            )}
                            {t("admin.common.views_suffix", { default: "뷰" })}
                        </div>
                    </div>
                </div>
                <div
                    class="stat-card primary"
                    style="background: linear-gradient(135deg, #047857 0%, #064e3b 100%);"
                >
                    <div class="stat-icon"><DollarSign size={24} /></div>
                    <div class="stat-info">
                        <div class="stat-label">
                            {t("admin.dashboard.stats.earnings_month", {
                                default: "이번 달 예상 수입",
                            })}
                        </div>
                        <div class="stat-value">
                            <span class="unit">$</span>{getAdsenseMetric(
                                data.adsenseData.month,
                                0,
                            )}
                        </div>
                        <div class="stat-sub">
                            {getAdsenseMetric(data.adsenseData.month, 2)}
                            {t("admin.common.clicks", { default: "클릭" })} / {getAdsenseMetric(
                                data.adsenseData.month,
                                1,
                            )}
                            {t("admin.common.views_suffix", { default: "뷰" })}
                        </div>
                    </div>
                </div>
            </div>

            <div class="ga4-charts-grid" style="grid-template-columns: 1fr;">
                <div class="chart-card">
                    <h3 class="chart-title">
                        {t("admin.dashboard.chart.earnings_trend_30d", {
                            default: "최근 30일 예상 수입 및 클릭 트렌드",
                        })}
                    </h3>
                    <div class="chart-wrapper">
                        <canvas bind:this={adsenseChartCanvas}></canvas>
                    </div>
                </div>
            </div>
        {:else}
            <div class="empty-state">
                {t("admin.dashboard.reports.adsense_loading", {
                    default: "AdSense 데이터를 불러오는 중입니다...",
                })}
            </div>
        {/if}
    </section>

    <!-- 목록 그리드 -->
    <div class="dashboard-grid">
        <section class="dashboard-section">
            <div class="section-header">
                <h2>
                    <MessageSquare size={20} />
                    {t("admin.dashboard.recent.comments_title", {
                        default: "최근 댓글",
                    })}
                </h2>
                <span class="count-badge">{data.recentComments.length}</span>
            </div>
            <div class="list-container">
                {#if data.recentComments.length === 0}
                    <div class="empty-state">
                        {t("admin.dashboard.recent.empty_comments", {
                            default: "최근 등록된 댓글이 없습니다.",
                        })}
                    </div>
                {:else}
                    <div class="entry-list">
                        {#each data.recentComments as any[] as comment}
                            <div class="entry-item">
                                <div class="entry-meta">
                                    <span class="author"
                                        >{comment.user_name || "익명"}</span
                                    >
                                    <span class="date"
                                        >{formatDate(comment.created_at)}</span
                                    >
                                </div>
                                <div class="entry-content">
                                    {stripHtml(comment.content)}
                                </div>
                                <div class="entry-target">
                                    <BookOpen
                                        size={14}
                                        style="display: inline-block; vertical-align: middle; margin-right: 4px;"
                                    />
                                    <a
                                        href="/posts/{comment.post_id}"
                                        class="post-link"
                                        >{comment.post_title}</a
                                    >
                                </div>
                            </div>
                        {/each}
                    </div>
                    <a
                        href="/interactions?tab=comment"
                        class="btn-text"
                        style="display: block; padding: 1rem; text-align: center; border-top: 1px solid #f1f5f9;"
                        >{t("admin.dashboard.recent.view_all", {
                            default: "댓글 전체보기",
                        })}</a
                    >
                {/if}
            </div>
        </section>

        <section class="dashboard-section">
            <div class="section-header">
                <h2>
                    <UserCheck size={20} />
                    {t("admin.dashboard.recent.guestbook_title", {
                        default: "최근 방명록",
                    })}
                </h2>
                <span class="count-badge">{data.recentGuestbooks.length}</span>
            </div>
            <div class="list-container">
                {#if data.recentGuestbooks.length === 0}
                    <div class="empty-state">
                        {t("admin.dashboard.recent.empty_guestbook", {
                            default: "최근 등록된 방명록이 없습니다.",
                        })}
                    </div>
                {:else}
                    <div class="entry-list">
                        {#each data.recentGuestbooks as any[] as gb}
                            <div class="entry-item">
                                <div class="entry-meta">
                                    <span class="author"
                                        >{gb.user_name || "익명"}</span
                                    >
                                    <span class="date"
                                        >{formatDate(gb.created_at)}</span
                                    >
                                    {#if gb.is_private}
                                        <span class="private-badge"
                                            >{t(
                                                "admin.dashboard.recent.private_guestbook",
                                                { default: "비밀글" },
                                            )}</span
                                        >
                                    {/if}
                                </div>
                                <div class="entry-content">{gb.content}</div>
                            </div>
                        {/each}
                    </div>
                    <a
                        href="/interactions?tab=guestbook"
                        class="btn-text"
                        style="display: block; padding: 1rem; text-align: center; border-top: 1px solid #f1f5f9;"
                        >{t("admin.dashboard.recent.view_all", {
                            default: "방명록 전체보기",
                        })}</a
                    >
                {/if}
            </div>
        </section>

        <section class="dashboard-section">
            <div class="section-header">
                <h2>
                    <FileText size={20} />
                    {t("admin.dashboard.recent.posts_title", {
                        default: "최근 포스트",
                    })}
                </h2>
                <a href="/posts" class="btn-text"
                    >{t("admin.dashboard.recent.view_all", {
                        default: "모두 보기",
                    })}</a
                >
            </div>
            <div class="table-responsive">
                {#if data.recentPosts.length === 0}
                    <div class="empty-state">
                        {t("admin.posts.main.empty", {
                            default: "작성된 포스트가 없습니다.",
                        })}
                    </div>
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
                            {#each data.recentPosts as any[] as post}
                                <tr>
                                    <td>
                                        <a
                                            href="/posts/{post.id}"
                                            class="post-title-link"
                                            >{post.title}</a
                                        >
                                        <div class="slug">/{post.slug}</div>
                                    </td>
                                    <td class="center font-mono"
                                        >{post.view_count || 0}</td
                                    >
                                    <td class="center"
                                        ><span class="badge {post.status}"
                                            >{post.status}</span
                                        ></td
                                    >
                                    <td class="right"
                                        >{formatDate(post.created_at)}</td
                                    >
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>
        </section>
    </div>
</div>

{#if isExportModalOpen}
    <div class="modal-backdrop" onclick={() => (isExportModalOpen = false)} role="presentation">
        <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
            <div class="modal-header">
                <div class="modal-title">
                    <FileSpreadsheet size={20} class="text-blue-500" />
                    <h3>{t("admin.dashboard.export.modal_title", { default: "분석 데이터 CSV 내보내기" })}</h3>
                </div>
                <button
                    type="button"
                    class="btn-close"
                    onclick={() => (isExportModalOpen = false)}
                    aria-label={t("admin.common.close", { default: "닫기" })}
                >
                    <X size={18} />
                </button>
            </div>

            <div class="modal-body">
                <!-- 1. 기간 선택 -->
                <div class="form-group">
                    <label class="form-label">{t("admin.dashboard.export.period_label", { default: "분석 기간 선택" })}</label>
                    <div class="radio-cards">
                        <label class="radio-card" class:selected={exportPeriod === '7d'}>
                            <input type="radio" name="exportPeriod" value="7d" bind:group={exportPeriod} />
                            <div class="radio-card-content">
                                <span class="title">{t("admin.dashboard.export.period_7d", { default: "최근 7일" })}</span>
                                <span class="desc">{t("admin.dashboard.export.period_desc_dim", { default: "세부 디멘션 포함" })}</span>
                            </div>
                        </label>
                        <label class="radio-card" class:selected={exportPeriod === '28d'}>
                            <input type="radio" name="exportPeriod" value="28d" bind:group={exportPeriod} />
                            <div class="radio-card-content">
                                <span class="title">{t("admin.dashboard.export.period_28d", { default: "최근 28일" })}</span>
                                <span class="desc">{t("admin.dashboard.export.period_desc_dim", { default: "세부 디멘션 포함" })}</span>
                            </div>
                        </label>
                        <label class="radio-card" class:selected={exportPeriod === 'month'}>
                            <input type="radio" name="exportPeriod" value="month" bind:group={exportPeriod} />
                            <div class="radio-card-content">
                                <span class="title">{t("admin.dashboard.export.period_this_month", { default: "이번 달" })}</span>
                                <span class="desc">{t("admin.dashboard.export.period_month_desc", { default: "1일부터 현재까지" })}</span>
                            </div>
                        </label>
                        <label class="radio-card" class:selected={exportPeriod === '90d'}>
                            <input type="radio" name="exportPeriod" value="90d" bind:group={exportPeriod} />
                            <div class="radio-card-content">
                                <span class="title">{t("admin.dashboard.export.period_90d", { default: "최근 90일 (분기)" })}</span>
                                <span class="desc">{t("admin.dashboard.export.period_desc_dim", { default: "세부 디멘션 포함" })}</span>
                            </div>
                        </label>
                        <label class="radio-card highlight" class:selected={exportPeriod === 'year'}>
                            <input type="radio" name="exportPeriod" value="year" bind:group={exportPeriod} />
                            <div class="radio-card-content">
                                <span class="title">{t("admin.dashboard.export.period_year", { default: "1년 결산 (연간)" })}</span>
                                <span class="desc">{t("admin.dashboard.export.period_year_desc", { default: "일별 트래픽 고속 추출" })}</span>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- 2. 내보내기 모드 (1년 결산일 경우 트래픽 추이 전용 안내) -->
                {#if exportPeriod === 'year'}
                    <div class="export-notice info">
                        ℹ️ {t("admin.dashboard.export.year_fast_notice", { default: "1년 결산 리포트는 D1 데이터베이스에서 일별 트래픽 추이(방문자/페이지뷰) 데이터를 초고속으로 집계하여 다운로드합니다." })}
                    </div>
                {:else}
                    <div class="form-group">
                        <label class="form-label">{t("admin.dashboard.export.mode_label", { default: "리포트 형태" })}</label>
                        <div class="mode-selector">
                            <label class="mode-pill" class:active={exportMode === 'all'}>
                                <input type="radio" name="exportMode" value="all" bind:group={exportMode} />
                                {t("admin.dashboard.export.mode_all_title", { default: "📑 종합 분석 리포트 (추천)" })}
                            </label>
                            <label class="mode-pill" class:active={exportMode === 'custom'}>
                                <input type="radio" name="exportMode" value="custom" bind:group={exportMode} />
                                {t("admin.dashboard.export.mode_custom_title", { default: "🎯 맞춤 항목 선택" })}
                            </label>
                        </div>
                    </div>

                    {#if exportMode === 'custom'}
                        <div class="form-group">
                            <label class="form-label">{t("admin.dashboard.export.sections_label", { default: "추출할 항목 선택" })}</label>
                            <div class="checkbox-grid">
                                <label class="checkbox-label">
                                    <input type="checkbox" bind:checked={exportSections.trend} />
                                    <span>{t("admin.dashboard.export.sec_traffic", { default: "일별 트래픽 추이 (페이지뷰 / 방문자)" })}</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" bind:checked={exportSections.referrers} />
                                    <span>{t("admin.dashboard.export.sec_referrers", { default: "유입 출처 (Referrers)" })}</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" bind:checked={exportSections.countries} />
                                    <span>{t("admin.dashboard.export.sec_countries", { default: "접속 국가 (Countries)" })}</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" bind:checked={exportSections.pages} />
                                    <span>{t("admin.dashboard.export.sec_pages", { default: "인기 페이지 (Top Pages)" })}</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" bind:checked={exportSections.browsers} />
                                    <span>{t("admin.dashboard.export.sec_browsers", { default: "브라우저 (Browsers)" })}</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" bind:checked={exportSections.devices} />
                                    <span>{t("admin.dashboard.export.sec_devices", { default: "장치 및 브라우저 (Devices & Browsers)" })}</span>
                                </label>
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>

            <div class="modal-footer">
                <button
                    type="button"
                    class="btn-cancel"
                    onclick={() => (isExportModalOpen = false)}
                    disabled={isExporting}
                >
                    {t("admin.common.cancel", { default: "취소" })}
                </button>
                <button
                    type="button"
                    class="btn-confirm-download"
                    onclick={handleDownloadCsv}
                    disabled={isExporting}
                >
                    {#if isExporting}
                        <span class="spinner"></span>
                        {t("admin.dashboard.export.downloading", { default: "생성 중..." })}
                    {:else}
                        <Download size={16} />
                        {t("admin.dashboard.export.btn_download", { default: "CSV 다운로드" })}
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

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
    .stat-card.primary .stat-label,
    .stat-card.primary .stat-sub {
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
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            monospace;
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

    /* Analytics Section */
    .header-title-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .timezone-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.6rem;
        background: #f1f5f9;
        color: #475569;
        font-size: 0.75rem;
        font-weight: 600;
        border-radius: 9999px;
        border: 1px solid #e2e8f0;
    }
    .analytics-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
    .provider-toggle {
        display: inline-flex;
        background: var(--border-color, #e2e8f0);
        border-radius: 8px;
        padding: 3px;
        gap: 2px;
    }
    .provider-btn {
        border: none;
        background: transparent;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--text-muted, #64748b);
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .provider-btn.active {
        background: var(--card-bg, #ffffff);
        color: var(--primary-color, #3b82f6);
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
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

    /* CFA 종합 리포트 전용 스타일 */
    .cfa-period-bar {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        margin-bottom: 1rem;
    }
    .period-toggle-group {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        background: #f1f5f9;
        padding: 0.25rem;
        border-radius: 0.5rem;
        border: 1px solid #e2e8f0;
    }
    .period-toggle-btn {
        border: none;
        background: transparent;
        padding: 0.4rem 0.85rem;
        border-radius: 0.375rem;
        font-size: 0.8125rem;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .period-toggle-btn.active {
        background: white;
        color: #2563eb;
        font-weight: 600;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .period-date-select {
        border: 1px solid #cbd5e1;
        background: white;
        color: #334155;
        padding: 0.35rem 0.6rem;
        border-radius: 0.375rem;
        font-size: 0.8125rem;
        cursor: pointer;
        font-family: inherit;
    }
    .period-badge {
        font-size: 0.75rem;
        font-weight: 500;
        color: #64748b;
        margin-left: 0.25rem;
    }
    .cfa-details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 1.5rem;
    }
    .detail-card {
        background: var(--card-bg, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 1rem;
        padding: 1.25rem 1.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .detail-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--text-color, #1e293b);
        margin: 0 0 1rem 0;
    }
    .detail-table-wrap {
        overflow-x: auto;
    }
    .detail-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8125rem;
    }
    .detail-table th {
        background: #f8fafc;
        padding: 0.625rem 0.75rem;
        font-weight: 600;
        font-size: 0.75rem;
        color: #64748b;
        border-bottom: 1px solid #e2e8f0;
        text-align: left;
    }
    .detail-table td {
        padding: 0.625rem 0.75rem;
        border-bottom: 1px solid #f1f5f9;
        color: #334155;
    }
    .detail-table tr:last-child td {
        border-bottom: none;
    }
    .text-truncate {
        max-width: 200px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .font-semibold {
        font-weight: 600;
    }

    /* CFA 요약 그리드 */
    .cfa-summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
    }
    .summary-card {
        background: var(--card-bg, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 0.75rem;
        padding: 1rem 1.25rem;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }
    .summary-header {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }
    .summary-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .summary-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.8125rem;
    }
    .item-name {
        color: #334155;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 110px;
    }
    .item-val {
        color: #0f172a;
        font-weight: 600;
        font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .no-data-text {
        color: #94a3b8;
        font-size: 0.8125rem;
        text-align: center;
        padding: 1rem 0;
    }

    /* CFA 기간 선택 토글 바 스타일 */
    .cfa-period-bar {
        display: flex;
        justify-content: flex-end;
    }
    .period-toggle-group {
        display: inline-flex;
        background: var(--bg-hover, #f1f5f9);
        padding: 0.25rem;
        border-radius: 0.5rem;
        gap: 0.25rem;
        border: 1px solid var(--border-color, #e2e8f0);
    }
    .period-toggle-btn {
        padding: 0.25rem 0.75rem;
        font-size: 0.8125rem;
        font-weight: 500;
        border-radius: 0.375rem;
        border: none;
        background: transparent;
        color: var(--text-muted, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .period-toggle-btn.active {
        background: var(--card-bg, #ffffff);
        color: var(--primary-color, #3b82f6);
        font-weight: 600;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .period-badge {
        font-size: 0.75rem;
        font-weight: normal;
        color: #64748b;
        margin-left: 0.25rem;
    }

    /* CFA 방문 요약 카드 & 디멘션 차트 스타일 */
    .cfa-summary-cards {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }
    .cfa-summary-metric-card {
        background: var(--card-bg, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 0.75rem;
        padding: 1.25rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    :global(.dark) .cfa-summary-metric-card {
        background: #1e293b;
        border-color: #334155;
    }
    .metric-icon {
        width: 44px;
        height: 44px;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }
    .metric-icon.views {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
    }
    .metric-icon.visits {
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
    }
    .metric-info {
        display: flex;
        flex-direction: column;
    }
    .metric-label {
        font-size: 0.875rem;
        color: var(--text-muted, #64748b);
        display: flex;
        align-items: center;
        gap: 0.35rem;
    }
    .period-sub {
        font-size: 0.75rem;
        color: #3b82f6;
        font-family: monospace;
    }
    .metric-val {
        font-size: 1.625rem;
        font-weight: 700;
        color: var(--text-color, #1e293b);
        margin-top: 0.15rem;
    }
    :global(.dark) .metric-val {
        color: #f8fafc;
    }
    .cfa-dimension-card {
        padding: 1.25rem;
    }
    .cfa-dimension-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }
    .dimension-tabs {
        display: flex;
        gap: 0.35rem;
        background: var(--bg-hover, #f1f5f9);
        padding: 0.25rem;
        border-radius: 0.5rem;
        border: 1px solid var(--border-color, #e2e8f0);
    }
    :global(.dark) .dimension-tabs {
        background: #0f172a;
        border-color: #334155;
    }
    .dim-tab-btn {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.75rem;
        font-size: 0.8125rem;
        font-weight: 500;
        border: none;
        background: transparent;
        color: var(--text-muted, #64748b);
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .dim-tab-btn:hover {
        color: var(--text-color, #1e293b);
    }
    :global(.dark) .dim-tab-btn:hover {
        color: #f8fafc;
    }
    .dim-tab-btn.active {
        background: var(--card-bg, #ffffff);
        color: #3b82f6;
        font-weight: 600;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    :global(.dark) .dim-tab-btn.active {
        background: #1e293b;
        color: #60a5fa;
    }
    .dimension-chart-wrapper {
        min-height: 260px;
        height: 260px;
        position: relative;
    }
    .chart-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted, #64748b);
    }
    @media (max-width: 640px) {
        .cfa-summary-cards {
            grid-template-columns: 1fr;
        }
        .dimension-tabs {
            width: 100%;
            overflow-x: auto;
        }
    }

    /* CSV 내보내기 버튼 및 토글 래퍼 */
    .provider-toggle-wrap {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .btn-export-csv {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.4rem 0.75rem;
        font-size: 0.8125rem;
        font-weight: 500;
        color: #2563eb;
        background: rgba(37, 99, 235, 0.08);
        border: 1px solid rgba(37, 99, 235, 0.2);
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .btn-export-csv:hover {
        background: rgba(37, 99, 235, 0.15);
        border-color: #2563eb;
    }
    :global(.dark) .btn-export-csv {
        color: #60a5fa;
        background: rgba(96, 165, 250, 0.12);
        border-color: rgba(96, 165, 250, 0.25);
    }
    :global(.dark) .btn-export-csv:hover {
        background: rgba(96, 165, 250, 0.22);
        border-color: #60a5fa;
    }

    /* CSV 모달 팝업 */
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }
    .modal-card {
        background: var(--card-bg, #ffffff);
        color: var(--text-color, #1e293b);
        border-radius: 0.875rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 580px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--border-color, #e2e8f0);
        animation: modalFadeIn 0.18s ease-out;
    }
    :global(.dark) .modal-card {
        background: #1e293b;
        color: #f1f5f9;
        border-color: #334155;
    }
    @keyframes modalFadeIn {
        from {
            opacity: 0;
            transform: scale(0.96) translateY(4px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }
    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
    }
    :global(.dark) .modal-header {
        border-color: #334155;
    }
    .modal-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .modal-title h3 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
    }
    .btn-close {
        background: transparent;
        border: none;
        color: var(--text-muted, #64748b);
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 0.375rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .btn-close:hover {
        color: var(--text-color, #1e293b);
        background: rgba(0, 0, 0, 0.05);
    }
    :global(.dark) .btn-close:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
    }
    .modal-body {
        padding: 1.5rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }
    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .form-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-color, #334155);
    }
    :global(.dark) .form-label {
        color: #cbd5e1;
    }
    .radio-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.5rem;
    }
    .radio-card {
        position: relative;
        display: flex;
        align-items: flex-start;
        padding: 0.65rem 0.75rem;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 0.5rem;
        background: var(--bg-surface, #f8fafc);
        cursor: pointer;
        transition: all 0.15s ease;
    }
    :global(.dark) .radio-card {
        border-color: #334155;
        background: #0f172a;
    }
    .radio-card input {
        position: absolute;
        opacity: 0;
    }
    .radio-card-content {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }
    .radio-card-content .title {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-color, #1e293b);
    }
    :global(.dark) .radio-card-content .title {
        color: #f1f5f9;
    }
    .radio-card-content .desc {
        font-size: 0.7rem;
        color: var(--text-muted, #64748b);
    }
    .radio-card.selected {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.06);
    }
    :global(.dark) .radio-card.selected {
        border-color: #60a5fa;
        background: rgba(96, 165, 250, 0.1);
    }
    .radio-card.highlight.selected {
        border-color: #8b5cf6;
        background: rgba(139, 92, 246, 0.08);
    }
    :global(.dark) .radio-card.highlight.selected {
        border-color: #a78bfa;
        background: rgba(167, 139, 250, 0.12);
    }
    .export-notice {
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.8125rem;
        line-height: 1.45;
        background: #eff6ff;
        color: #1e40af;
        border: 1px solid #bfdbfe;
    }
    :global(.dark) .export-notice {
        background: rgba(59, 130, 246, 0.12);
        color: #93c5fd;
        border-color: rgba(59, 130, 246, 0.25);
    }
    .mode-selector {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .mode-pill {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    :global(.dark) .mode-pill {
        border-color: #334155;
    }
    .mode-pill.active {
        background: rgba(59, 130, 246, 0.08);
        border-color: #3b82f6;
        font-weight: 500;
    }
    :global(.dark) .mode-pill.active {
        background: rgba(96, 165, 250, 0.12);
        border-color: #60a5fa;
    }
    .checkbox-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
        padding: 0.5rem 0.25rem;
    }
    @media (max-width: 480px) {
        .checkbox-grid {
            grid-template-columns: 1fr;
        }
    }
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
        cursor: pointer;
    }
    .modal-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color, #e2e8f0);
    }
    :global(.dark) .modal-footer {
        border-color: #334155;
    }
    .btn-cancel {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        background: transparent;
        border: 1px solid var(--border-color, #cbd5e1);
        border-radius: 0.375rem;
        color: var(--text-color, #475569);
        cursor: pointer;
    }
    :global(.dark) .btn-cancel {
        border-color: #475569;
        color: #cbd5e1;
    }
    .btn-cancel:hover {
        background: rgba(0, 0, 0, 0.04);
    }
    :global(.dark) .btn-cancel:hover {
        background: rgba(255, 255, 255, 0.05);
    }
    .btn-confirm-download {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 1.125rem;
        font-size: 0.875rem;
        font-weight: 600;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: background 0.15s ease;
    }
    .btn-confirm-download:hover:not(:disabled) {
        background: #1d4ed8;
    }
    .btn-confirm-download:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
