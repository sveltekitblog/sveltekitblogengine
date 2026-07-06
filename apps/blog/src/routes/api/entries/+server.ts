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
import { entries, user, deletedEntries } from '@blog/shared/db/user-schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { sanitizeHtml } from '$lib/utils';

// GET /api/entries?type=comment&targetId=xxx OR ?type=guestbook
export const GET: RequestHandler = async ({ url, locals }) => {
    const type = url.searchParams.get('type');
    const rawTargetId = url.searchParams.get('targetId');
    const targetId = rawTargetId ? decodeURIComponent(rawTargetId).normalize('NFC') : null;

    if (!type || !['comment', 'guestbook'].includes(type)) {
        return json({ error: 'Invalid type parameter' }, { status: 400 });
    }

    if (type === 'comment' && !targetId) {
        return json({ error: 'Missing targetId for comments' }, { status: 400 });
    }

    const db = locals.userDb;
    if (!db) {
        return json({ error: 'Database not available' }, { status: 500 });
    }

    const currentUser = locals.user;

    try {
        let whereConditions: any[] = [
            eq(entries.type, type),
            // eq(entries.isDeleted, false) // Removed to support soft delete display
        ];

        if (type === 'comment') {
            whereConditions.push(eq(entries.targetId, targetId));
        }

        // For guestbook private entries: only show to owner or admin
        // Note: Deleted entries are public if they were public, but content is masked below.
        // If a deleted entry was private, it should still follow private rules.
        if (type === 'guestbook') {
            if (!currentUser) {
                // Not logged in - only public entries
                whereConditions.push(eq(entries.isPrivate, false));
            } else if ((currentUser as any).role !== 'admin') {
                // Logged in but not admin - public OR own private entries
                whereConditions.push(
                    or(
                        eq(entries.isPrivate, false),
                        eq(entries.userId, currentUser.id)
                    )
                );
            }
            // Admin sees all entries
        }

        const rawResults = await db
            .select({
                id: entries.id,
                type: entries.type,
                targetId: entries.targetId,
                userId: entries.userId,
                content: entries.content,
                isPrivate: entries.isPrivate,
                isDeleted: entries.isDeleted,
                createdAt: entries.createdAt,
                parentId: entries.parentId,
                user: {
                    id: user.id,
                    name: user.name,
                    image: user.image,
                },
            })
            .from(entries)
            .leftJoin(user, eq(entries.userId, user.id))
            .where(and(...whereConditions))
            .orderBy(desc(entries.createdAt))
            .all();

        // Mask deleted content and handle anonymized/withdrawn users
        const results = rawResults.map(entry => {
            const isUserValid = entry.user && entry.user.id;
            const mappedUser = isUserValid ? entry.user : {
                id: '',
                name: '알 수 없음',
                image: ''
            };

            if (entry.isDeleted) {
                return {
                    ...entry,
                    user: mappedUser,
                    content: '삭제된 메시지입니다.',
                };
            }
            return {
                ...entry,
                user: mappedUser
            };
        });

        let enableCdnCache = false;
        try {
            if (locals.db) {
                const settings = await locals.db.getSettings();
                enableCdnCache = settings?.enable_cdn_cache === 'true' || settings?.enable_cdn_cache === true;
            }
        } catch (err) {
            console.error('Failed to fetch enable_cdn_cache setting in GET entries:', err);
        }

        if (enableCdnCache) {
            return json(results, {
                headers: {
                    'Cache-Control': 'public, max-age=0, s-maxage=5, stale-while-revalidate=5'
                }
            });
        }

        return json(results);
    } catch (e: any) {
        console.error('Failed to fetch entries:', e);
        return json({ error: e.message }, { status: 500 });
    }
};

