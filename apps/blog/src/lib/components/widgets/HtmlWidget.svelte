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
    let lastInjectedHtml = "";

    $effect(() => {
        if (!container || !html) return;

        // Svelte 5 업데이트 주기와의 충돌 방지: 이전 주입한 HTML과 완전 동일하면 재실행하지 않음
        if (lastInjectedHtml === html) return;
        lastInjectedHtml = html;

        try {
            let targetDOM: ShadowRoot | HTMLDivElement;

            if (!useShadowDom) {
                // 일반 모드 (Light DOM): 외부 스타일 상속
                let shadow = container.shadowRoot;
                if (shadow) shadow.innerHTML = ""; // 기존 쉐도우 돔 내부 비우기
                targetDOM = container;
                targetDOM.innerHTML = html;
            } else {
                // 격리 모드 (Shadow DOM): 외부 스타일 차단
                let shadow = container.shadowRoot || container.attachShadow({ mode: "open" });
                container.innerHTML = ""; // 기존 라이트 돔 내부 비우기
                targetDOM = shadow;
                targetDOM.innerHTML = html;
            }

            // Script Execution (Force Run)
            const scripts = targetDOM.querySelectorAll("script");
            scripts.forEach((oldScript) => {
                const newScript = document.createElement("script");

                // Copy attributes (src, type, async, etc.)
                Array.from(oldScript.attributes).forEach((attr) => {
                    newScript.setAttribute(attr.name, attr.value);
                });

                // Copy content
                let content = oldScript.textContent || "";
                if (!useShadowDom && content.includes("adsbygoogle") && !content.includes("window.adsbygoogle")) {
                    // 엄격 모드(Strict Mode)에서 변수 선언 오류로 인한 실행 중단 방지
                    content = content.replace(/\badsbygoogle\s*=/g, "window.adsbygoogle =");
                }
                newScript.textContent = content;

                // Replace to trigger execution
                oldScript.parentNode?.replaceChild(newScript, oldScript);
            });
        } catch (e) {
            console.error("HtmlWidget Error:", e);
        }
    });
</script>

<div 
    bind:this={container} 
    class="html-widget-host" 
    class:light-dom-widget={!useShadowDom}
></div>

<style>
    .html-widget-host {
        display: block;
        width: 100%;
        min-height: 10px;
        font-family: var(--widget-item-font-family, inherit);
        font-size: var(--widget-item-font-size, inherit);
        font-weight: var(--widget-item-font-weight, inherit);
        color: var(--widget-item-color, inherit);
    }
</style>

