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

export interface ProcessedImages {
    desktop: Blob;
    mobile: Blob;
    thumbnail: Blob;
    original: Blob;
}

const DESKTOP_MAX_WIDTH = 1200;
const MOBILE_MAX_WIDTH = 480;
const THUMBNAIL_MAX_WIDTH = 240;
const QUALITY_DESKTOP = 0.8;
const QUALITY_MOBILE = 0.8;
const QUALITY_THUMBNAIL = 0.8;
const QUALITY_ORIGINAL = 0.9;

/**
 * Loads a file into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
        img.src = url;
    });
}

/**
 * Resizes and converts an image to WebP format.
 */
function convertToWebP(
    img: HTMLImageElement,
    maxWidth: number | null,
    quality: number
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Resize if maxWidth is specified and image is wider
        if (maxWidth && width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP blob
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Canvas validation failed"));
                }
            },
            "image/webp",
            quality
        );
    });
}

/**
 * Processes a single image file into desktop, mobile, and original WebP blobs.
 */
export async function processImage(file: File): Promise<ProcessedImages> {
    const img = await loadImage(file);

    const [desktop, mobile, thumbnail, original] = await Promise.all([
        convertToWebP(img, DESKTOP_MAX_WIDTH, QUALITY_DESKTOP),
        convertToWebP(img, MOBILE_MAX_WIDTH, QUALITY_MOBILE),
        convertToWebP(img, THUMBNAIL_MAX_WIDTH, QUALITY_THUMBNAIL),
        convertToWebP(img, null, QUALITY_ORIGINAL), // Original dimensions, but WebP
    ]);

    return { desktop, mobile, thumbnail, original };
}