// POST /api/entries
export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
    const currentUser = locals.user as any;
    if (!currentUser) {
        return json({ error: 'Unauthorized - 로그인이 필요합니다' }, { status: 401 });
    }

    const db = locals.userDb;
    if (!db) {
        return json({ error: 'Database not available' }, { status: 500 });
    }

    try {
        // --- 유저 차단(Ban) 여부 확인 ---
        if (currentUser.banned) {
            const now = new Date();
            const expires = currentUser.ban_expires ? new Date(currentUser.ban_expires) : null;
            
            // 만료일이 없거나 아직 만료일이 지나지 않은 경우
            if (!expires || expires > now) {
                // 유저별 사유 공개 여부 확인
                const showReason = currentUser.show_ban_reason === true || currentUser.show_ban_reason === 1;
                
                return json({ 
                    error: '차단된 유저는 글을 작성할 수 없습니다.', 
                    reason: showReason ? currentUser.ban_reason : null,
                    expires: currentUser.ban_expires 
                }, { status: 403 });
            }
        }
        // -------------------------

        const body = await request.json() as {
            type: string;
            targetId?: string;
            content: string;
            isPrivate?: boolean;
            parentId?: string;
            clientTimezone?: string;
        };

        if (!body.type || !['comment', 'guestbook'].includes(body.type)) {
            return json({ error: 'Invalid type' }, { status: 400 });
        }

        if (!body.content || !body.content.trim()) {
            return json({ error: 'Content is required' }, { status: 400 });
        }

        if (body.type === 'comment' && !body.targetId) {
            return json({ error: 'targetId is required for comments' }, { status: 400 });
        }

        const settings = await locals.db.getSettings();
        const enableIpLogging = settings['enable_ip_logging'] === 'true';
        let ipAddress: string | null = null;
        if (enableIpLogging) {
            ipAddress = request.headers.get('cf-connecting-ip') || '';
            if (!ipAddress) {
                try { ipAddress = getClientAddress(); } catch(e) {}
            }
        }

        const newEntry = await db.insert(entries).values({
            id: crypto.randomUUID(),
            type: body.type,
            targetId: body.targetId || null,
            userId: currentUser.id,
            parentId: body.parentId || null,
            content: sanitizeHtml(body.content),
            isPrivate: body.isPrivate || false,
            ipAddress,
            createdAt: new Date().toISOString(),
            clientTimezone: body.clientTimezone || null,
        }).returning().get();

        return json({
            ...newEntry,
            user: {
                id: currentUser.id,
                name: currentUser.name,
                image: currentUser.image
            }
        });
    } catch (e: any) {
        console.error('Failed to create entry:', e);
        return json({ error: e.message }, { status: 500 });
    }
};

// DELETE /api/entries
export const DELETE: RequestHandler = async ({ request, locals }) => {
    const currentUser = locals.user;
    if (!currentUser) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = locals.userDb;
    if (!db) {
        return json({ error: 'Database not available' }, { status: 500 });
    }

    try {
        const { id } = await request.json() as { id: string };
        if (!id) {
            return json({ error: 'Missing entry id' }, { status: 400 });
        }

        // Check ownership
        const entry = await db.select().from(entries).where(eq(entries.id, id)).get();
        if (!entry) {
            return json({ error: 'Entry not found' }, { status: 404 });
        }

        const isOwner = entry.userId === currentUser.id;
        const isAdmin = (currentUser as any).role === 'admin';

        if (!isOwner && !isAdmin) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        // Recursive delete logic
        const deleteRecursively = async (entryId: string) => {
            // Archive before modifying or deleting
            const targetEntry = await db.select().from(entries).where(eq(entries.id, entryId)).get();
            if (targetEntry && !targetEntry.isDeleted) {
                const author = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, targetEntry.userId)).get();
                const dataToSave = {
                    ...targetEntry,
                    user_name: author?.name,
                    user_email: author?.email
                };

                await db.insert(deletedEntries).values({
                    id: targetEntry.id,
                    deletedBy: 'user',
                    originalData: JSON.stringify(dataToSave),
                    deletedAt: new Date().toISOString()
                }).onConflictDoNothing();
            }

            // Check for children
            const children = await db.select().from(entries).where(eq(entries.parentId, entryId));

            if (children.length > 0) {
                // Has children -> Soft Delete (Mask content)
                await db.update(entries)
                    .set({ isDeleted: true, content: '삭제된 메시지입니다.' })
                    .where(eq(entries.id, entryId));
            } else {
                // No children -> Hard Delete
                // First get info to check parent later
                const target = await db.select({ parentId: entries.parentId }).from(entries).where(eq(entries.id, entryId)).get();

                if (target) {
                    await db.delete(entries).where(eq(entries.id, entryId));

                    // Check if parent should also be cleaned up (Zombie Cleanup)
                    if (target.parentId) {
                        const parent = await db.select({ isDeleted: entries.isDeleted }).from(entries).where(eq(entries.id, target.parentId)).get();
                        if (parent && parent.isDeleted) {
                            // Recursively attempt to delete the parent if it's already soft-deleted
                            await deleteRecursively(target.parentId);
                        }
                    }
                }
            }
        };

        await deleteRecursively(id);

        return json({ success: true });
    } catch (e: any) {
        console.error('Failed to delete entry:', e);
        return json({ error: e.message }, { status: 500 });
    }
};
