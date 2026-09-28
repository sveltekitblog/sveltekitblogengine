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

/**
 * Cloudflare Web Analytics (RUM) GraphQL API integration for Cloudflare Workers/Pages
 * Queries rumPageloadEventsAdaptiveGroups via standard fetch.
 */

export interface CFAnalyticsConfig {
    accountId: string;
    apiToken: string;
    siteTag: string;
}

export interface CFTrafficRow {
    date: string;       // 'YYYY-MM-DD'
    pageViews: number;  // count
    visitors: number;   // sum.visits
}

export interface CFSourceRow {
    source: string;     // refererHost
    visits: number;     // count
}

export interface CFDetailItem {
    name: string;
    views: number;
    visitors: number;
}

export interface CFAnalyticsReportResult {
    trafficRows: CFTrafficRow[];
    sourceRows: CFSourceRow[];
    pages: CFDetailItem[];        // 인기 페이지 (requestPath)
    referrers: CFDetailItem[];    // 유입 경로 (refererHost)
    countries: CFDetailItem[];    // 국가 (countryName)
    devices: CFDetailItem[];      // 기기 (deviceType)
    browsers: CFDetailItem[];     // 브라우저 (userAgentBrowser)
    os: CFDetailItem[];           // 운영체제 (userAgentOS)
}

export const RUM_QUERY = `
query GetRumAnalytics($accountTag: String!, $siteTag: String!, $from: Time!, $to: Time!) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      traffic: rumPageloadEventsAdaptiveGroups(
        filter: {
          siteTag: $siteTag,
          datetime_geq: $from,
          datetime_leq: $to
        },
        limit: 100
      ) {
        count
        sum {
          visits
        }
        dimensions {
          date
        }
      }
      pages: rumPageloadEventsAdaptiveGroups(
        filter: {
          siteTag: $siteTag,
          datetime_geq: $from,
          datetime_leq: $to
        },
        limit: 10,
        orderBy: [count_DESC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          requestPath
        }
      }
      referrers: rumPageloadEventsAdaptiveGroups(
        filter: {
          siteTag: $siteTag,
          datetime_geq: $from,
          datetime_leq: $to
        },
        limit: 10,
        orderBy: [count_DESC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          refererHost
        }
      }
      countries: rumPageloadEventsAdaptiveGroups(
        filter: {
          siteTag: $siteTag,
          datetime_geq: $from,
          datetime_leq: $to
        },
        limit: 10,
        orderBy: [count_DESC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          countryName
        }
      }
      devices: rumPageloadEventsAdaptiveGroups(
        filter: {
          siteTag: $siteTag,
          datetime_geq: $from,
          datetime_leq: $to
        },
        limit: 5,
        orderBy: [count_DESC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          deviceType
        }
      }
      environments: rumPageloadEventsAdaptiveGroups(
        filter: {
          siteTag: $siteTag,
          datetime_geq: $from,
          datetime_leq: $to
        },
        limit: 10,
        orderBy: [count_DESC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          userAgentBrowser
          userAgentOS
        }
      }
    }
  }
}
`;

/**
 * Cloudflare GraphQL Analytics API를 호출하여 지정된 기간의 RUM 트래픽 및 유입 데이터를 가져옵니다.
 *
 * @param config Cloudflare 계정 및 Web Analytics 토큰 정보
 * @param startDate 조회 시작일 ('YYYY-MM-DD')
 * @param endDate 조회 종료일 ('YYYY-MM-DD')
 */
