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

export { formatDate, sanitizeHtml } from '@blog/shared/utils';

export function localizePath(path: string, lang?: string | null): string {
    if (!lang) return path;
    return path.startsWith('/') ? `/${lang}${path === '/' ? '' : path}` : `/${lang}/${path}`;
}

export function parseWidgetConfig(rawConfig: any): any {
    if (!rawConfig) return {};
    if (typeof rawConfig === 'string' && rawConfig.trim() !== '') {
        try {
            return JSON.parse(rawConfig);
        } catch {
            return {};
        }
    }
    return rawConfig;
}

export function extractDeviceConfig(
    parsed: any,
    device: 'desktop' | 'mobile',
    defaults: Record<string, any> = {}
): any {
    if (parsed.desktop || parsed.mobile) {
        return {
            ...defaults,
            ...(parsed[device] || parsed.desktop || {})
        };
    }
    return { ...defaults, ...parsed };
}
