const ITERATIONS = 100_000;

function toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
    const raw = atob(value);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' }, key, 256
    ));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let difference = 0;
    for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
    return difference === 0;
}

export async function hashDashboardPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return `pbkdf2-sha256:${ITERATIONS}:${toBase64(salt)}:${toBase64(await derive(password, salt, ITERATIONS))}`;
}

export async function verifyDashboardPassword(password: string, stored: string): Promise<{ valid: boolean; needsUpgrade: boolean }> {
    const parts = stored.split(':');
    if (parts.length === 4 && parts[0] === 'pbkdf2-sha256') {
        const iterations = Number(parts[1]);
        if (!Number.isInteger(iterations) || iterations < 100_000) return { valid: false, needsUpgrade: false };
        try {
            return {
                valid: constantTimeEqual(await derive(password, fromBase64(parts[2]), iterations), fromBase64(parts[3])),
                needsUpgrade: iterations < ITERATIONS
            };
        } catch {
            return { valid: false, needsUpgrade: false };
        }
    }

    // Existing SHA-256 values remain usable once, then are upgraded on login.
    if (/^[a-f0-9]{64}$/i.test(stored)) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
        const candidate = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        return {
            valid: constantTimeEqual(new TextEncoder().encode(candidate), new TextEncoder().encode(stored)),
            needsUpgrade: true
        };
    }
    return { valid: false, needsUpgrade: false };
}
