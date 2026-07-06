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
 * Formats a date string or Date object to 'YYYY-MM-DD AM/PM H:MM:SS'
 * Example: 2026-02-04T05:57:41.778Z -> 2026-02-04 AM9:20:12
 * @param dateInput ISO date string, Date object, or null/undefined
 * @returns Formatted date string
 */
export function formatDate(
    dateInput: string | Date | null | undefined, 
    timezone?: string, 
    includeTime = true
): string {
    if (!dateInput) return '';

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    const targetTimezone = timezone || 'UTC';

    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: targetTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZoneName: 'short'
        });

        const parts = formatter.formatToParts(date);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

        const year = getPart('year');
        const month = getPart('month');
        const day = getPart('day');

        if (!includeTime) {
            return `${year}-${month}-${day}`;
        }

        let hour = getPart('hour');
        const minute = getPart('minute');
        const second = getPart('second');
        const dayPeriod = getPart('dayPeriod'); // "AM" or "PM"
        let tzName = getPart('timeZoneName'); // "KST", "EST" 등

        let numHour = parseInt(hour, 10);
        
        return `${year}-${month}-${day} ${dayPeriod}${numHour}:${minute}:${second} (${tzName})`;
    } catch (e) {
        console.error('Failed to format date with timezone:', timezone, e);
        // Fallback to local default
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        if (!includeTime) return `${year}-${month}-${day}`;
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${year}-${month}-${day} ${ampm}${hours}:${minutes}:${seconds}`;
    }
}

/**
 * Simple HTML sanitizer to strip all tags
 */
export function sanitizeHtml(str: string): string {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '').trim();
}
