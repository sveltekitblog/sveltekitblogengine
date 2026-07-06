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
    let { html, useShadowDom = true }: { html: string, useShadowDom?: boolean } = $props();
    let container: HTMLDivElement | undefined = $state();

    $effect(() => {
        if (!container || !html) return;

        try {
            let targetDOM: ShadowRoot | HTMLDivElement;

            if (!useShadowDom) {
                // 일반 모드 (Light DOM): 외부 스타일 상속
                let shadow = container.shadowRoot;
                if (shadow) shadow.innerHTML = "";
                targetDOM = container;
                targetDOM.innerHTML = html;
            } else {
                // 격리 모드 (Shadow DOM): 외부 스타일 차단
                let shadow = container.shadowRoot || container.attachShadow({ mode: "open" });
                container.innerHTML = "";
                targetDOM = shadow;
                targetDOM.innerHTML = html;
            }

            const scripts = targetDOM.querySelectorAll("script");
            scripts.forEach((oldScript) => {
                const newScript = document.createElement("script");

                // Copy attributes (src, type, async, etc.)
                Array.from(oldScript.attributes).forEach((attr) => {
                    newScript.setAttribute(attr.name, attr.value);
                });

                // Copy content
                newScript.textContent = oldScript.textContent;

                // Replace to trigger execution
                oldScript.parentNode?.replaceChild(newScript, oldScript);
            });
        } catch (e) {
            console.error("HtmlWidget Error (Admin):", e);
        }
    });
</script>

<!-- The Host Element for Shadow DOM -->
<div bind:this={container} class="html-widget-host" class:light-dom-widget={!useShadowDom}></div>

<style>
    .html-widget-host {
        display: block;
        width: 100%;
        /* Ensure the host itself doesn't collapse */
        min-height: 10px;
    }
</style>
