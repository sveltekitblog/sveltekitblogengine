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

export const SOCIAL_PROVIDER_META: Record<string, {
    label: string;
    color: string;
    textColor: string;
    border: string;
    envKeys: [string, string]; // [CLIENT_ID_KEY, CLIENT_SECRET_KEY]
}> = {
    google:      { label: 'Google',      color: '#ffffff', textColor: '#444',    border: '#dadce0', envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
    github:      { label: 'GitHub',      color: '#24292e', textColor: '#fff',    border: 'none',    envKeys: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'] },
    apple:       { label: 'Apple',       color: '#000000', textColor: '#fff',    border: 'none',    envKeys: ['APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET'] },
    discord:     { label: 'Discord',     color: '#5865F2', textColor: '#fff',    border: 'none',    envKeys: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'] },
    facebook:    { label: 'Facebook',    color: '#1877F2', textColor: '#fff',    border: 'none',    envKeys: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET'] },
    twitter:     { label: 'X (Twitter)', color: '#000000', textColor: '#fff',    border: 'none',    envKeys: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'] },
    kakao:       { label: 'Kakao',       color: '#FEE500', textColor: '#3c1e1e', border: 'none',    envKeys: ['KAKAO_CLIENT_ID', 'KAKAO_CLIENT_SECRET'] },
    naver:       { label: 'Naver',       color: '#03CF5D', textColor: '#fff',    border: 'none',    envKeys: ['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET'] },
    line:        { label: 'LINE',        color: '#06C755', textColor: '#fff',    border: 'none',    envKeys: ['LINE_CLIENT_ID', 'LINE_CLIENT_SECRET'] },
    linkedin:    { label: 'LinkedIn',    color: '#0A66C2', textColor: '#fff',    border: 'none',    envKeys: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'] },
    microsoft:   { label: 'Microsoft',   color: '#2F2F2F', textColor: '#fff',    border: 'none',    envKeys: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'] },
    spotify:     { label: 'Spotify',     color: '#1DB954', textColor: '#fff',    border: 'none',    envKeys: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'] },
    twitch:      { label: 'Twitch',      color: '#9146FF', textColor: '#fff',    border: 'none',    envKeys: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'] },
    reddit:      { label: 'Reddit',      color: '#FF4500', textColor: '#fff',    border: 'none',    envKeys: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'] },
    tiktok:      { label: 'TikTok',      color: '#000000', textColor: '#fff',    border: 'none',    envKeys: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'] },
    gitlab:      { label: 'GitLab',      color: '#FC6D26', textColor: '#fff',    border: 'none',    envKeys: ['GITLAB_CLIENT_ID', 'GITLAB_CLIENT_SECRET'] },
    slack:       { label: 'Slack',       color: '#4A154B', textColor: '#fff',    border: 'none',    envKeys: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'] },
    figma:       { label: 'Figma',       color: '#F24E1E', textColor: '#fff',    border: 'none',    envKeys: ['FIGMA_CLIENT_ID', 'FIGMA_CLIENT_SECRET'] },
    huggingface: { label: 'Hugging Face',color: '#FFD21E', textColor: '#000',    border: 'none',    envKeys: ['HUGGINGFACE_CLIENT_ID', 'HUGGINGFACE_CLIENT_SECRET'] },
    notion:      { label: 'Notion',      color: '#000000', textColor: '#fff',    border: 'none',    envKeys: ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET'] },
    zoom:        { label: 'Zoom',        color: '#0B5CFF', textColor: '#fff',    border: 'none',    envKeys: ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'] },
};

export const PRIMARY_PROVIDERS = ['google','github','apple','discord','facebook','twitter','kakao','naver','line','linkedin'] as const;
export const EXTRA_PROVIDERS = ['microsoft','spotify','twitch','reddit','tiktok','gitlab','slack','figma','huggingface','notion','zoom'] as const;
export type SocialProviderId = keyof typeof SOCIAL_PROVIDER_META;
