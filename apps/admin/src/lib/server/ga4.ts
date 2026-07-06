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
 * Google Analytics 4 (GA4) API integration for Cloudflare Workers/Pages
 * Uses Web Crypto API to sign JWTs directly without Node.js dependencies.
 */

// Helper: Base64Url encode
function base64urlEncode(source: Uint8Array | string): string {
    let uint8Array: Uint8Array;
    if (typeof source === 'string') {
        uint8Array = new TextEncoder().encode(source);
    } else {
        uint8Array = source;
    }

    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binaryString);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper: Import RSA Private Key for Web Crypto
async function importPrivateKey(pem: string): Promise<CryptoKey> {
    // Remove header, footer, and newlines
    const pemContents = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\\n/g, '')
        .replace(/\s+/g, '');

    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);

    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    return await crypto.subtle.importKey(
        'pkcs8',
        binaryDer.buffer,
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256'
        },
        false,
        ['sign']
    );
}

// Generate JWT for Google API authentication
async function createGoogleJwt(clientEmail: string, privateKeyPem: string): Promise<string> {
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/analytics.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600, // 1 hour expiration
        iat: now
    };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedClaim = base64urlEncode(JSON.stringify(claim));
    const signatureInput = `${encodedHeader}.${encodedClaim}`;

    const privateKey = await importPrivateKey(privateKeyPem);

    const signatureBytes = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        new TextEncoder().encode(signatureInput)
    );

    const encodedSignature = base64urlEncode(new Uint8Array(signatureBytes));
    return `${signatureInput}.${encodedSignature}`;
}

// Exchange JWT for Bearer access token
async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
    const jwt = await createGoogleJwt(clientEmail, privateKeyPem);

    const init: RequestInit = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    };

    const response = await fetch('https://oauth2.googleapis.com/token', init);
    const data = (await response.json()) as any;

    if (!response.ok) {
        throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
    }

    return data.access_token;
}

export interface GA4Config {
    propertyId: string;
    clientEmail: string;
    privateKey: string;
}

/**
 * GA4용 Access Token을 발급합니다.
 * 여러 리포트를 호출할 때는 이 함수로 토큰을 1번만 발급한 뒤 runGa4Report에 전달하세요.
 */
export async function getGa4AccessToken(config: GA4Config): Promise<string> {
    return getAccessToken(config.clientEmail, config.privateKey);
}

/**
 * Run a GA4 report via the Data API
 */
export async function runGa4Report(config: GA4Config, requestBody: any, accessToken?: string): Promise<any> {
    const token = accessToken ?? await getAccessToken(config.clientEmail, config.privateKey);

    const response = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GA4 runReport failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
}

/**
 * 여러 GA4 리포트를 단일 HTTP 요청으로 처리합니다 (batchRunReports).
 * 응답은 { reports: [ report1, report2, ... ] } 형태입니다.
 */
export async function runGa4BatchReport(config: GA4Config, requests: any[], accessToken?: string): Promise<any> {
    const token = accessToken ?? await getAccessToken(config.clientEmail, config.privateKey);

    const response = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:batchRunReports`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GA4 batchRunReports failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json(); // { reports: [...] }
}
