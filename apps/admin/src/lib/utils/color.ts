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

// Basic color conversion utilities (Hex <-> OKLCH)
// Reference: https://bottosson.github.io/posts/oklab/

function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
        const hex = Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Gamma correction for sRGB -> Linear RGB
function srgbToLinear(c: number): number {
    return c >= 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
}

// Gamma correction for Linear RGB -> sRGB
function linearToSrgb(c: number): number {
    return c >= 0.0031308 ? 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055 : 12.92 * c;
}

export function hexToOklch(hex: string): { l: number; c: number; h: number } {
    const [sr, sg, sb] = hexToRgb(hex);
    const lr = srgbToLinear(sr);
    const lg = srgbToLinear(sg);
    const lb = srgbToLinear(sb);

    const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

    const l__ = Math.cbrt(l_);
    const m__ = Math.cbrt(m_);
    const s__ = Math.cbrt(s_);

    const L = 0.2104542553 * l__ + 0.793617785 * m__ - 0.0040720468 * s__;
    const a = 1.9779984951 * l__ - 2.428592205 * m__ + 0.4505937099 * s__;
    const b = 0.0259040371 * l__ + 0.7827717662 * m__ - 0.808675766 * s__;

    const C = Math.sqrt(a * a + b * b);
    let H = Math.atan2(b, a) * (180 / Math.PI);

    if (H < 0) H += 360;

    return {
        l: parseFloat((L * 100).toFixed(2)),
        c: parseFloat(C.toFixed(3)),
        h: parseFloat(H.toFixed(2)),
    };
}

export function oklchToHex(l: number, c: number, h: number): string {
    const L = l / 100;
    const H_rad = h * (Math.PI / 180);
    const a = c * Math.cos(H_rad);
    const b = c * Math.sin(H_rad);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l__ = l_ * l_ * l_;
    const m__ = m_ * m_ * m_;
    const s__ = s_ * s_ * s_;

    const lr = 4.0767416621 * l__ - 3.3077115913 * m__ + 0.2309699292 * s__;
    const lg = -1.2684380046 * l__ + 2.6097574011 * m__ - 0.3413193965 * s__;
    const lb = -0.0041960863 * l__ - 0.7034186147 * m__ + 1.707614701 * s__;

    const rgbR = linearToSrgb(lr);
    const rgbG = linearToSrgb(lg);
    const rgbB = linearToSrgb(lb);

    return rgbToHex(rgbR, rgbG, rgbB);
}
