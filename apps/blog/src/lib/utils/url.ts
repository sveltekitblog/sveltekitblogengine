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

export function buildLocalizedUrl(path: string, langPrefix = '', tenantPrefix = ''): string {
    if (!path || path === '#') return path;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('mailto:')) return path;
    
    const cleanPath = path === '/' ? '' : (path.startsWith('/') ? path : `/${path}`);
    const tPrefix = tenantPrefix ? (tenantPrefix.startsWith('/') ? tenantPrefix : `/${tenantPrefix}`) : '';
    const lPrefix = langPrefix ? (langPrefix.startsWith('/') ? langPrefix : `/${langPrefix}`) : '';
    
    const combined = `${tPrefix}${lPrefix}${cleanPath}`;
    return combined || '/';
}
