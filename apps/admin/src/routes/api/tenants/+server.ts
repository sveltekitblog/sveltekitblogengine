import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
    const db = locals.blogDb;
    if (!db) return json({ error: 'Database unavailable' }, { status: 500 });
    const { results } = await db.prepare("SELECT * FROM tenants ORDER BY created_at ASC").all();
    return json({ tenants: results || [] });
};

export const POST: RequestHandler = async ({ request, locals }) => {
    const db = locals.blogDb;
    if (!db) return json({ error: 'Database unavailable' }, { status: 500 });

    try {
        const { slug, name, customDomain } = await request.json();
        const cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        const cleanName = (name || '').trim();
        const cleanDomain = customDomain ? (customDomain || '').trim().toLowerCase() : null;

        if (!cleanSlug || !cleanName) {
            return json({ error: '블로그 슬러그와 이름을 입력해 주세요.' }, { status: 400 });
        }

        const id = crypto.randomUUID();
        await db.prepare(`
            INSERT INTO tenants (id, slug, name, custom_domain, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', datetime('now', '+9 hours'), datetime('now', '+9 hours'))
        `).bind(id, cleanSlug, cleanName, cleanDomain).run();

        // 새 블로그의 기본 설정 자동 초기화 (타이틀 및 기본 헤더 메뉴)
        const siteTitleJson = JSON.stringify({ ko: cleanName, en: cleanName });
        const defaultHeaderJson = JSON.stringify({
            logoText: { ko: cleanName, en: cleanName, ja: "Blog" },
            menuItems: [
                { id: 1, type: "link", label: { ko: "Home", en: "Home", ja: "Home" }, url: "/", icon: "Home" },
                { id: 3, type: "category_drawer", label: { ko: "Categories", en: "Categories", ja: "Categories" }, icon: "Menu" },
                { id: 2, type: "link", label: { ko: "방명록", en: "Guestbook", ja: "ゲストブック" }, url: "/guestbook", icon: "MessageSquare" }
            ],
            mobile: {
                menuItems: [
                    { id: 1, type: "link", label: { ko: "Home", en: "Home", ja: "Home" }, url: "/", icon: "Home" },
                    { id: 3, type: "category_drawer", label: { ko: "Categories", en: "Categories", ja: "Categories" }, icon: "Menu" },
                    { id: 2, type: "link", label: { ko: "방명록", en: "Guestbook", ja: "ゲストブック" }, url: "/guestbook", icon: "MessageSquare" }
                ]
            }
        });

        await db.prepare(`
            INSERT OR IGNORE INTO blog_settings (tenant_id, key, value, updated_at)
            VALUES (?, 'site_title', ?, datetime('now', '+9 hours'))
        `).bind(id, siteTitleJson).run();

        await db.prepare(`
            INSERT OR IGNORE INTO blog_settings (tenant_id, key, value, updated_at)
            VALUES (?, 'header', ?, datetime('now', '+9 hours'))
        `).bind(id, defaultHeaderJson).run();

        return json({ success: true, tenant: { id, slug: cleanSlug, name: cleanName, customDomain: cleanDomain } });
    } catch (e: any) {
        return json({ error: e.message || '블로그 생성에 실패했습니다 (슬러그 또는 도메인 중복).' }, { status: 500 });
    }
};

export const PUT: RequestHandler = async ({ request, locals }) => {
    const db = locals.blogDb;
    if (!db) return json({ error: 'Database unavailable' }, { status: 500 });

    try {
        const { id, name, customDomain, status } = await request.json();
        if (!id) return json({ error: 'ID is required' }, { status: 400 });

        const cleanDomain = customDomain ? (customDomain || '').trim().toLowerCase() : null;
        await db.prepare(`
            UPDATE tenants 
            SET name = COALESCE(?, name),
                custom_domain = ?,
                status = COALESCE(?, status),
                updated_at = datetime('now', '+9 hours')
            WHERE id = ?
        `).bind(name || null, cleanDomain, status || null, id).run();

        return json({ success: true });
    } catch (e: any) {
        return json({ error: e.message || '블로그 정보 수정 실패' }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
    const db = locals.blogDb;
    if (!db) return json({ error: 'Database unavailable' }, { status: 500 });

    try {
        const { id } = await request.json();
        if (!id || id === 'default') {
            return json({ error: '기본 블로그는 삭제할 수 없습니다.' }, { status: 400 });
        }

        // 테넌트 데이터 일괄 정리
        await db.batch([
            db.prepare("DELETE FROM posts WHERE tenant_id = ?").bind(id),
            db.prepare("DELETE FROM categories WHERE tenant_id = ?").bind(id),
            db.prepare("DELETE FROM blog_settings WHERE tenant_id = ?").bind(id),
            db.prepare("DELETE FROM layouts WHERE tenant_id = ?").bind(id),
            db.prepare("DELETE FROM widgets WHERE tenant_id = ?").bind(id),
            db.prepare("DELETE FROM visitor_stats WHERE tenant_id = ?").bind(id),
            db.prepare("DELETE FROM media WHERE tenant_id = ?").bind(id),
            db.prepare("DELETE FROM tenants WHERE id = ?").bind(id)
        ]);

        return json({ success: true });
    } catch (e: any) {
        return json({ error: e.message || '블로그 삭제 실패' }, { status: 500 });
    }
};
