import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [sveltekit()],
    server: {
        fs: {
            allow: ['../../packages/shared']
        }
    },
    build: {
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            onwarn(warning, warn) {
                // Suppress harmless unused external import warnings (e.g. from better-auth)
                if (warning.code === 'UNUSED_EXTERNAL_IMPORT') {
                    return;
                }
                warn(warning);
            }
        }
    }
});
