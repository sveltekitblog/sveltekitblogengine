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

import JSZip from 'jszip';
import { t } from '$lib/i18n.svelte';

// Helper to wait
const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Backup all images from R2 to a ZIP file
 */
export async function backupImages(
    onProgress: (percent: number, message: string) => void
): Promise<void> {
    const zip = new JSZip();
    let allObjects: any[] = [];
    const prefixesToScan: string[] = [''];
    let storageType = 'r2';

    // 0. Fetch active storage type for dynamic filename
    try {
        const settingsRes = await fetch('/api/storage-settings');
        if (settingsRes.ok) {
            const data = (await settingsRes.json()) as any;
            if (data.settings?.storage_type) {
                storageType = data.settings.storage_type;
            }
        }
    } catch (e) {
        // Fallback to default 'r2'
    }

    // 1. Fetch all object keys recursively (BFS)
    onProgress(0, t('admin.backup.msg_scanning_list', { default: '파일 목록을 가져오는 중...' }));

    while (prefixesToScan.length > 0) {
        const currentPrefix = prefixesToScan.shift()!;
        let cursor: string | undefined;

        do {
            const params = new URLSearchParams();
            if (currentPrefix) params.append('prefix', currentPrefix);
            if (cursor) params.append('cursor', cursor);
            params.append('action', 'backup');

            const res: any = await fetch(`/api/media?${params.toString()}`).then(r => r.json());
            if (res.error) throw new Error(res.error);

            if (res.disabled) {
                if (currentPrefix === '') {
                    throw new Error(t('admin.backup.err_scan_unsupported', { default: '이 저장소(KV 등)는 전체 폴더 스캔을 지원하지 않아 백업할 수 없습니다.' }));
                }
                break;
            }

            if (res.objects && res.objects.length > 0) {
                allObjects = [...allObjects, ...res.objects];
            }

            if (res.folders && res.folders.length > 0) {
                for (const folder of res.folders) {
                    zip.folder(folder); // ZIP 컨테이너 내부에 빈 폴더 경로 생성
                    prefixesToScan.push(folder); // 하위 탐색 큐에 서브 폴더 추가
                }
            }

            cursor = res.truncated ? res.cursor : undefined;
        } while (cursor);
    }

    if (allObjects.length === 0) {
        throw new Error(t('admin.backup.err_no_images', { default: '백업할 이미지가 없습니다.' }));
    }

    // 2. Download and Add to ZIP
    const total = allObjects.length;
    let completed = 0;

    // Process in batches to avoid browser freeze
    const BATCH_SIZE = 5;
    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = allObjects.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (obj) => {
            try {
                const response = await fetch(`/images/${obj.key}`);
                if (!response.ok) throw new Error(`Failed to fetch ${obj.key}`);
                const blob = await response.blob();

                // Add to zip (preserve folder structure)
                zip.file(obj.key, blob);
            } catch (err) {
                console.error(`Error backing up ${obj.key}:`, err);
            }
        }));

        completed += batch.length;
        const percent = Math.round((completed / total) * 50); // First 50% is downloading
        onProgress(percent, t('admin.backup.msg_downloading_images', { default: '이미지 다운로드 중... ({completed}/{total})', completed: String(completed), total: String(total) }));
    }

    // 3. Generate ZIP
    onProgress(50, t('admin.backup.msg_compressing', { default: 'ZIP 파일 압축 중...' }));
    const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        const pct = (50 + (metadata.percent / 2)).toFixed(0);
        onProgress(50 + (metadata.percent / 2), t('admin.backup.msg_compress_progress', { default: '압축 진행률: {percent}%', percent: pct }));
    });

    // 4. Download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `${storageType}-images-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onProgress(100, t('admin.backup.msg_done', { default: '완료!' }));
}

/**
 * Restore images from ZIP to R2
 */
export async function restoreImages(
    file: File,
    onProgress: (percent: number, message: string) => void,
    purgeFirst: boolean = false
): Promise<void> {
    // 1. Purge if requested
    if (purgeFirst) {
        onProgress(0, t('admin.backup.msg_purging', { default: '기존 이미지 삭제 중...' }));
        await fetch('/api/media/purge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'purge', confirmText: 'PURGE ALL MEDIA' })
        });
    }

    // 2. Unzip
    onProgress(10, t('admin.backup.msg_reading_zip', { default: 'ZIP 파일 읽는 중...' }));
    const zip = await JSZip.loadAsync(file);
    const files: { key: string, file: JSZip.JSZipObject }[] = [];

    zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
            files.push({ key: relativePath, file: zipEntry });
        }
    });

    const total = files.length;
    if (total === 0) throw new Error(t('admin.backup.err_no_zip_images', { default: 'ZIP 파일에 이미지가 없습니다.' }));

    // 3. Upload in batches
    let completed = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async ({ key, file }) => {
            const blob = await file.async('blob');
            const formData = new FormData();
            formData.append('file', blob, key.split('/').pop()); // filename
            formData.append('key', key);

            const res = await fetch('/api/media/restore-file', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                console.error(`Failed to upload ${key}`);
            }
        }));

        completed += batch.length;
        const percent = 10 + Math.round((completed / total) * 90);
        onProgress(percent, t('admin.backup.msg_uploading_images', { default: '이미지 업로드 중... ({completed}/{total})', completed: String(completed), total: String(total) }));
    }

    onProgress(100, t('admin.backup.msg_restore_done', { default: '복원 완료!' }));
}
