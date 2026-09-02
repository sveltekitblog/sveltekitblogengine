<script lang="ts">
    import { page } from "$app/stores";
    import { t } from "$lib/i18n.svelte";
    import type { Tenant } from "@blog/shared";

    let tenants = $derived(($page.data.tenants || []) as Tenant[]);
    let currentTenant = $derived(($page.data.tenant || { id: 'default', name: '메인 블로그', slug: 'default' }) as Tenant);

    let isOpen = $state(false);
    let showModal = $state(false);

    let newName = $state("");
    let newSlug = $state("");
    let newDomain = $state("");
    let isSubmitting = $state(false);
    let errorMsg = $state("");

    async function switchTenant(tenantId: string) {
        isOpen = false;
        if (tenantId === currentTenant.id) return;
        try {
            const res = await fetch("/api/tenants/switch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId })
            });
            if (res.ok) {
                window.location.reload();
            }
        } catch (e) {
            console.error("Switch tenant failed", e);
        }
    }

    async function createTenant() {
        if (!newName.trim() || !newSlug.trim()) {
            errorMsg = t("admin.tenant.error_empty", { default: "블로그 이름과 슬러그를 입력해 주세요." });
            return;
        }
        isSubmitting = true;
        errorMsg = "";
        try {
            const res = await fetch("/api/tenants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newName,
                    slug: newSlug,
                    customDomain: newDomain || null
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showModal = false;
                await switchTenant(data.tenant.id);
            } else {
                errorMsg = data.error || "블로그 생성에 실패했습니다.";
            }
        } catch (e: any) {
            errorMsg = e.message || "네트워크 오류가 발생했습니다.";
        } finally {
            isSubmitting = false;
        }
    function getTenantDisplayName(tenant: Tenant) {
        if (tenant.slug === 'default' || tenant.id === 'default' || tenant.name === '메인 블로그') {
            return t('admin.tenant.default_name', { default: '메인 블로그' });
        }
        return tenant.name;
    }
</script>

<div class="tenant-switcher-container">
    <button class="tenant-current-btn" onclick={() => (isOpen = !isOpen)} aria-expanded={isOpen}>
        <div class="tenant-info">
            <span class="tenant-badge">BLOG</span>
            <span class="tenant-name" title={getTenantDisplayName(currentTenant)}>{getTenantDisplayName(currentTenant)}</span>
        </div>
        <span class="chevron">▼</span>
    </button>

    {#if isOpen}
        <div class="tenant-dropdown">
            <div class="tenant-dropdown-header">{t("admin.tenant.select_header", { default: "관리할 블로그 선택" })}</div>
            <div class="tenant-list">
                {#each tenants as tItem}
                    <button 
                        class="tenant-item" 
                        class:active={tItem.id === currentTenant.id}
                        onclick={() => switchTenant(tItem.id)}
                    >
                        <div class="tenant-item-title">{getTenantDisplayName(tItem)}</div>
                        <div class="tenant-item-sub">/@{tItem.slug} {tItem.customDomain ? `· ${tItem.customDomain}` : ''}</div>
                    </button>
                {/each}
            </div>
            <button class="add-tenant-btn" onclick={() => { isOpen = false; showModal = true; }}>
                {t("admin.tenant.add_btn", { default: "+ 새 블로그 추가" })}
            </button>
        </div>
    {/if}
</div>

{#if showModal}
    <div class="modal-backdrop" onclick={() => (showModal = false)} role="presentation">
        <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog">
            <h3>{t("admin.tenant.modal_title", { default: "새 블로그 개설" })}</h3>
            <p class="modal-desc">{t("admin.tenant.modal_desc", { default: "단 1초 만에 새로운 독립 블로그를 생성합니다." })}</p>

            {#if errorMsg}
                <div class="error-box">{errorMsg}</div>
            {/if}

            <div class="form-group">
                <label for="tenant-name-input">{t("admin.tenant.name_label", { default: "블로그 이름" })}</label>
                <input id="tenant-name-input" type="text" bind:value={newName} placeholder={t("admin.tenant.name_placeholder", { default: "예: 개발 다이어리" })} />
            </div>

            <div class="form-group">
                <label for="tenant-slug-input">{t("admin.tenant.slug_label", { default: "블로그 슬러그 (영문/숫자/하이픈)" })}</label>
                <input id="tenant-slug-input" type="text" bind:value={newSlug} placeholder={t("admin.tenant.slug_placeholder", { default: "예: dev, tech, daily" })} />
                <span class="input-hint">{t("admin.tenant.slug_hint_prefix", { default: "접속 주소:" })} <code>/@{newSlug || 'slug'}</code> {t("admin.tenant.slug_hint_or", { default: "또는" })} <code>{newSlug || 'slug'}.domain</code></span>
            </div>

            <div class="form-group">
                <label for="tenant-domain-input">{t("admin.tenant.domain_label", { default: "독립 커스텀 도메인 (선택 사항)" })}</label>
                <input id="tenant-domain-input" type="text" bind:value={newDomain} placeholder={t("admin.tenant.domain_placeholder", { default: "예: myblog.com" })} />
            </div>

            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick={() => (showModal = false)}>{t("admin.tenant.btn_cancel", { default: "취소" })}</button>
                <button type="button" class="btn-submit" onclick={createTenant} disabled={isSubmitting}>
                    {isSubmitting ? t("admin.tenant.btn_creating", { default: "생성 중..." }) : t("admin.tenant.btn_create", { default: "블로그 생성하기" })}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .tenant-switcher-container { position: relative; margin: 0 1rem 1rem 1rem; }
    .tenant-current-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 0.5rem 0.75rem; color: #f8fafc; cursor: pointer; text-align: left; }
    .tenant-info { display: flex; align-items: center; gap: 0.5rem; overflow: hidden; }
    .tenant-badge { font-size: 0.65rem; background: #3b82f6; color: #fff; padding: 0.15rem 0.35rem; border-radius: 4px; font-weight: 700; }
    .tenant-name { font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
    .chevron { font-size: 0.65rem; color: #94a3b8; }
    .tenant-dropdown { position: absolute; top: calc(100% + 4px); left: 0; width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 100; overflow: hidden; }
    .tenant-dropdown-header { font-size: 0.7rem; color: #94a3b8; padding: 0.5rem 0.75rem 0.25rem 0.75rem; font-weight: 600; text-transform: uppercase; }
    .tenant-list { max-height: 180px; overflow-y: auto; }
    .tenant-item { width: 100%; text-align: left; background: none; border: none; padding: 0.5rem 0.75rem; color: #e2e8f0; cursor: pointer; border-bottom: 1px solid #1e293b; transition: background 0.15s; }
    .tenant-item:hover, .tenant-item.active { background: #1e293b; }
    .tenant-item.active .tenant-item-title { color: #38bdf8; font-weight: 700; }
    .tenant-item-title { font-size: 0.82rem; font-weight: 500; }
    .tenant-item-sub { font-size: 0.7rem; color: #64748b; }
    .add-tenant-btn { width: 100%; background: #1e293b; border: none; padding: 0.6rem; color: #38bdf8; font-size: 0.8rem; font-weight: 600; cursor: pointer; text-align: center; }
    .add-tenant-btn:hover { background: #334155; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 999; backdrop-filter: blur(4px); }
    .modal-card { background: #0f172a; border: 1px solid #334155; border-radius: 12px; width: 90%; max-width: 440px; padding: 1.5rem; color: #f8fafc; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .modal-card h3 { margin: 0 0 0.25rem 0; font-size: 1.2rem; }
    .modal-desc { margin: 0 0 1.25rem 0; font-size: 0.85rem; color: #94a3b8; }
    .error-box { background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.82rem; margin-bottom: 1rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.35rem; color: #cbd5e1; }
    .form-group input { width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 0.55rem 0.75rem; color: #f8fafc; font-size: 0.85rem; box-sizing: border-box; }
    .form-group input:focus { outline: none; border-color: #38bdf8; }
    .input-hint { display: block; font-size: 0.72rem; color: #64748b; margin-top: 0.25rem; }
    .input-hint code { background: #1e293b; padding: 0.1rem 0.3rem; border-radius: 3px; color: #38bdf8; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
    .btn-cancel { background: #334155; border: none; border-radius: 6px; padding: 0.55rem 1rem; color: #cbd5e1; font-size: 0.85rem; cursor: pointer; }
    .btn-submit { background: #2563eb; border: none; border-radius: 6px; padding: 0.55rem 1.25rem; color: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
