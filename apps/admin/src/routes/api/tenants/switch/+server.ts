import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
    const { tenantId } = await request.json();
    if (!tenantId) return json({ error: 'Tenant ID required' }, { status: 400 });

    const matched = (locals.tenants || []).find(t => t.id === tenantId);
    if (!matched && tenantId !== 'default') {
        return json({ error: '존재하지 않는 블로그입니다.' }, { status: 404 });
    }

    // 활성 테넌트 쿠키 설정 (1년)
    cookies.set('active_tenant_id', tenantId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
    });

    return json({ success: true, activeTenant: matched });
};
