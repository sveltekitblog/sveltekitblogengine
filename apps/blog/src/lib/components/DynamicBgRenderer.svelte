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
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { validateJS } from '$lib/utils/jsValidator';
  import { untrack } from 'svelte';

  interface Props {
    area?: 'header' | 'main' | 'footer';
    code?: string;
    config?: Record<string, any>;
    zIndex?: number;
    opacity?: number;
    layerBlur?: number;
    allowMobile?: boolean;
    fallbackColor?: string;
  }

  let { 
    area = 'main', 
    code = '', 
    config = {}, 
    zIndex = -2,
    opacity = 1,
    layerBlur = 0,
    allowMobile = false,
    fallbackColor = ''
  }: Props = $props();

  let iframeEl = $state<HTMLIFrameElement>();
  let isMounted = $state(false);
  let debouncedCode = $state('');
  let debounceTimer: any;

  $effect(() => {
    debouncedCode = code;
  });

  // 1. Debounce code updates
  $effect(() => {
    if (code !== debouncedCode) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debouncedCode = code;
      }, 500);
    }
    return () => { if (debounceTimer) clearTimeout(debounceTimer); };
  });

  // 2. Security validation
  const validation = $derived(validateJS(debouncedCode));
  const safe = $derived(validation.safe);
  const finalCode = $derived.by(() => {
    if (!debouncedCode) return '';
    return String(debouncedCode).replace(/<\/script>/g, '<' + '\\/script>');
  });

  // 3. Stable Blob URL management
  let blobUrl = $state('');

  $effect(() => {
    if (!browser || !finalCode || !safe) {
      blobUrl = '';
      return;
    }

    const initialConfig = untrack(() => config);
    const initialArea = untrack(() => area);

    const scriptStart = '<' + 'script>';
    const scriptEnd = '<' + '/script>';
    const styleStart = '<' + 'style>';
    const styleEnd = '<' + '/style>';

    const html = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' blob:; style-src \'unsafe-inline\'; img-src \'self\' data:; font-src \'self\';">',
      '  ' + styleStart,
      '    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }',
      '    canvas { display: block; width: 100%; height: 100%; position: fixed; inset: 0; }',
      '  ' + styleEnd,
      '</head>',
      '<body>',
      '  <canvas id="bg-canvas"></canvas>',
      '  ' + scriptStart,
      '    (function() {',
      '      const isMobile = window.matchMedia("(max-width: 768px)").matches;',
      '      window.isBgPaused = false;',
      '      const originalRAF = window.requestAnimationFrame;',
      '      const originalCAF = window.cancelAnimationFrame;',
      '      const pendingCallbacks = new Map();',
      '      let nextCallbackId = 1;',
      '      window.requestAnimationFrame = (callback) => {',
      '        const id = nextCallbackId++;',
      '        const wrappedCallback = (timestamp) => {',
      '          pendingCallbacks.delete(id);',
      '          if (window.isBgPaused) {',
      '            const resumeHandler = () => {',
      '              const newId = originalRAF(wrappedCallback);',
      '              pendingCallbacks.set(id, newId);',
      '            };',
      '            window.addEventListener("bg-resume", resumeHandler, { once: true });',
      '            pendingCallbacks.set(id, { isPaused: true, handler: resumeHandler });',
      '            return;',
      '          }',
      '          callback(timestamp);',
      '        };',
      '        const rafId = originalRAF(wrappedCallback);',
      '        pendingCallbacks.set(id, rafId);',
      '        return id;',
      '      };',
      '      window.cancelAnimationFrame = (id) => {',
      '        const entry = pendingCallbacks.get(id);',
      '        if (entry) {',
      '          if (entry.isPaused) {',
      '            window.removeEventListener("bg-resume", entry.handler);',
      '          } else {',
      '            originalCAF(entry);',
      '          }',
      '          pendingCallbacks.delete(id);',
      '        }',
      '      };',
      '      const init = () => {',
      '        window.bgArea = ' + JSON.stringify(initialArea) + ';',
      '        window.bgConfig = ' + JSON.stringify(initialConfig) + ';',
      '        if (isMobile) {',
      '          window.bgConfig.mobileThrottleDivisor = 5;',
      '        }',
      '        window.addEventListener("message", (e) => {',
      '          if (e.data && e.data.type === "config") {',
      '            window.bgConfig = e.data.config;',
      '            if (isMobile) {',
      '              window.bgConfig.mobileThrottleDivisor = 5;',
      '            }',
      '            window.dispatchEvent(new CustomEvent("bg-config-update", { detail: window.bgConfig }));',
      '          }',
      '          if (e.data && e.data.type === "dynamic-bg/pause") {',
      '            window.isBgPaused = true;',
      '            window.dispatchEvent(new CustomEvent("bg-pause"));',
      '          }',
      '          if (e.data && e.data.type === "dynamic-bg/resume") {',
      '            window.isBgPaused = false;',
      '            window.dispatchEvent(new CustomEvent("bg-resume"));',
      '          }',
      '        });',
      '        try {',
      '          ' + finalCode + ';',
      '        } catch (e) { console.error("BG Script Error:", e); }',
      '      };',
      '      if (document.readyState === "complete" || document.readyState === "interactive") { init(); }',
      '      else { window.addEventListener("DOMContentLoaded", init); }',
      '    })();',
      '  ' + scriptEnd,
      '</body>',
      '</html>'
    ].join('\n');

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    blobUrl = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  });

  const sendMessage = (type: string, data?: any) => {
    iframeEl?.contentWindow?.postMessage({ type, ...data }, '*');
  };

  // 4. Real-time config synchronization
  $effect(() => {
    if (blobUrl && config) {
      const timer = setTimeout(() => {
        sendMessage('config', { config });
      }, 50);
      return () => clearTimeout(timer);
    }
  });

  // 5. Lifecycle & Visibility
  let observer: IntersectionObserver;
  let messageListener: (e: MessageEvent) => void;

  onMount(() => {
    isMounted = true;
    if (iframeEl) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            sendMessage('dynamic-bg/resume');
          } else {
            sendMessage('dynamic-bg/pause');
          }
        });
      }, { root: null, threshold: 0 });
      observer.observe(iframeEl);
    }
    messageListener = (e: MessageEvent) => {
      if (e.source !== iframeEl?.contentWindow) return;
      if (e.data?.type === 'dynamic-bg/error') {
        console.warn('Dynamic background error:', e.data.error);
      }
    };
    window.addEventListener('message', messageListener);
  });

  onDestroy(() => {
    observer?.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', messageListener);
    }
  });
</script>

{#if browser && safe && blobUrl}
  <div
    style="position:absolute; inset:0; pointer-events:none; width:100%; height:100%; z-index:{zIndex}; background:{fallbackColor || '#ffffff'}; opacity:{opacity};"
  ></div>
  <iframe
    bind:this={iframeEl}
    src={blobUrl}
    sandbox="allow-scripts"
    style="position:absolute; inset:0; pointer-events:none; width:100%; height:100%; z-index:{zIndex + 1}; opacity:1; filter: blur({layerBlur}px); border:none; background:transparent; will-change: transform, opacity;"
    title="Background Animation"
    aria-hidden="true"
    class="bg-iframe"
    class:allow-mobile={allowMobile}
  ></iframe>
{:else if browser && !safe}
  <div
    style="position:absolute; inset:0; z-index:{zIndex}; pointer-events:none; background:{fallbackColor || '#ffffff'}; opacity:{opacity};"
  ></div>
{/if}

<style>
  @media (max-width: 768px) {
    .bg-iframe:not(.allow-mobile) {
      display: none !important;
    }
  }
</style>
