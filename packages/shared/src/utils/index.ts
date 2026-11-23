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
 * Formats a date string or Date object to 'YYYY-MM-DD AM/PM H:MM:SS'
 * Example: 2026-02-04T05:57:41.778Z -> 2026-02-04 AM9:20:12
 * @param dateInput ISO date string, Date object, or null/undefined
 * @returns Formatted date string
 */
export function formatDate(dateInput: string | Date | null | undefined, timezone?: string): string {
    if (!dateInput) return '';

    let normalizedInput: string | Date = dateInput;
    if (typeof dateInput === 'string') {
        const trimmed = dateInput.trim();
        if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
            normalizedInput = `${trimmed.replace(' ', 'T')}+09:00`;
        }
    }

    const date = new Date(normalizedInput);
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
        let hour = getPart('hour');
        const minute = getPart('minute');
        const second = getPart('second');
        const dayPeriod = getPart('dayPeriod'); // "AM" or "PM"
        let tzName = getPart('timeZoneName'); // "KST", "EST", "UTC" 등

        let numHour = parseInt(hour, 10);
        
        return `${year}-${month}-${day} ${dayPeriod}${numHour}:${minute}:${second} (${tzName})`;
    } catch (e) {
        console.error('Failed to format date with timezone:', timezone, e);
        // Fallback to local default (original behavior)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
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

/**
 * Safely parse tags from JSON string or comma-separated string
 */
export function safeParseTags(tags: any): string[] {
    if (!tags) return [];
    try {
        const parsed = typeof tags === 'string' ? JSON.parse(tags) : tags;
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        if (typeof tags === 'string') {
            return tags.split(',').map(t => t.trim()).filter(Boolean);
        }
        return [];
    }
}

export * from './cloudflare';
export * from './jsValidator';

const EXT_CONTENT_TYPE: Record<string, string> = {
    webp: 'image/webp',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
};

export function inferContentType(path: string, storedType?: string | null): string {
    if (storedType && storedType !== 'application/octet-stream') return storedType;
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    return EXT_CONTENT_TYPE[ext] ?? 'application/octet-stream';
}

export function getContrastTextColor(bg: string): string {
    const c = (bg || '').trim();
    let r = 0, g = 0, b = 0, parsed = false;
    if (/^#[0-9a-f]{3}$/i.test(c)) {
        r = parseInt(c[1] + c[1], 16); g = parseInt(c[2] + c[2], 16); b = parseInt(c[3] + c[3], 16); parsed = true;
    } else if (/^#[0-9a-f]{6}$/i.test(c)) {
        r = parseInt(c.slice(1, 3), 16); g = parseInt(c.slice(3, 5), 16); b = parseInt(c.slice(5, 7), 16); parsed = true;
    } else {
        const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (m) { r = +m[1]; g = +m[2]; b = +m[3]; parsed = true; }
    }
    if (!parsed) return '#ffffff';
    return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? '#0f172a' : '#ffffff';
}

function getTimezoneOffsetMsForDate(timeZone: string, utcMs: number): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(new Date(utcMs));

    const getNum = (type: string) => Number(parts.find(p => p.type === type)?.value || '0');
    const hour = getNum('hour') === 24 ? 0 : getNum('hour');
    const zonedAsUtcMs = Date.UTC(
        getNum('year'),
        getNum('month') - 1,
        getNum('day'),
        hour,
        getNum('minute'),
        getNum('second')
    );
    return zonedAsUtcMs - utcMs;
}

/**
 * UTC ISO 문자열(또는 Date)을 특정 IANA 타임존 기준 datetime-local 입력값('YYYY-MM-DDTHH:MM')으로 변환
 */
export function utcIsoToZonedLocalInput(
    dateInput: string | Date | null | undefined,
    timeZone: string = 'Asia/Seoul'
): string {
    if (!dateInput) return '';
    let normalized: string | Date = dateInput;
    if (typeof dateInput === 'string') {
        const trimmed = dateInput.trim();
        if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
            normalized = `${trimmed.replace(' ', 'T')}+09:00`;
        }
    }
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return '';

    const formatWithTz = (tz: string) => {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(date);
        const get = (type: string) => parts.find(p => p.type === type)?.value || '';
        const hour = get('hour') === '24' ? '00' : get('hour');
        return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
    };

    try {
        return formatWithTz(timeZone || 'UTC');
    } catch {
        return formatWithTz('UTC');
    }
}

/**
 * 특정 IANA 타임존 기준 datetime-local 입력값('YYYY-MM-DDTHH:MM')을 UTC ISO 문자열로 변환
 */
export function zonedLocalInputToUtcIso(
    localDateTime: string | null | undefined,
    timeZone: string = 'Asia/Seoul'
): string | null {
    if (!localDateTime || typeof localDateTime !== 'string') return null;
    const match = localDateTime.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;

    const [, yStr, mStr, dStr, hhStr, mmStr, ssStr] = match;
    const guessUtcMs = Date.UTC(
        Number(yStr),
        Number(mStr) - 1,
        Number(dStr),
        Number(hhStr),
        Number(mmStr),
        Number(ssStr || '0')
    );
    if (isNaN(guessUtcMs)) return null;

    try {
        const tz = timeZone || 'UTC';
        const offset1 = getTimezoneOffsetMsForDate(tz, guessUtcMs);
        const candidateMs = guessUtcMs - offset1;
        const offset2 = getTimezoneOffsetMsForDate(tz, candidateMs);
        return new Date(guessUtcMs - offset2).toISOString();
    } catch {
        return new Date(guessUtcMs).toISOString();
    }
}

/**
 * Synchronizes post_count in the categories table based on actual published posts.
 * Runs atomically in a single statement using idx_posts_cat_lang_status.
 */
export async function syncCategoryPostCounts(db: any): Promise<void> {
    try {
        await db.prepare(`
            UPDATE categories
            SET post_count = (
                SELECT COUNT(*)
                FROM posts
                WHERE posts.category_slug = categories.slug
                  AND posts.lang = categories.lang
                  AND posts.status = 'published'
                  AND posts.type = 'post'
            )
        `).run();
    } catch (err) {
        console.warn('[CategorySync] Failed to sync category post counts:', err);
    }
}

/**
 * Synchronizes blog_settings.next_scheduled_at with the earliest scheduled post's published_at.
 */
export async function syncNextScheduledAt(db: any): Promise<string | null> {
    try {
        const row = await db.prepare(`
            SELECT MIN(published_at) as next_at
            FROM posts
            WHERE status = 'scheduled'
              AND published_at IS NOT NULL
              AND published_at != ''
        `).first() as { next_at?: string | null } | null;

        const nextAt = row?.next_at || null;
        if (nextAt) {
            const nowIso = new Date().toISOString();
            await db.prepare(`
                INSERT OR REPLACE INTO blog_settings (key, value, updated_at)
                VALUES ('next_scheduled_at', ?, ?)
            `).bind(nextAt, nowIso).run();
        } else {
            await db.prepare(`DELETE FROM blog_settings WHERE key = 'next_scheduled_at'`).run();
        }
        return nextAt;
    } catch (err) {
        console.warn('[ScheduleSync] Failed to sync next_scheduled_at:', err);
        return null;
    }
}

export * from './snapshot';
