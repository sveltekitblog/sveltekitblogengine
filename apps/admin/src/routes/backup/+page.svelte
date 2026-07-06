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
    import { backupImages, restoreImages } from "$lib/utils/backup";
    import { t } from "$lib/i18n.svelte";

    let fileInput: HTMLInputElement;
    let isRestoring = $state(false);
    let restoreStatus = $state("");
    let jsonFileName = $state("");

    // Image Backup State
    let imageFileInput: HTMLInputElement;
    let isProcessingMedia = $state(false);
    let mediaProgress = $state(0);
    let mediaStatus = $state("");
    let purgeFirst = $state(false);
    let zipFileName = $state("");

    // Function to handle backup download
    function downloadBackup() {
        const date = new Date().toISOString().slice(0, 10);
        const link = document.createElement("a");
        link.href = "/api/backup?section=content";
        link.download = `blog-content-backup-${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Function to handle restore
    async function handleRestore() {
        const file = fileInput?.files?.[0];
        if (!file) {
            alert(t('admin.backup.select_json_first', { default: "백업 파일(.json)을 먼저 선택해주세요." }));
            return;
        }

        if (
            !confirm(
                t('admin.backup.confirm_restore_content', { default: "⚠️ 경고: 복원 시 현재의 모든 포스트와 카테고리가 삭제되고 백업 데이터로 대체됩니다.\n\n정말로 진행하시겠습니까?" }),
            )
        ) {
            return;
        }

        isRestoring = true;
        restoreStatus = t('admin.backup.status_reading', { default: "파일 읽는 중..." });

        try {
            const text = await file.text();
            const json = JSON.parse(text);

            restoreStatus = t('admin.backup.status_uploading', { default: "데이터 업로드 중..." });
            const res = await fetch("/api/restore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: json, backupType: 'content' }),
            });

            const result = await res.json();

            if (res.ok) {
                restoreStatus = t('admin.backup.status_complete', { default: "✅ 복원 완료!" });
                alert(
                    t('admin.backup.alert_restore_success', { default: "복원이 성공적으로 완료되었습니다! 페이지를 새로고침합니다." }),
                );
                window.location.reload();
            } else {
                throw new Error(
                    result.error || result.details || t('admin.backup.unknown_error', { default: "알 수 없는 오류" }),
                );
            }
        } catch (e: any) {
            console.error(e);
            restoreStatus = `❌ Error: ${e.message}`;
            alert(`${t('admin.backup.alert_restore_failed', { default: "복원 실패" })}: ${e.message}`);
        } finally {
            isRestoring = false;
        }
    }

    // Image Backup Handler
    async function handleImageBackup() {
        isProcessingMedia = true;
        mediaProgress = 0;
        mediaStatus = t('admin.media.modal.status_ready', { default: "준비 중..." });

        try {
            await backupImages((percent, message) => {
                mediaProgress = percent;
                mediaStatus = message;
            });
            alert(t('admin.media.modal.success_backup', { default: "이미지 백업이 완료되었습니다." }));
        } catch (e: any) {
            console.error(e);
            mediaStatus = t('admin.backup.status_error', { default: "오류 발생" }) + ": " + e.message;
            alert(t('admin.backup.alert_backup_failed', { default: "백업 실패" }) + ": " + e.message);
        } finally {
            isProcessingMedia = false;
        }
    }

    // Image Restore Handler
    async function handleImageRestore() {
        const file = imageFileInput?.files?.[0];
        if (!file) {
            alert(t('admin.media.modal.no_file', { default: "백업 파일(.zip)을 먼저 선택해주세요." }));
            return;
        }

        if (purgeFirst) {
            if (
                !confirm(
                    t('admin.media.modal.restore_confirm', { default: "⚠️ 경고: '기존 이미지 삭제'가 체크되어 있습니다.\n복원 전에 R2 버킷의 모든 파일이 삭제됩니다.\n\n정말 진행하시겠습니까?" }),
                )
            )
                return;
        }

        isProcessingMedia = true;
        mediaProgress = 0;
        mediaStatus = t('admin.media.modal.status_ready', { default: "준비 중..." });

        try {
            await restoreImages(
                file,
                (percent, message) => {
                    mediaProgress = percent;
                    mediaStatus = message;
                },
                purgeFirst,
            );

            alert(t('admin.media.modal.success_restore', { default: "이미지 복원이 완료되었습니다." }));
            // Reset input
            if (imageFileInput) imageFileInput.value = "";
        } catch (e: any) {
            console.error(e);
            mediaStatus = t('admin.backup.status_error', { default: "오류 발생" }) + ": " + e.message;
            alert(t('admin.backup.alert_restore_failed', { default: "복원 실패" }) + ": " + e.message);
        } finally {
            isProcessingMedia = false;
        }
    }
</script>

<div class="media-container">
    <header class="page-header">
        <h1>
            <svg
                xmlns="http://www.w3.org/-2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-database"
                ><ellipse cx="12" cy="5" rx="9" ry="3" /><path
                    d="M3 5V19A9 3 0 0 0 21 19V5"
                /><path d="M3 12A9 3 0 0 0 21 12" /></svg
            > {t('admin.backup.content_title')}
        </h1>
    </header>

    <div class="info-card" style="margin-bottom: 2rem;">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-info"
            ><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path
                d="M12 8h.01"
            /></svg
        >
        <div>
            {t('admin.backup.info')}<br />
            <a
                href="/design-editor"
                style="color: #3b82f6; text-decoration: none; font-weight: 500;"
            >{t('admin.backup.theme_editor_link')}</a>
        </div>
    </div>

    <!-- Data Backup Section -->
    <div class="settings-form" style="margin-bottom: 3rem;">
        <div class="form-header">
            <h3>{t('admin.backup.data_title')}</h3>
            <p>{t('admin.backup.data_desc')}</p>
        </div>

        <div class="setting-group">
            <div class="setting-row">
                <div class="setting-info">
                    <label>{t('admin.backup.export_label')}</label>
                    <span class="field-hint">{t('admin.backup.export_hint')}</span>
                </div>
                <div class="setting-control" style="flex: 0 0 auto;">
                    <button
                        onclick={downloadBackup}
                        class="btn-primary"
                        style="display: flex; gap: 0.5rem; align-items: center; justify-content: center; width: 100%;"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="lucide lucide-download"
                            ><path
                                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                            /><polyline points="7 10 12 15 17 10" /><line
                                x1="12"
                                y1="15"
                                x2="12"
                                y2="3"
                            /></svg
                        >
                        {t('admin.backup.download_btn')}
                    </button>
                </div>
            </div>

            <div class="setting-row">
                <div class="setting-info">
                    <label style="color: #dc2626;"
                        >{t('admin.backup.import_label')}</label
                    >
                    <span class="field-hint">
                        {t('admin.backup.import_hint')}<br />
                        <strong style="color: #dc2626;"
                            >{t('admin.backup.import_warning')}</strong
                        >
                    </span>
                </div>
                <div
                    class="setting-control"
                    style="display: flex; flex-direction: column; gap: 0.75rem;"
                >
                    <!-- 숨겨진 네이티브 파일 입력 -->
                    <input
                        bind:this={fileInput}
                        type="file"
                        accept=".json"
                        style="display: none;"
                        onchange={(e) => { jsonFileName = (e.currentTarget as HTMLInputElement).files?.[0]?.name || ''; }}
                    />
                    <!-- 커스텀 파일 선택 UI -->
                    <div class="custom-file-row">
                        <button
                            type="button"
                            class="btn-file-browse"
                            onclick={() => fileInput.click()}
                        >{t('admin.backup.browse', { default: '파일 선택' })}</button>
                        <span class="file-name-label">
                            {jsonFileName || t('admin.backup.no_file', { default: '선택된 파일 없음' })}
                        </span>
                    </div>
                    <button
                        onclick={handleRestore}
                        disabled={isRestoring}
                        class="btn-danger"
                        style="display: flex; gap: 0.5rem; align-items: center; justify-content: center; width: 100%;"
                    >
                        {#if isRestoring}
                            <svg
                                class="spinning"
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                ><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg
                            >
                            {t('admin.backup.restoring')}
                        {:else}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="lucide lucide-upload"
                                ><path
                                    d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                                /><polyline points="17 8 12 3 7 8" /><line
                                    x1="12"
                                    y1="3"
                                    x2="12"
                                    y2="15"
                                /></svg
                            >
                            {t('admin.backup.restore_btn')}
                        {/if}
                    </button>
                    {#if restoreStatus}
                        <div
                            class="status-msg {restoreStatus.includes(
                                'Error',
                            ) || restoreStatus.includes('실패')
                                ? 'error'
                                : 'success'}"
                        >
                            {restoreStatus}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <!-- Deploy Config Backup Section -->
    <div class="settings-form" style="margin-bottom: 3rem;">
        <div class="form-header">
            <h3>{t('admin.backup.deploy_title', { default: '배포 설정 백업' })}</h3>
            <p>{t('admin.backup.deploy_desc', { default: 'Cloudflare D1 데이터베이스 및 KV 리소스 연동 정보를 포함한 wrangler.backup.json 설정을 백업합니다.' })}</p>
        </div>

        <div class="setting-group">
            <div class="setting-row">
                <div class="setting-info">
                    <label>{t('admin.backup.deploy_export_label', { default: '배포 설정 파일 내보내기' })}</label>
                    <span class="field-hint">
                        {t('admin.backup.deploy_export_hint', { default: '신버전 코드나 새 패치를 빌드/배포하려면, 이 백업 설정을 다운로드하여 각 앱 디렉토리(apps/blog, apps/admin) 내에 wrangler.json 파일로 복사해 넣으십시오.' })}
                    </span>
                </div>
                <div class="setting-control" style="flex: 0 0 auto;">
                    <a
                        href="/api/backup/deploy"
                        download="wrangler.backup.json"
                        class="btn-primary"
                        style="display: flex; gap: 0.5rem; align-items: center; justify-content: center; text-decoration: none; font-size: 0.875rem; font-weight: 600;"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="lucide lucide-download"
                            ><path
                                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                            /><polyline points="7 10 12 15 17 10" /><line
                                x1="12"
                                y1="15"
                                x2="12"
                                y2="3"
                            /></svg
                        >
                        {t('admin.backup.deploy_download_btn', { default: '설정 백업 다운로드' })}
                    </a>
                </div>
            </div>
        </div>
    </div>

    <!-- Media Backup Section -->
    <div class="settings-form">
        <div class="form-header">
            <h3>{t('admin.backup.media_title')}</h3>
            <p>{t('admin.backup.media_desc')}</p>
        </div>

        <div class="setting-group">
            <div class="setting-row">
                <div class="setting-info">
                    <label>{t('admin.backup.media_export_label')}</label>
                    <span class="field-hint">{t('admin.backup.media_export_hint')}</span>
                </div>
                <div class="setting-control" style="flex: 0 0 auto;">
                    <button
                        onclick={handleImageBackup}
                        disabled={isProcessingMedia}
                        class="btn-primary"
                        style="display: flex; gap: 0.5rem; justify-content: center; align-items: center; width: 100%; background-color: #4f46e5;"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="lucide lucide-download"
                            ><path
                                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                            /><polyline points="7 10 12 15 17 10" /><line
                                x1="12"
                                y1="15"
                                x2="12"
                                y2="3"
                            /></svg
                        >
                        {t('admin.backup.media_download_btn')}
                    </button>
                </div>
            </div>

            <div class="setting-row">
                <div class="setting-info">
                    <label style="color: #ea580c;">{t('admin.backup.media_import_label')}</label>
                    <span class="field-hint">{t('admin.backup.media_import_hint')}</span>

                    <div style="margin-top: 1rem;">
                        <label
                            class="checkbox-label"
                            style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;"
                        >
                            <input
                                type="checkbox"
                                bind:checked={purgeFirst}
                                style="width: 1rem; height: 1rem; accent-color: #ea580c;"
                            />
                            <strong style="color: #9a3412; font-size: 0.825rem;"
                                >{t('admin.backup.purge_label')}</strong
                            >
                        </label>
                    </div>
                </div>
                <div
                    class="setting-control"
                    style="display: flex; flex-direction: column; gap: 0.75rem;"
                >
                    <!-- 숨겨진 네이티브 파일 입력 -->
                    <input
                        bind:this={imageFileInput}
                        type="file"
                        accept=".zip"
                        style="display: none;"
                        onchange={(e) => { zipFileName = (e.currentTarget as HTMLInputElement).files?.[0]?.name || ''; }}
                    />
                    <!-- 커스텀 파일 선택 UI -->
                    <div class="custom-file-row">
                        <button
                            type="button"
                            class="btn-file-browse"
                            onclick={() => imageFileInput.click()}
                        >{t('admin.backup.browse', { default: '파일 선택' })}</button>
                        <span class="file-name-label">
                            {zipFileName || t('admin.backup.no_file', { default: '선택된 파일 없음' })}
                        </span>
                    </div>
                    <button
                        onclick={handleImageRestore}
                        disabled={isProcessingMedia}
                        class="btn-primary"
                        style="display: flex; gap: 0.5rem; align-items: center; justify-content: center; width: 100%; background-color: #ea580c;"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="lucide lucide-upload"
                            ><path
                                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                            /><polyline points="17 8 12 3 7 8" /><line
                                x1="12"
                                y1="3"
                                x2="12"
                                y2="15"
                            /></svg
                        >
                        {t('admin.backup.media_restore_btn')}
                    </button>
                </div>
            </div>

            <!-- Progress Bar -->
            {#if isProcessingMedia}
                <div class="progress-box">
                    <div class="progress-header">
                        <span>{t('admin.backup.progress')}</span>
                        <span>{mediaProgress}%</span>
                    </div>
                    <div class="progress-bg">
                        <div
                            class="progress-bar"
                            style="width: {mediaProgress}%"
                        ></div>
                    </div>
                    <p class="progress-status">{mediaStatus}</p>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .media-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
    }

    .page-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 2rem;
    }

    .page-header h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .info-card {
        display: flex;
        align-items: flex-start;
        gap: 0.625rem;
        padding: 1.25rem 1.5rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        color: #334155;
        line-height: 1.5;
    }

    /* Settings Form UI (Reused from Media Page) */
    .settings-form {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        overflow: hidden;
        max-width: 800px; /* 추가: 시선 집중을 위해 폼 넓이 축소 */
        margin: 0 auto; /* 추가: 가운데 정렬 */
    }

    .form-header {
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
    }

    .form-header h3 {
        font-size: 1.125rem;
        font-weight: 600;
        color: #1e293b;
        margin: 0 0 0.5rem;
    }

    .form-header p {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0;
    }

    .setting-group {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .setting-row {
        display: flex;
        flex-direction: column; /* 추가: 데스크톱에서도 항상 세로 배치로 유지 */
        gap: 1rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid #e2e8f0;
    }

    .setting-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }

    .setting-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .setting-info label {
        font-size: 0.95rem;
        font-weight: 600;
        color: #374151;
    }

    .field-hint {
        font-size: 0.8rem;
        color: #6b7280;
        font-weight: 400;
        line-height: 1.4;
    }

    .setting-control {
        flex: 1;
        width: 100%;
        display: flex;
        flex-direction: column; /* 폼 요소 세로 정렬 */
        align-items: flex-start; /* 좌측 정렬 및 컨텐츠 너비 차지 */
    }

    .setting-control > *,
    .setting-control .btn-primary,
    .setting-control .btn-danger {
        width: auto !important; /* 액션 버튼 및 폼이 본래 너비만 차지하게 변경 */
        min-width: 140px;
    }

    /* Buttons */
    .btn-primary {
        padding: 0.625rem 1rem;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
    }
    .btn-primary:hover:not(:disabled) {
        background: #2563eb;
    }
    .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-danger {
        padding: 0.625rem 1rem;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
    }
    .btn-danger:hover:not(:disabled) {
        background: #dc2626;
    }
    .btn-danger:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* Custom File Input Styling */
    .custom-file-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 0.5rem;
    }
    .btn-file-browse {
        flex-shrink: 0;
        padding: 0.4rem 1rem;
        border-radius: 9999px;
        border: none;
        font-size: 0.875rem;
        font-weight: 600;
        background: #e2e8f0;
        color: #475569;
        cursor: pointer;
        transition: background 0.15s;
    }
    .btn-file-browse:hover {
        background: #cbd5e1;
    }
    .file-name-label {
        font-size: 0.875rem;
        color: #64748b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Status Text */
    .status-msg {
        font-size: 0.875rem;
        font-weight: 500;
        text-align: center;
        margin-top: 0.5rem;
    }
    .status-msg.error {
        color: #dc2626;
    }
    .status-msg.success {
        color: #16a34a;
    }

    /* Progress Widget */
    .progress-box {
        margin-top: 1.5rem;
        padding: 1.25rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
    }
    .progress-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #475569;
    }
    .progress-bg {
        width: 100%;
        background-color: #e2e8f0;
        border-radius: 9999px;
        height: 0.5rem;
        overflow: hidden;
    }
    .progress-bar {
        background-color: #3b82f6;
        height: 100%;
        border-radius: 9999px;
        transition: width 0.3s ease;
    }
    .progress-status {
        font-size: 0.75rem;
        color: #64748b;
        margin-top: 0.5rem;
        text-align: center;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
    :global(.spinning) {
        animation: spin 1s linear infinite;
    }
</style>
