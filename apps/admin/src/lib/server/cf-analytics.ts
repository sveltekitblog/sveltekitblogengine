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

export interface CFAnalyticsReportResult {
    trafficRows: CFTrafficRow[];
    sourceRows: CFSourceRow[];
}

const RUM_QUERY = `
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
      referrers: rumPageloadEventsAdaptiveGroups(
        filter: {
          siteTag: $siteTag,
          datetime_geq: $from,
          datetime_leq: $to
        },
        limit: 20,
        orderBy: [count_DESC]
      ) {
        count
        dimensions {
          refererHost
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

    const sourceRows: CFSourceRow[] = rawReferrers
        // API 단 빈 문자열 필터링 미지원으로 TypeScript 단에서 처리
        .filter((row: any) => !!row.dimensions?.refererHost)
        .map((row: any) => ({
            source: String(row.dimensions.refererHost),
            visits: parseInt(row.count, 10) || 0
        }));

    return {
        trafficRows,
        sourceRows
    };
}
