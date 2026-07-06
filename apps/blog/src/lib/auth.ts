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

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { userDb } from "@blog/shared/db";
import { admin } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { env } from "$env/dynamic/private";
import { getRequestEvent } from "$app/server";

// 프로바이더 코드 → 환경변수 키 매핑
const PROVIDER_ENV_MAP: Record<string, [string, string]> = {
    google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    github: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
    apple: ['APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET'],
    discord: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
    facebook: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET'],
    twitter: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
    kakao: ['KAKAO_CLIENT_ID', 'KAKAO_CLIENT_SECRET'],
    naver: ['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET'],
    line: ['LINE_CLIENT_ID', 'LINE_CLIENT_SECRET'],
    linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    microsoft: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
    spotify: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'],
    twitch: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'],
    reddit: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
    tiktok: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'],
    gitlab: ['GITLAB_CLIENT_ID', 'GITLAB_CLIENT_SECRET'],
    slack: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'],
    figma: ['FIGMA_CLIENT_ID', 'FIGMA_CLIENT_SECRET'],
    huggingface: ['HUGGINGFACE_CLIENT_ID', 'HUGGINGFACE_CLIENT_SECRET'],
    notion: ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET'],
    zoom: ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
};

export const getAuth = (db: ReturnType<typeof userDb>, enabledProviders: string[] = [], enableEmailLogin: boolean = true, requestOrigin?: string) => {
    const socialProviders: Record<string, any> = {};
    const trustedList: string[] = [];

    for (const code of enabledProviders) {
        const keys = PROVIDER_ENV_MAP[code];
        if (!keys) continue;
        const [idKey, secretKey] = keys;
        const clientId = (env as any)[idKey];
        const clientSecret = (env as any)[secretKey];
        if (clientId && clientSecret) {
            socialProviders[code] = { clientId, clientSecret };
            trustedList.push(code);
        }
    }

    const useEmailPassword = enableEmailLogin;
    const hasSocialProviders = Object.keys(socialProviders).length > 0;

        const resolvedBaseURL = requestOrigin || env.BETTER_AUTH_URL || "http://localhost:5173";

    return betterAuth({
        secret: env.BETTER_AUTH_SECRET,
        baseURL: resolvedBaseURL,
        trustedOrigins: [resolvedBaseURL, env.BETTER_AUTH_URL].filter(Boolean) as string[],
        database: drizzleAdapter(db, { provider: 'sqlite' }),
        user: {
            additionalFields: {
                banned: { type: "boolean" },
                ban_reason: { type: "string" },
                ban_expires: { type: "number" },
                show_ban_reason: { type: "boolean" },
            }
        },
        emailAndPassword: {
            enabled: useEmailPassword,
            password: {
                hash: async (password: string) => {
                    const enc = new TextEncoder();
                    const salt = crypto.getRandomValues(new Uint8Array(16));
                    const keyMaterial = await crypto.subtle.importKey(
                        "raw",
                        enc.encode(password),
                        { name: "PBKDF2" },
                        false,
                        ["deriveBits"]
                    );
                    const hashBuffer = await crypto.subtle.deriveBits(
                        {
                            name: "PBKDF2",
                            salt: salt,
                            iterations: 10000,
                            hash: "SHA-256",
                        },
                        keyMaterial,
                        256
                    );
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    // Base64 encode for storage
                    const hashBase64 = btoa(String.fromCharCode(...hashArray));
                    const saltBase64 = btoa(String.fromCharCode(...salt));
                    return `pbkdf2:10000:${saltBase64}:${hashBase64}`;
                },
                verify: async ({ hash, password }) => {
                    if (!hash.startsWith("pbkdf2:")) {
                        // If it's an old scrypt/bcrypt hash, we can't verify it within Cloudflare's CPU limits easily.
                        // For a real production app we'd fallback to a slow verify here or force reset.
                        console.warn("Encountered non-pbkdf2 hash. Verification will fail.");
                        return false;
                    }
                    const parts = hash.split(":");
                    const iterations = parseInt(parts[1], 10);
                    const saltBase64 = parts[2];
                    const hashBase64 = parts[3];

                    const saltString = atob(saltBase64);
                    const salt = new Uint8Array(saltString.length);
                    for (let i = 0; i < saltString.length; i++) {
                        salt[i] = saltString.charCodeAt(i);
                    }

                    const enc = new TextEncoder();
                    const keyMaterial = await crypto.subtle.importKey(
                        "raw",
                        enc.encode(password),
                        { name: "PBKDF2" },
                        false,
                        ["deriveBits"]
                    );
                    const hashBuffer = await crypto.subtle.deriveBits(
                        {
                            name: "PBKDF2",
                            salt: salt,
                            iterations: iterations,
                            hash: "SHA-256",
                        },
                        keyMaterial,
                        256
                    );
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const verifyHashBase64 = btoa(String.fromCharCode(...hashArray));
                    
                    return hashBase64 === verifyHashBase64;
                }
            }
        },
        account: {
            accountLinking: {
                enabled: true,
                trustedProviders: useEmailPassword
                    ? ["email-password"]
                    : trustedList
            }
        },
        ...(hasSocialProviders ? { socialProviders } : {}),
        plugins: [
            admin({ defaultRole: "user" }),
            sveltekitCookies(getRequestEvent),
        ],
    });
};
