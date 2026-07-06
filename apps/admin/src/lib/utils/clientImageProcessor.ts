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
 * Client-side image processing utility using Canvas API
 * Provides resizing and WebP conversion without server-side dependencies (sharp).
 */

interface ProcessedImages {
    desktop: Blob;
    mobile: Blob;
    thumbnail: Blob;
    original?: Blob;
}

interface ImageProcessingOptions {
    quality?: number;
    generateOriginal?: boolean;
}

/**
 * Resize image and convert to WebP
 */
async function processVariant(
    img: HTMLImageElement,
    maxWidth: number,
    quality: number
): Promise<Blob> {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;

    // Calculate new dimensions
    if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.drawImage(img, 0, 0, width, height);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas to Blob failed'));
            },
            'image/webp',
            quality / 100
        );
    });
}

/**
 * Process complete image set (Desktop, Mobile, Original)
 */
export async function processImage(
    file: File,
    options: ImageProcessingOptions = {}
): Promise<ProcessedImages> {
    const { quality = 80, generateOriginal = false } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = async () => {
            try {
                // Determine logic: 
                // Desktop: Max 1200px
                // Mobile: Max 800px

                const [desktop, mobile, thumbnail] = await Promise.all([
                    processVariant(img, 1200, quality),
                    processVariant(img, 640, Math.min(quality, 80)),
                    processVariant(img, 360, Math.min(quality, 80))
                ]);

                let original: Blob | undefined;
                if (generateOriginal) {
                    // Original variant also converted to WebP but with high quality and original size
                    // If user wants TRUE original, we could just return the file, but standardizing to WebP is consistent
                    original = await processVariant(img, img.width, 95);
                }

                URL.revokeObjectURL(url);
                resolve({ desktop, mobile, thumbnail, original });
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(e);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * Get image dimensions helper
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            const dims = { width: img.width, height: img.height };
            URL.revokeObjectURL(url);
            resolve(dims);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image for dimensions'));
        };

        img.src = url;
    });
}
