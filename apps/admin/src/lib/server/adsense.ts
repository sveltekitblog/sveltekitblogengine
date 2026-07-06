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

/**
 * Google AdSense API (v2) integration for Cloudflare Workers/Pages
 * Uses OAuth2 Refresh Token flow because AdSense Management API does not support Service Accounts.
 */

// Exchange Refresh Token for Bearer access token
async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    const init: RequestInit = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken
        })
    };

    const response = await fetch('https://oauth2.googleapis.com/token', init);
    const data = (await response.json()) as any;

    if (!response.ok) {
        throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
    }

    return data.access_token;
}

export interface AdSenseConfig {
    accountId: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
}

/**
 * AdSense용 Access Token을 발급합니다.
 * 여러 리포트를 호출할 때는 이 함수로 토큰을 1번만 발급한 뒤 runAdsenseReport에 전달하세요.
 */
export async function getAdsenseAccessToken(config: AdSenseConfig): Promise<string> {
    return getAccessToken(config.clientId, config.clientSecret, config.refreshToken);
}

/**
 * Run a AdSense report via the Data API
 */
export async function runAdsenseReport(config: AdSenseConfig, queryParams: URLSearchParams, accessToken?: string): Promise<any> {
    const token = accessToken ?? await getAccessToken(config.clientId, config.clientSecret, config.refreshToken);

    let accountPath = config.accountId;
    if (!accountPath.startsWith('accounts/')) {
        accountPath = `accounts/${accountPath}`;
    }

    const response = await fetch(
        `https://adsense.googleapis.com/v2/${accountPath}/reports:generate?${queryParams.toString()}`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AdSense Report failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
}