export async function runCfAnalyticsReport(
    config: CFAnalyticsConfig,
    startDate: string,
    endDate: string
): Promise<CFAnalyticsReportResult> {
    if (!config.accountId || !config.apiToken || !config.siteTag) {
        throw new Error('CF Analytics 설정이 완전하지 않습니다 (accountId, apiToken, siteTag 필요)');
    }

    const from = `${startDate}T00:00:00Z`;
    const to = `${endDate}T23:59:59Z`;

    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiToken}`
        },
        body: JSON.stringify({
            query: RUM_QUERY,
            variables: {
                accountTag: config.accountId,
                siteTag: config.siteTag,
                from,
                to
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare Analytics API 호출 실패: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = (await response.json()) as any;

    if (result.errors && result.errors.length > 0) {
        const errMsg = result.errors.map((e: any) => e.message).join(', ');
        throw new Error(`Cloudflare Analytics GraphQL 오류: ${errMsg}`);
    }

    const accountData = result?.data?.viewer?.accounts?.[0];
    const rawTraffic = accountData?.traffic || [];
    const rawReferrers = accountData?.referrers || [];
    const rawPages = accountData?.pages || [];
    const rawCountries = accountData?.countries || [];
    const rawDevices = accountData?.devices || [];
    const rawEnvironments = accountData?.environments || [];

    const trafficRows: CFTrafficRow[] = rawTraffic
        .map((row: any) => {
            const rawDate = String(row.dimensions?.date || '');
            const date = rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
            return {
                date,
                pageViews: parseInt(row.count, 10) || 0,
                visitors: parseInt(row.sum?.visits, 10) || 0
            };
        })
        // API orderBy 미지원으로 인해 TypeScript 단에서 날짜 오름차순 정렬
        .sort((a, b) => a.date.localeCompare(b.date));

    // 기존 하위 호환용 sourceRows
    const sourceRows: CFSourceRow[] = rawReferrers
        .map((row: any) => {
            const rawHost = String(row.dimensions?.refererHost || '').trim();
            const source = rawHost.length > 0 ? rawHost : 'Direct / None';
            const visits = row.sum?.visits !== undefined && row.sum?.visits !== null
                ? parseInt(row.sum.visits, 10)
                : parseInt(row.count, 10) || 0;
            return { source, visits };
        })
        .filter((row: CFSourceRow) => row.visits > 0)
        .sort((a, b) => b.visits - a.visits);

    // 상세 분석 1) 인기 페이지 경로 (Top Pages)
    const pages: CFDetailItem[] = rawPages
        .map((row: any) => ({
            name: String(row.dimensions?.requestPath || '/'),
            views: parseInt(row.count, 10) || 0,
            visitors: parseInt(row.sum?.visits, 10) || 0
        }))
        .filter((item: CFDetailItem) => item.views > 0);

    // 상세 분석 2) 유입 참조자 (Top Referrers)
    const referrers: CFDetailItem[] = rawReferrers
        .map((row: any) => {
            const rawHost = String(row.dimensions?.refererHost || '').trim();
            return {
                name: rawHost.length > 0 ? rawHost : 'Direct / None',
                views: parseInt(row.count, 10) || 0,
                visitors: parseInt(row.sum?.visits, 10) || (parseInt(row.count, 10) > 0 ? 1 : 0)
            };
        })
        .filter((item: CFDetailItem) => item.views > 0);

    // 상세 분석 3) 국가별 (Countries)
    const countries: CFDetailItem[] = rawCountries
        .map((row: any) => ({
            name: String(row.dimensions?.countryName || 'Unknown'),
            views: parseInt(row.count, 10) || 0,
            visitors: parseInt(row.sum?.visits, 10) || (parseInt(row.count, 10) > 0 ? 1 : 0)
        }))
        .filter((item: CFDetailItem) => item.views > 0);

    // 상세 분석 4) 장치 유형 (Devices)
    const devices: CFDetailItem[] = rawDevices
        .map((row: any) => ({
            name: String(row.dimensions?.deviceType || 'Unknown'),
            views: parseInt(row.count, 10) || 0,
            visitors: parseInt(row.sum?.visits, 10) || (parseInt(row.count, 10) > 0 ? 1 : 0)
        }))
        .filter((item: CFDetailItem) => item.views > 0);

    // 상세 분석 5 & 6) 브라우저 및 운영체제 분리 집계
    const browserMap = new Map<string, { views: number; visitors: number }>();
    const osMap = new Map<string, { views: number; visitors: number }>();

    for (const row of rawEnvironments) {
        const bName = String(row.dimensions?.userAgentBrowser || 'Unknown');
        const osName = String(row.dimensions?.userAgentOS || 'Unknown');
        const v = parseInt(row.count, 10) || 0;
        const vis = parseInt(row.sum?.visits, 10) || 0;

        const curB = browserMap.get(bName) || { views: 0, visitors: 0 };
        browserMap.set(bName, { views: curB.views + v, visitors: curB.visitors + vis });

        const curOs = osMap.get(osName) || { views: 0, visitors: 0 };
        osMap.set(osName, { views: curOs.views + v, visitors: curOs.visitors + vis });
    }

    const browsers: CFDetailItem[] = Array.from(browserMap.entries())
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a, b) => b.views - a.views);

    const os: CFDetailItem[] = Array.from(osMap.entries())
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a, b) => b.views - a.views);

    return {
        trafficRows,
        sourceRows,
        pages,
        referrers,
        countries,
        devices,
        browsers,
        os
    };
}
