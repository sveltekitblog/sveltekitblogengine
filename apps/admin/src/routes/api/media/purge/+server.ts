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

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStorageAdapter } from '$lib/server/storageAdapter';

// POST: Purge all files in the storage bucket (DANGEROUS!)
export const POST: RequestHandler = async ({ request, platform, locals }) => {
    const db = locals.blogDb ?? null;

    try {
        const { action, confirmText } = await request.json();

        if (action !== 'purge') {
            return json({ error: 'Invalid action' }, { status: 400 });
        }
        if (confirmText !== 'PURGE ALL MEDIA') {
            return json(
                { error: 'Confirmation text does not match. Type exactly: PURGE ALL MEDIA' },
                { status: 400 }
            );
        }

        const adapter = await getStorageAdapter(platform!, db);

        // KV mode: purge is not supported via listing — return a clear error
        const testList = await adapter.list('', undefined);
        if (testList.disabled) {
            return json(
                {
                    error: 'Purge is not supported in KV storage mode. File listing is disabled to prevent excessive API call costs. Please delete files individually or switch to R2/ImageKit.',
                },
                { status: 400 }
            );
        }

        // R2 / ImageKit: page through all objects and delete in batches
        let cursor: string | undefined;
        let deletedCount = 0;

        do {
            const result = await adapter.list('', cursor);
            if (result.objects.length > 0) {
                const keys = result.objects.map((obj) => obj.key);
                await adapter.delete(keys);
                deletedCount += keys.length;
            }
            cursor = result.truncated ? result.cursor : undefined;
        } while (cursor);

        return json({
            success: true,
            message: `Purged ${deletedCount} files from storage`,
            deletedCount,
        });

    } catch (e: any) {
        console.error('[Purge] Error:', e);
        return json({ error: 'Purge failed', details: e.message }, { status: 500 });
    }
};
