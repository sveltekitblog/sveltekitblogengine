<!--
 Copyright (C) 2026 kimteamjang

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

<script lang="ts">
    import { onMount } from "svelte";
    import type { PageData } from "./$types";
    import {
        FolderOpen,
        Image,
        Film,
        Link,
        Trash2,
        RefreshCw,
        ChevronRight,
        Home,
        Info,
        ExternalLink,
        Edit2,
        AlertTriangle,
        Download,
        Upload,
        X,
        Settings,
        Save,
        CheckCircle,
        FileText,
    } from "lucide-svelte";
    import { backupImages, restoreImages } from "$lib/utils/backup";
    import { t } from "$lib/i18n.svelte";

    let { data } = $props<{ data: PageData }>();

    // Tab state
    let activeTab = $state<"r2" | "linked" | "danger" | "settings">("r2");

    // ── Storage Settings ──────────────────────────────────────────
    let storageSettings = $state<Record<string, string>>({});
    let settingsLoading = $state(false);
    let settingsSaving = $state(false);
    let settingsSaved = $state(false);

    async function loadStorageSettings() {
        settingsLoading = true;
        try {
            const res = await fetch("/api/storage-settings");
            if (res.ok) {
                const json = await res.json();
                storageSettings = json.settings || { storage_type: "r2" };
                if (storageSettings.imagekit_proxy_mode === undefined) {
                    storageSettings.imagekit_proxy_mode = "false";
                }
            }
        } catch (e) {
            console.error("Failed to load storage settings", e);
        } finally {
            settingsLoading = false;
        }
    }

    async function saveStorageSettings() {
        settingsSaving = true;
        settingsSaved = false;
        try {
            const res = await fetch("/api/storage-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(storageSettings),
            });
            if (res.ok) {
                settingsSaved = true;
                setTimeout(() => (settingsSaved = false), 3000);
                // Reload media list with new storage type
                loadR2Contents("");
            } else {
                const err = await res.json();
                alert(t('admin.media.msg.save_fail') + err.error);
            }
        } catch (e: any) {
            alert(t('admin.media.msg.save_fail') + e.message);
        } finally {
            settingsSaving = false;
        }
    }

    // R2 Browser state
    let currentPath = $state("");
    let r2Objects = $state<any[]>([]);
    let r2Folders = $state<string[]>([]);
    let loading = $state(false);
    let selectedKeys = $state<Set<string>>(new Set());
    let storageListDisabled = $state(false); // true when storage type doesn't support listing (e.g. KV)
    let storageListDisabledReason = $state("");

    // Danger Zone state
    let purgeConfirmText = $state("");
    let purging = $state(false);

    // Backup/Restore State
    let showBackupModal = $state(false);
    let imageFileInput = $state<HTMLInputElement>();
    let mediaFileName = $state("");
    let isProcessingMedia = $state(false);
    let mediaProgress = $state(0);
    let mediaStatus = $state("");
    let purgeFirst = $state(false);

    $effect(() => {
        if (!showBackupModal) {
            mediaFileName = "";
            if (imageFileInput) imageFileInput.value = "";
        }
    });

    // Image Backup Handler
    async function handleImageBackup() {
        isProcessingMedia = true;
        mediaProgress = 0;
        mediaStatus = t('admin.media.modal.status_ready');

        try {
            await backupImages((percent, message) => {
                mediaProgress = percent;
                mediaStatus = message;
            });
            alert(t('admin.media.modal.success_backup'));
            showBackupModal = false;
        } catch (e: any) {
            console.error(e);
            mediaStatus = t('admin.media.modal.error_prefix') + e.message;
            alert(t('admin.media.msg.save_fail') + e.message);
        } finally {
            isProcessingMedia = false;
        }
    }

    onMount(() => {
        loadStorageSettings();
    });

    // Image Restore Handler
    async function handleImageRestore() {
        const file = imageFileInput?.files?.[0];
        if (!file) {
            alert(t('admin.media.modal.no_file'));
            return;
        }

        if (purgeFirst) {
            if (
                !confirm(t('admin.media.modal.restore_confirm'))
            )
                return;
        }

        isProcessingMedia = true;
        mediaProgress = 0;
        mediaStatus = t('admin.media.modal.status_ready');

        try {
            await restoreImages(
                file,
                (percent, message) => {
                    mediaProgress = percent;
                    mediaStatus = message;
                },
                purgeFirst,
            );

            alert(t('admin.media.modal.success_restore'));
            if (imageFileInput) imageFileInput.value = "";
            mediaFileName = "";
            showBackupModal = false;
            loadR2Contents("");
        } catch (e: any) {
            console.error(e);
            mediaStatus = t('admin.media.modal.error_prefix') + e.message;
            alert(t('admin.media.msg.delete_fail') + e.message);
        } finally {
            isProcessingMedia = false;
        }
    }

    // Load storage contents
    async function loadR2Contents(prefix: string = "") {
        loading = true;
        try {
            const res = await fetch(
                `/api/media?prefix=${encodeURIComponent(prefix)}`,
            );
            const data = await res.json();
            if (res.ok) {
                if (data.disabled) {
                    // Storage type does not support listing (e.g. KV)
                    // Showing files would cause excessive Cloudflare Workers API calls
                    storageListDisabled = true;
                    storageListDisabledReason =
                        data.disabledReason || "listing_unsupported";
                    r2Objects = [];
                    r2Folders = [];
                } else {
                    storageListDisabled = false;
                    r2Objects = data.objects || [];
                    r2Folders = data.folders || [];
                }
            } else {
                alert(t('admin.media.msg.load_fail') + data.error);
            }
        } catch (e: any) {
            alert(t('admin.media.msg.load_fail') + e.message);
        } finally {
            loading = false;
        }
    }
    // ... (rest of existing functions) ...

    // Navigate to folder
    function navigateToFolder(folder: string) {
        currentPath = folder;
        selectedKeys.clear();
        loadR2Contents(folder);
    }

    // Navigate up
    function navigateUp() {
        const parts = currentPath.split("/").filter(Boolean);
        parts.pop();
        currentPath = parts.length > 0 ? parts.join("/") + "/" : "";
        selectedKeys.clear();
        loadR2Contents(currentPath);
    }

    // Toggle selection
    function toggleSelect(key: string) {
        if (selectedKeys.has(key)) {
            selectedKeys.delete(key);
        } else {
            selectedKeys.add(key);
        }
        selectedKeys = new Set(selectedKeys); // trigger reactivity
    }

    // Delete selected
    async function deleteSelected() {
        if (selectedKeys.size === 0) return;
        if (!confirm(t('admin.media.msg.delete_confirm', { count: selectedKeys.size.toString() }))) return;

        try {
            const res = await fetch("/api/media", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keys: Array.from(selectedKeys) }),
            });
            if (res.ok) {
                alert(t('admin.media.msg.delete_success'));
                selectedKeys.clear();
                loadR2Contents(currentPath);
            } else {
                const data = await res.json();
                alert(t('admin.media.msg.delete_fail') + data.error);
            }
        } catch (e: any) {
            alert(t('admin.media.msg.delete_fail') + e.message);
        }
    }

    // Purge all media
    async function handlePurge() {
        if (purgeConfirmText !== "PURGE ALL MEDIA") return;
        if (
            !confirm(t('admin.media.danger.confirm_alert'))
        )
            return;

        purging = true;
        try {
            const res = await fetch("/api/media/purge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "purge",
                    confirmText: purgeConfirmText,
                }),
            });

            const result = await res.json();

            if (res.ok) {
                alert(t('admin.media.danger.success_alert', { count: result.deletedCount.toString() }));
                purgeConfirmText = "";
                activeTab = "r2";
                loadR2Contents("");
            } else {
                alert(t('admin.media.msg.delete_fail') + result.error);
            }
        } catch (e: any) {
            alert(t('admin.media.msg.delete_fail') + e.message);
        } finally {
            purging = false;
        }
    }

    // Format file size
    function formatSize(bytes: number): string {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    // Get filename from key
    function getFilename(key: string): string {
        return key.split("/").pop() || key;
    }

    function isImageFile(key: string): boolean {
        const ext = key.split('.').pop()?.toLowerCase() ?? '';
        return ["webp", "png", "jpg", "jpeg", "gif", "svg", "avif"].includes(ext);
    }

    function getFileExtension(key: string): string {
        return key.split('.').pop()?.toUpperCase() ?? '';
    }

    // Initial load
    $effect(() => {
        if (activeTab === "r2") {
            loadR2Contents(currentPath);
        }
        if (activeTab === "settings") {
            loadStorageSettings();
        }
    });

    const storageNames: Record<string, string> = {
        kv: "KV",
        r2: "R2",
        imagekit: "ImageKit",
        supabase: "Supabase",
    };
    const displayStorageName = $derived(
        storageNames[
            storageSettings.storage_type || data.storageType || "r2"
        ] || t('admin.media.tab.settings'),
    );
</script>

<div class="media-container">
    <header class="page-header">
        <h1><Image size={24} /> {t('admin.media.title', { default: '미디어 관리' })} ({displayStorageName})</h1>
        <button class="btn-secondary" onclick={() => (showBackupModal = true)}>
            <Download size={16} /> {t('admin.media.backup', { default: '백업 / 복원' })}
        </button>
    </header>

    <!-- Info Section -->
    <section class="info-section">
        <div class="info-card">
            <Info size={16} />
            <div>
                <strong>{t('admin.media.bucket', { default: '버킷:' })}</strong>
                <code>{data.bucketInfo.name}</code>
            </div>
        </div>
        <div class="info-card">
            <FolderOpen size={16} />
            <div>
                <strong>{t('admin.media.structure', { default: '폴더 구조:' })}</strong>
                <code>{data.bucketInfo.folderStructure}</code>
                <span class="hint">({data.bucketInfo.variants.join(", ")})</span
                >
            </div>
        </div>
    </section>

    <!-- Tabs -->
    <nav class="tabs">
        <button
            class:active={activeTab === "r2"}
            onclick={() => (activeTab = "r2")}
        >
            <FolderOpen size={18} />
            {storageListDisabled ? t('admin.media.tab.disabled_files', { default: '업로드된 파일' }) : t('admin.media.tab.files', { default: '미디어' })}
        </button>
        <button
            class:active={activeTab === "linked"}
            onclick={() => (activeTab = "linked")}
        >
            <Link size={18} /> {t('admin.media.tab.linked', { default: '링크된 미디어' })} ({data.linkedMedia.length})
        </button>
        <button
            class:active={activeTab === "settings"}
            onclick={() => (activeTab = "settings")}
        >
            <Settings size={18} /> {t('admin.media.tab.settings', { default: '저장소 설정' })}
        </button>
        <button
            class:active={activeTab === "danger"}
            class:danger-tab={true}
            onclick={() => (activeTab = "danger")}
        >
            <AlertTriangle size={18} /> {t('admin.media.tab.danger', { default: 'Danger Zone' })}
        </button>
    </nav>

    <!-- Tab Content -->
    <main class="tab-content">
        {#if activeTab === "r2"}
            <!-- R2 Browser -->
            <div class="r2-browser">
                <!-- Breadcrumb -->
                <div class="breadcrumb">
                    <button
                        onclick={() => navigateToFolder("")}
                        class="breadcrumb-item"
                    >
                        <Home size={14} />
                    </button>
                    {#each currentPath.split("/").filter(Boolean) as segment, i}
                        <ChevronRight size={14} />
                        <button
                            class="breadcrumb-item"
                            onclick={() => {
                                const path =
                                    currentPath
                                        .split("/")
                                        .slice(0, i + 1)
                                        .join("/") + "/";
                                navigateToFolder(path);
                            }}
                        >
                            {segment}
                        </button>
                    {/each}
                    <button
                        class="refresh-btn"
                        onclick={() => loadR2Contents(currentPath)}
                        disabled={loading}
                    >
                        <span class:spinning={loading}>
                            <RefreshCw size={14} />
                        </span>
                    </button>
                </div>

                <!-- KV 모드: 목록 비활성화 안내 배너 -->
                {#if storageListDisabled}
                    <div class="kv-disabled-banner">
                        <AlertTriangle size={20} />
                        <div>
                            <strong
                                >{t('admin.media.kv.banner_title')}</strong
                            >
                            <p>
                                {t('admin.media.kv.banner_p1')}
                            </p>
                            <p>
                                {t('admin.media.kv.banner_p2')}
                            </p>
                        </div>
                    </div>
                {:else}
                    <!-- Folders -->
                    {#if r2Folders.length > 0}
                        <div class="folders-grid">
                            {#if currentPath}
                                <button
                                    class="folder-item"
                                    onclick={navigateUp}
                                >
                                    <FolderOpen size={32} />
                                    <span>..</span>
                                </button>
                            {/if}
                            {#each r2Folders as folder}
                                <button
                                    class="folder-item"
                                    onclick={() => navigateToFolder(folder)}
                                >
                                    <FolderOpen size={32} />
                                    <span
                                        >{folder
                                            .replace(currentPath, "")
                                            .replace("/", "")}</span
                                    >
                                </button>
                            {/each}
                        </div>
                    {/if}

                    <!-- Files -->
                    {#if r2Objects.length > 0}
                        <div class="files-grid">
                            {#each r2Objects as obj}
                                <div
                                    class="file-item"
                                    class:selected={selectedKeys.has(obj.key)}
                                    onclick={() => toggleSelect(obj.key)}
                                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSelect(obj.key); }}
                                    role="button"
                                    tabindex="0"
                                    aria-label={getFilename(obj.key)}
                                >
                                    <div class="file-preview">
                                        {#if isImageFile(obj.key)}
                                            <img
                                                src={obj.url}
                                                alt={getFilename(obj.key)}
                                                loading="lazy"
                                            />
                                        {:else}
                                            <div class="generic-file-preview">
                                                <FileText size={48} class="text-gray-400" />
                                                <span class="file-ext">{getFileExtension(obj.key)}</span>
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="file-info">
                                        <span class="file-name"
                                            >{getFilename(obj.key)}</span
                                        >
                                        <span class="file-size"
                                            >{formatSize(obj.size)}</span
                                        >
                                    </div>
                                    <div class="select-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={selectedKeys.has(obj.key)}
                                        />
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else if !loading && r2Folders.length === 0}
                        <div class="empty-state">
                            <Image size={48} />
                            <p>{t('admin.media.r2.empty', { default: '이 폴더에 파일이 없습니다.' })}</p>
                        </div>
                    {/if}
                {/if}
                <!-- end KV disabled check -->

                <!-- Actions -->
                {#if selectedKeys.size > 0}
                    <div class="actions-bar">
                        <span>{selectedKeys.size}{t('admin.media.r2.selected_count', { default: '개 선택됨' })}</span>
                        <button class="btn-danger" onclick={deleteSelected}>
                            <Trash2 size={16} /> {t('admin.common.delete', { default: '삭제' })}
                        </button>
                    </div>
                {/if}
            </div>
        {:else if activeTab === "linked"}
            <!-- Linked Media -->
            <div class="linked-media">
                {#if data.linkedMedia.length === 0}
                    <div class="empty-state">
                        <Link size={48} />
                        <p>{t('admin.media.linked.empty', { default: '포스트에 링크된 미디어가 없습니다.' })}</p>
                    </div>
                {:else}
                    <table class="media-table">
                        <thead>
                            <tr>
                                <th>{t('admin.theme.widget_type_label', { default: '타입' })}</th>
                                <th>{t('admin.media.linked.col_url', { default: 'URL' })}</th>
                                <th>{t('admin.media.linked.col_post', { default: '포스트' })}</th>
                                <th>{t('admin.media.linked.col_source', { default: '구분' })}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each data.linkedMedia as media}
                                <tr>
                                    <td>
                                        {#if media.type === "image"}
                                            <Image size={16} />
                                        {:else if media.type === "video"}
                                            <Film size={16} />
                                        {:else if media.type === "file"}
                                            <FileText size={16} />
                                        {:else}
                                            <ExternalLink size={16} />
                                        {/if}
                                    </td>
                                    <td class="url-cell">
                                        <a
                                            href={media.url}
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            {media.url.length > 60
                                                ? media.url.slice(0, 60) + "..."
                                                : media.url}
                                        </a>
                                    </td>
                                    <td>
                                        <a href="/posts/{media.postId}"
                                            >{media.postTitle}</a
                                        >
                                    </td>
                                    <td>
                                        <span
                                            class="badge"
                                            class:internal={media.isInternal}
                                        >
                                            {media.isInternal
                                                ? t('admin.media.linked.internal')
                                                : t('admin.media.linked.external')}
                                        </span>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>
        {:else if activeTab === "settings"}
            <!-- Storage Settings -->
            <div class="storage-settings">
                {#if settingsLoading}
                    <div class="settings-loading">
                        <RefreshCw size={20} /> {t('admin.common.loading')}
                    </div>
                {:else}
                    <div class="settings-section">
                        <h2>{t('admin.media.settings.title', { default: '저장소 유형 선택' })}</h2>
                        <p class="settings-desc">
                            {t('admin.media.settings.desc', { default: '이미지 파일을 저장할 저장소를 선택하세요. 변경 후 저장하면 즉시 적용됩니다.' })}
                        </p>
                        <div class="storage-type-cards">
                            {#each [
                                { id: "r2", label: "Cloudflare R2", desc: t('admin.media.settings.r2_desc'), icon: "☁️" },
                                { id: "kv", label: "Cloudflare KV", desc: t('admin.media.settings.kv_desc'), icon: "🗂️" },
                                { id: "supabase", label: "Supabase Storage", desc: t('admin.media.settings.supabase_desc'), icon: "🟢" },
                                { id: "imagekit", label: "ImageKit CDN", desc: t('admin.media.settings.imagekit_desc'), icon: "🚀" }
                            ] as opt}
                                <button
                                    class="storage-card"
                                    class:selected={storageSettings[
                                        "storage_type"
                                    ] === opt.id}
                                    onclick={() =>
                                        (storageSettings = {
                                            ...storageSettings,
                                            storage_type: opt.id,
                                        })}
                                >
                                    <span class="storage-icon">{opt.icon}</span>
                                    <strong>{opt.label}</strong>
                                    <span class="storage-card-desc"
                                        >{opt.desc}</span
                                    >
                                </button>
                            {/each}
                        </div>
                    </div>

                    <!-- Supabase Settings -->
                    {#if storageSettings["storage_type"] === "supabase"}
                        <div class="settings-section">
                            <h3>{t('admin.media.supabase.title')}</h3>
                            <div class="settings-form">
                                <label>
                                    Storage URL
                                    <span class="field-hint"
                                        >예:
                                        https://&lt;ref&gt;.supabase.co/storage/v1</span
                                    >
                                    <input
                                        type="url"
                                        placeholder="https://xxxx.supabase.co/storage/v1"
                                        value={storageSettings[
                                            "supabase_storage_url"
                                        ] || ""}
                                        oninput={(e) =>
                                            (storageSettings = {
                                                ...storageSettings,
                                                supabase_storage_url: (
                                                    e.target as HTMLInputElement
                                                ).value,
                                            })}
                                    />
                                </label>
                                <label>
                                    Service Role Key
                                    <span class="field-hint"
                                        >Supabase 대시보드 → Project Settings →
                                        API → service_role</span
                                    >
                                    <input
                                        type="password"
                                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                        value={storageSettings[
                                            "supabase_storage_key"
                                        ] || ""}
                                        oninput={(e) =>
                                            (storageSettings = {
                                                ...storageSettings,
                                                supabase_storage_key: (
                                                    e.target as HTMLInputElement
                                                ).value,
                                            })}
                                    />
                                </label>
                                <label>
                                    {t('admin.media.supabase.bucket_label')}
                                    <span class="field-hint"
                                        >{t('admin.media.supabase.bucket_hint')}</span
                                    >
                                    <input
                                        type="text"
                                        placeholder="images"
                                        value={storageSettings[
                                            "supabase_storage_bucket"
                                        ] || ""}
                                        oninput={(e) =>
                                            (storageSettings = {
                                                ...storageSettings,
                                                supabase_storage_bucket: (
                                                    e.target as HTMLInputElement
                                                ).value,
                                            })}
                                    />
                                </label>
                            </div>
                        </div>
                    {/if}

                    <!-- ImageKit Settings -->
                    {#if storageSettings["storage_type"] === "imagekit"}
                        <div class="settings-section">
                            <h3>{t('admin.media.imagekit.title')}</h3>
                            <div class="settings-form">
                                <label>
                                    URL Endpoint
                                    <span class="field-hint"
                                        >예: https://ik.imagekit.io/your_id</span
                                    >
                                    <input
                                        type="url"
                                        placeholder="https://ik.imagekit.io/your_id"
                                        value={storageSettings[
                                            "imagekit_url_endpoint"
                                        ] || ""}
                                        oninput={(e) =>
                                            (storageSettings = {
                                                ...storageSettings,
                                                imagekit_url_endpoint: (
                                                    e.target as HTMLInputElement
                                                ).value,
                                            })}
                                    />
                                </label>
                                <label>
                                    Private API Key
                                    <span class="field-hint"
                                        >ImageKit 대시보드 → Developer Options →
                                        Private Key</span
                                    >
                                    <input
                                        type="password"
                                        placeholder="private_..."
                                        value={storageSettings[
                                            "imagekit_private_key"
                                        ] || ""}
                                        oninput={(e) =>
                                            (storageSettings = {
                                                ...storageSettings,
                                                imagekit_private_key: (
                                                    e.target as HTMLInputElement
                                                ).value,
                                            })}
                                    />
                                </label>
                                <div class="proxy-mode-field">
                                    <span class="proxy-label"
                                        >{t('admin.media.imagekit.serving_type')}</span
                                    >
                                    <div class="proxy-options">
                                        <label class="proxy-radio">
                                            <input
                                                type="radio"
                                                name="imagekit_proxy"
                                                value="false"
                                                checked={storageSettings[
                                                    "imagekit_proxy_mode"
                                                ] !== "true"}
                                                onchange={() =>
                                                    (storageSettings = {
                                                        ...storageSettings,
                                                        imagekit_proxy_mode:
                                                            "false",
                                                    })}
                                            />
                                            <span>
                                                <strong>{t('admin.media.imagekit.direct')}</strong
                                                >
                                                <small
                                                    >{t('admin.media.imagekit.direct_desc')}</small
                                                >
                                            </span>
                                        </label>
                                        <label class="proxy-radio">
                                            <input
                                                type="radio"
                                                name="imagekit_proxy"
                                                value="true"
                                                checked={storageSettings[
                                                    "imagekit_proxy_mode"
                                                ] === "true"}
                                                onchange={() =>
                                                    (storageSettings = {
                                                        ...storageSettings,
                                                        imagekit_proxy_mode:
                                                            "true",
                                                    })}
                                            />
                                            <span>
                                                <strong>{t('admin.media.imagekit.proxy')}</strong
                                                >
                                                <small
                                                    >{t('admin.media.imagekit.proxy_desc')}</small
                                                >
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}

                    <!-- KV Notice -->
                    {#if storageSettings["storage_type"] === "kv"}
                        <div class="kv-disabled-banner">
                            <AlertTriangle size={20} />
                            <div>
                                <strong>{t('admin.media.kv.notice_title')}</strong>
                                <p>
                                    {t('admin.media.kv.notice_desc')}
                                </p>
                                <p>
                                    {t('admin.media.kv.notice_hint')}
                                </p>
                            </div>
                        </div>
                    {/if}

                    <div class="settings-actions">
                        <button
                            class="btn-primary save-btn"
                            onclick={saveStorageSettings}
                            disabled={settingsSaving}
                        >
                            {#if settingsSaving}
                                <RefreshCw size={16} /> {t('admin.settings.saving')}
                            {:else if settingsSaved}
                                <CheckCircle size={16} /> {t('admin.common.saved', { default: '저장됨' })}
                            {:else}
                                <Save size={16} /> {t('admin.common.save', { default: '설정 저장' })}
                            {/if}
                        </button>
                    </div>
                {/if}
            </div>
        {:else if activeTab === "danger"}
            <!-- Danger Zone -->
            <div class="danger-zone">
                <div class="danger-card">
                    <div class="danger-header">
                        <AlertTriangle size={24} />
                        <h2>{t('admin.media.danger.title')}</h2>
                    </div>
                    <p class="danger-desc">
                        {t('admin.media.danger.desc')}
                    </p>

                    <div class="confirmation-box">
                        <label for="purge-confirm">
                            {t('admin.media.danger.confirm_input', { code: 'PURGE ALL MEDIA' })}
                        </label>
                        <input
                            id="purge-confirm"
                            type="text"
                            bind:value={purgeConfirmText}
                            placeholder="PURGE ALL MEDIA"
                        />
                    </div>

                    <button
                        class="btn-purge"
                        disabled={purgeConfirmText !== "PURGE ALL MEDIA" ||
                            purging}
                        onclick={handlePurge}
                    >
                        {#if purging}
                            <span class:spinning={true}
                                ><RefreshCw size={16} /></span
                            > {t('admin.media.danger.purging')}
                        {:else}
                            <Trash2 size={16} /> {t('admin.media.danger.purge_btn')}
                        {/if}
                    </button>
                </div>
            </div>
        {/if}
    </main>

    <!-- Backup/Restore Modal -->
    {#if showBackupModal}
        <div
            class="modal-backdrop"
            onclick={() => (showBackupModal = false)}
            onkeydown={(e) => { if (e.key === 'Escape') showBackupModal = false; }}
            role="button"
            tabindex="-1"
            aria-label="Close Modal"
        >
            <div class="modal-container" onclick={(e) => e.stopPropagation()}>
                <div class="modal-header">
                    <h2>{t('admin.media.modal.title')}</h2>
                    <button
                        class="close-btn"
                        onclick={() => (showBackupModal = false)}
                        ><X size={20} /></button
                    >
                </div>

                <div class="modal-body">
                    <p class="text-sm text-gray-600 mb-4">
                        {t('admin.media.modal.desc')}
                    </p>

                    <div class="grid gap-4">
                        <!-- Backup -->
                        <div
                            class="p-4 bg-indigo-50 rounded-lg border border-indigo-100"
                        >
                            <h3
                                class="text-indigo-800 font-semibold mb-1 flex items-center gap-2"
                            >
                                <Download size={16} /> {t('admin.media.modal.backup_title')}
                            </h3>
                            <button
                                onclick={handleImageBackup}
                                disabled={isProcessingMedia}
                                class="w-full mt-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium disabled:bg-gray-400 video-btn"
                            >
                                {t('admin.media.modal.backup_btn')}
                            </button>
                        </div>

                        <!-- Restore -->
                        <div
                            class="p-4 bg-orange-50 rounded-lg border border-orange-100"
                        >
                            <h3
                                class="text-orange-800 font-semibold mb-1 flex items-center gap-2"
                            >
                                <Upload size={16} /> {t('admin.media.modal.restore_title')}
                            </h3>
                            <div class="mb-3 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="modalPurgeFirst"
                                    bind:checked={purgeFirst}
                                    class="w-4 h-4"
                                />
                                <label
                                    for="modalPurgeFirst"
                                    class="text-xs text-orange-800 font-medium"
                                    >{t('admin.media.modal.restore_purge')}</label
                                >
                            </div>
                            <div class="flex flex-col gap-2 w-full">
                                <div class="flex gap-2 items-center">
                                    <!-- 숨겨진 네이티브 파일 입력 -->
                                    <input
                                        bind:this={imageFileInput}
                                        type="file"
                                        accept=".zip"
                                        style="display: none;"
                                        onchange={(e) => { mediaFileName = (e.currentTarget as HTMLInputElement).files?.[0]?.name || ''; }}
                                    />
                                    <!-- 커스텀 파일 선택 UI -->
                                    <div class="flex items-center gap-2 p-1 border border-dashed border-orange-200 rounded bg-orange-50/50 flex-1 min-w-0">
                                        <button
                                            type="button"
                                            class="text-xs py-1 px-2.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-800 font-semibold cursor-pointer whitespace-nowrap"
                                            onclick={() => imageFileInput?.click()}
                                        >{t('admin.backup.browse', { default: '파일 선택' })}</button>
                                        <span class="text-xs text-orange-700 truncate flex-1 select-none">
                                            {mediaFileName || t('admin.backup.no_file', { default: '선택된 파일 없음' })}
                                        </span>
                                    </div>
                                    <button
                                        onclick={handleImageRestore}
                                        disabled={isProcessingMedia}
                                        class="py-1.5 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-semibold disabled:bg-gray-400 whitespace-nowrap cursor-pointer"
                                    >
                                        {t('admin.theme.restore_btn')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Progress -->
                    {#if isProcessingMedia}
                        <div class="mt-4 p-3 bg-gray-50 rounded border">
                            <div class="flex justify-between mb-1 text-xs">
                                <span>{mediaStatus}</span>
                                <span>{mediaProgress}%</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style="width: {mediaProgress}%"
                                ></div>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    /* Storage Settings Tab */
    .storage-settings {
        padding: 1.5rem;
    }

    .settings-loading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #64748b;
        padding: 2rem;
    }

    .settings-section {
        margin-bottom: 2rem;
    }

    .settings-section h2 {
        font-size: 1.125rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 0.5rem;
    }

    .settings-section h3 {
        font-size: 0.95rem;
        font-weight: 700;
        color: #334155;
        margin-bottom: 1rem;
    }

    .settings-desc {
        font-size: 0.85rem;
        color: #64748b;
        margin-bottom: 1.25rem;
    }

    .storage-type-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }

    .storage-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.4rem;
        padding: 1rem;
        background: #f8fafc;
        border: 2px solid #e2e8f0;
        border-radius: 0.75rem;
        cursor: pointer;
        text-align: left;
        transition:
            border-color 0.15s,
            background 0.15s;
    }

    .storage-card:hover {
        border-color: #94a3b8;
        background: #f1f5f9;
    }

    .storage-card.selected {
        border-color: #3b82f6;
        background: #eff6ff;
    }

    .storage-icon {
        font-size: 1.75rem;
        margin-bottom: 0.25rem;
    }

    .storage-card strong {
        font-size: 0.875rem;
        color: #1e293b;
    }

    .storage-card-desc {
        font-size: 0.75rem;
        color: #64748b;
        line-height: 1.4;
    }

    .settings-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .settings-form label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
    }

    .settings-form input {
        padding: 0.5rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        background: #fff;
        transition: border-color 0.15s;
    }

    .settings-form input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px #bfdbfe;
    }

    .field-hint {
        font-size: 0.75rem;
        color: #6b7280;
        font-weight: 400;
    }

    .proxy-mode-field {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .proxy-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
    }

    .proxy-options {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .proxy-radio {
        display: flex;
        align-items: flex-start;
        gap: 0.625rem;
        padding: 0.75rem 1rem;
        background: #f8fafc;
        border: 1.5px solid #e2e8f0;
        border-radius: 0.5rem;
        cursor: pointer;
        font-weight: 400;
        transition:
            border-color 0.15s,
            background 0.15s;
    }

    .proxy-radio:has(input:checked) {
        border-color: #3b82f6;
        background: #eff6ff;
    }

    .proxy-radio input[type="radio"] {
        margin-top: 0.2rem;
        accent-color: #3b82f6;
        flex-shrink: 0;
    }

    .proxy-radio span {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .proxy-radio strong {
        font-size: 0.875rem;
        color: #1e293b;
    }

    .proxy-radio small {
        font-size: 0.75rem;
        color: #6b7280;
        line-height: 1.4;
    }

    .settings-actions {
        margin-top: 1.5rem;
    }

    .save-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1.5rem;
        background: #3b82f6;
        color: #fff;
        border: none;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
    }

    .save-btn:hover:not(:disabled) {
        background: #2563eb;
    }

    .save-btn:disabled {
        background: #93c5fd;
        cursor: not-allowed;
    }

    .kv-disabled-banner {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
        padding: 1.25rem 1.5rem;
        background: #fffbeb;
        border: 1px solid #f59e0b;
        border-left: 4px solid #f59e0b;
        border-radius: 0.5rem;
        margin-bottom: 1.5rem;
        color: #78350f;
    }

    .kv-disabled-banner strong {
        display: block;
        font-size: 0.9rem;
        font-weight: 700;
        margin-bottom: 0.4rem;
    }

    .kv-disabled-banner p {
        font-size: 0.825rem;
        line-height: 1.5;
        margin: 0.2rem 0 0;
        color: #92400e;
    }

    .media-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 2rem;
    }

    .page-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }

    .page-header h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .info-section {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
    }

    .info-card {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        font-size: 0.875rem;
    }

    .info-card code {
        background: #e2e8f0;
        padding: 0.125rem 0.5rem;
        border-radius: 0.25rem;
        font-family: monospace;
    }

    .info-card .hint {
        color: #64748b;
        font-size: 0.75rem;
    }

    .tabs {
        display: flex;
        gap: 0.5rem;
        border-bottom: 2px solid #e2e8f0;
        margin-bottom: 1.5rem;
    }

    .tabs button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        background: none;
        border: none;
        font-size: 0.875rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        transition: all 0.15s;
    }

    .tabs button:hover {
        color: #3b82f6;
    }

    .tabs button.active {
        color: #3b82f6;
        border-bottom-color: #3b82f6;
    }

    .breadcrumb {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.75rem;
        background: #f8fafc;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
    }

    .breadcrumb-item {
        background: none;
        border: none;
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
        color: #3b82f6;
        cursor: pointer;
        border-radius: 0.25rem;
    }

    .breadcrumb-item:hover {
        background: #e2e8f0;
    }

    .refresh-btn {
        margin-left: auto;
        background: none;
        border: none;
        padding: 0.5rem;
        cursor: pointer;
        color: #64748b;
        border-radius: 0.25rem;
    }

    .refresh-btn:hover {
        background: #e2e8f0;
    }

    .folders-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .folder-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        cursor: pointer;
        color: #f59e0b;
        transition: all 0.15s;
    }

    .folder-item:hover {
        background: #fef3c7;
        border-color: #f59e0b;
    }

    .folder-item span {
        font-size: 0.75rem;
        color: #1e293b;
        text-align: center;
        word-break: break-all;
    }

    .files-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
    }

    .file-item {
        position: relative;
        background: white;
        border: 2px solid #e2e8f0;
        border-radius: 0.5rem;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.15s;
    }

    .file-item:hover {
        border-color: #3b82f6;
    }

    .file-item.selected {
        border-color: #3b82f6;
        background: #eff6ff;
    }

    .file-preview {
        aspect-ratio: 1;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .file-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .generic-file-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        background: #f8fafc;
        border-radius: 0.25rem;
        position: relative;
    }

    .generic-file-preview .file-ext {
        font-size: 0.75rem;
        font-weight: 700;
        color: #64748b;
        margin-top: 0.25rem;
        background: #e2e8f0;
        padding: 2px 6px;
        border-radius: 4px;
    }

    .file-info {
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .file-name {
        font-size: 0.75rem;
        color: #1e293b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .file-size {
        font-size: 0.625rem;
        color: #64748b;
    }

    .select-checkbox {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
    }

    .select-checkbox input {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
    }

    .actions-bar {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1.5rem;
        background: #1e293b;
        color: white;
        border-radius: 0.75rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }

    .btn-danger {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-danger:hover {
        background: #dc2626;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem;
        color: #94a3b8;
        gap: 1rem;
    }

    .media-table {
        width: 100%;
        border-collapse: collapse;
    }

    .media-table th,
    .media-table td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
    }

    .media-table th {
        font-weight: 600;
        color: #64748b;
        font-size: 0.75rem;
        text-transform: uppercase;
    }

    .url-cell {
        max-width: 400px;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .url-cell a {
        color: #3b82f6;
        text-decoration: none;
        font-size: 0.875rem;
    }

    .url-cell a:hover {
        text-decoration: underline;
    }

    .badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        border-radius: 9999px;
        background: #fef3c7;
        color: #92400e;
    }

    .badge.internal {
        background: #dcfce7;
        color: #166534;
    }

    :global(.spinning) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .danger-tab {
        color: #ef4444 !important;
    }

    .danger-tab.active {
        border-bottom-color: #ef4444 !important;
        background: #fef2f2;
    }

    .danger-zone {
        display: flex;
        justify-content: center;
        padding-top: 2rem;
    }

    .danger-card {
        background: #fff;
        border: 1px solid #fee2e2;
        border-radius: 0.75rem;
        padding: 2rem;
        max-width: 600px;
        width: 100%;
        box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.1);
    }

    .danger-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: #dc2626;
        margin-bottom: 1rem;
    }

    .danger-header h2 {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
    }

    .danger-desc {
        color: #64748b;
        margin-bottom: 2rem;
        line-height: 1.6;
    }

    .confirmation-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 1.5rem;
        border-radius: 0.5rem;
        margin-bottom: 1.5rem;
    }

    .confirmation-box label {
        display: block;
        margin-bottom: 0.75rem;
        font-size: 0.875rem;
        color: #475569;
        font-weight: 500;
    }

    .confirmation-box input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.375rem;
        font-size: 1rem;
        font-family: monospace;
    }

    .confirmation-box input:focus {
        outline: none;
        border-color: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
    }

    .btn-purge {
        width: 100%;
        padding: 1rem;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 0.5rem;
        font-weight: 700;
        font-size: 1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        transition: background 0.2s;
    }

    .btn-purge:hover:not(:disabled) {
        background: #dc2626;
    }

    .btn-purge:disabled {
        background: #fca5a5;
        cursor: not-allowed;
        opacity: 0.7;
    }

    /* Modal Styles */
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal-container {
        background: white;
        border-radius: 0.5rem;
        width: 100%;
        max-width: 500px;
        padding: 1.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .modal-header h2 {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
        color: #1e293b;
    }

    .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #64748b;
    }

    .btn-secondary {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        margin-left: auto;
    }

    .btn-secondary:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
    }
</style>
