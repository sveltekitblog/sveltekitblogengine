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

// src/lib/utils/jsValidator.ts
/**
 * Validates user‑provided JavaScript code for the dynamic background feature.
 * It removes or comments out disallowed APIs and returns a sanitized version
 * together with any warnings.
 */
export interface ValidationResult {
  safe: boolean;
  sanitizedCode: string;
  warnings: string[];
}

// List of forbidden patterns (regex strings) – anything that can breach security.
const FORBIDDEN_PATTERNS: { pattern: RegExp; message: string }[] = [
  { pattern: /\bfetch\b/gi, message: 'Network requests (fetch) are prohibited.' },
  { pattern: /\bXMLHttpRequest\b/gi, message: 'XMLHttpRequest is prohibited.' },
  { pattern: /\bWebSocket\b/gi, message: 'WebSocket connections are prohibited.' },
  { pattern: /\beval\b/gi, message: 'eval() is prohibited.' },
  { pattern: /\bnew Function\b/gi, message: 'Function constructor is prohibited.' },
  { pattern: /\bdocument\.cookie\b/gi, message: 'Access to cookies is prohibited.' },
  { pattern: /\blocalStorage\b/gi, message: 'Access to localStorage is prohibited.' },
  { pattern: /\bindexedDB\b/gi, message: 'Access to indexedDB is prohibited.' },
];

// Allow‑list of CDN URLs that can be imported via <script src="…">
export const ALLOWED_CDN_PREFIXES = [
  'https://cdn.jsdelivr.net',
  'https://unpkg.com',
];

/**
 * Sanitises the provided code.
 * All forbidden patterns are commented out and a warning is added.
 * Returned `safe` flag is true only when no forbidden patterns were found.
 */
export function validateJS(code: any = ''): ValidationResult {
  let safe = true;
  const warnings: string[] = [];
  let sanitized = String(code || '');

  FORBIDDEN_PATTERNS.forEach(({ pattern, message }) => {
    if (pattern.test(sanitized)) {
      safe = false;
      warnings.push(message);
      // Mangle the matched word to prevent it from matching again in future passes
      sanitized = sanitized.replace(pattern, (match) => {
        const mangled = match.split('').join('_');
        return `/* ${mangled} (blocked) */`;
      });
    }
  });

  // Remove any <script src> that is not from an allowed CDN.
  // This regex captures <script src="..."></script> tags.
  const scriptTagRegex = /<script\s+src=["']([^"']+)["']\s*>\s*<\/script>/gi;
  sanitized = sanitized.replace(scriptTagRegex, (full, src) => {
    const allowed = ALLOWED_CDN_PREFIXES.some(prefix => src.startsWith(prefix));
    if (!allowed) {
      safe = false;
      warnings.push(`External script "${src}" is not from an allowed CDN and has been removed.`);
      return '';
    }
    return full; // keep allowed script
  });

  return { safe, sanitizedCode: sanitized, warnings };
}
