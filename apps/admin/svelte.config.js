import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),

    onwarn: (warning, handler) => {
        // Suppress a11y warnings and unused CSS selector warnings
        // These don't affect runtime performance or correctness
        if (warning.code.startsWith('a11y') || warning.code === 'css_unused_selector') return;
        handler(warning);
    },

    kit: {
        adapter: adapter(),
        alias: {
            '@blog/shared': '../../packages/shared/src',
            '@blog/shared/*': '../../packages/shared/src/*'
        }
    }
};

export default config;
