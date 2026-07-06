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

<script module>
    // Prevent double fetching due to LayoutRenderer mounting the component twice (desktop/mobile)
    const viewCountQueue = new Set<string>();
</script>

<script lang="ts">
    import type { PageData } from "./$types";
    import { page } from "$app/stores";
    import { onMount, tick } from "svelte";
    import ImageModal from "$lib/components/ImageModal.svelte";
    import CommentList from "$lib/components/comments/CommentList.svelte";
    import { formatDate } from "$lib/utils";
    import SeoHead from "$lib/components/SeoHead.svelte";
    import { t } from "$lib/i18n";

    let { data }: { data: PageData } = $props();
    let post = $derived(data.post);
    // svelte-ignore state_referenced_locally
    let viewCount = $state(data.post?.view_count || 0);

    let likeCount = $state(0);
    let liked = $state(false);
    let isLikeLoading = $state(false);

    // Image modal state
    let modalOpen = $state(false);
    let modalImageUrl = $state("");
    let modalImageAlt = $state("");
    let postContentEl: HTMLElement | undefined = $state();

    // SEO and Metadata
    const seo = $derived(data.seo);
    const fullUrl = $derived(seo?.url || "");
    const shareTitle = $derived(post.title);

    // Helper: Slugify heading text to match markdown anchors
    function slugify(text: string): string {
        return (
            text
                .toLowerCase()
                .replace(/<[^>]*>/g, "") // remove HTML tags if any
                // Remove non-alphanumeric, non-space, non-hyphen, and keep Korean/Japanese letters
                .replace(
                    /[^\w\s\-\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FBF]/g,
                    "",
                )
                .replace(/[\s_]+/g, "-") // replace space/underscore with hyphen
                .replace(/-+/g, "-") // collapse hyphens
                .replace(/^-+|-+$/g, "")
        ); // trim hyphens
    }

    // Helper: Scroll to target element with offset for the sticky header
    function scrollToElement(el: HTMLElement) {
        const header = document.querySelector("header");
        const headerHeight = header ? (header as HTMLElement).offsetHeight : 80;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - headerHeight - 24; // 24px extra padding

        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
        });
    }

    // Helper: Find target heading element based on URL hash (smart fuzzy matching)
    function findTargetHeading(hash: string): HTMLElement | null {
        if (!hash) return null;

        // Try exact match first
        const exact = document.getElementById(hash);
        if (exact) return exact;

        // Smart match: strip leading number prefix (e.g., "1-" or "2-") and slugify
        const cleanHash = hash.replace(/^\d+-/, "");
        const normalizedHash = slugify(cleanHash);

        const headings = document.querySelectorAll(
            ".post-content h1, .post-content h2, .post-content h3, .post-content h4, .post-content h5, .post-content h6",
        );

        for (const h of headings) {
            const id = h.id;
            if (id) {
                // Exact cleaned match or substring containment check
                if (
                    id === normalizedHash ||
                    id.includes(normalizedHash) ||
                    normalizedHash.includes(id)
                ) {
                    return h as HTMLElement;
                }
            }
        }
        return null;
    }

    // Handle Content Click (Event Delegation)
    function handleContentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;

        // 1. Handle Image Click
        if (target.tagName === "IMG" && target.hasAttribute("data-original")) {
            const img = target as HTMLImageElement;
            modalImageUrl = img.getAttribute("data-original") || img.src;
            modalImageAlt = img.alt || "";
            modalOpen = true;
            return;
        }

        // 2. Handle Anchor Link Click
        const anchor = target.closest("a");
        if (anchor && anchor.hash) {
            const hash = decodeURIComponent(anchor.hash.substring(1));
            const targetEl = findTargetHeading(hash);
            if (targetEl) {
                event.preventDefault();
                // Update browser URL hash history without jumping
                history.pushState(null, "", anchor.hash);
                // Scroll to target smoothly with offset
                scrollToElement(targetEl);
            }
        }
    }

    // Toggle Like
    async function toggleLike() {
        if (!data.user) {
            alert(
                $t("blog.post.login_required_like", {
                    default: "좋아요를 누르려면 로그인이 필요합니다.",
                }),
            );
            return;
        }
        if (isLikeLoading) return;

        // Optimistic Update
        const previousLiked = liked;
        const previousCount = likeCount;

        liked = !liked;
        likeCount = liked ? likeCount + 1 : likeCount - 1;
        isLikeLoading = true;

        try {
            const res = await fetch("/api/like", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ postId: post.slug }),
            });

            if (!res.ok) {
                if (res.status === 401)
                    alert(
                        $t("blog.post.login_required_like", {
                            default: "좋아요를 누르려면 로그인이 필요합니다.",
                        }),
                    );
                else throw new Error("Failed");
            } else {
                const result: { liked: boolean; count: number } =
                    await res.json();
                liked = result.liked;
                likeCount = result.count;
            }
        } catch (e) {
            console.error("Like toggle failed", e);
            // Rollback
            liked = previousLiked;
            likeCount = previousCount;
            alert(
                $t("blog.profile.network_error", {
                    default: "통신 중 오류가 발생했습니다.",
                }),
            );
        } finally {
            isLikeLoading = false;
        }
    }

    onMount(() => {
        // Handle initial hash in URL on mount
        if (window.location.hash) {
            const hash = decodeURIComponent(window.location.hash.substring(1));
            tick().then(() => {
                setTimeout(() => {
                    const targetEl = findTargetHeading(hash);
                    if (targetEl) {
                        scrollToElement(targetEl);
                    }
                }, 150);
            });
        }
    });

    $effect(() => {
        liked = (data as any).liked || false;
        likeCount = (data as any).likeCount || 0;
        viewCount = data.post?.view_count || 0;
    });

    $effect(() => {
        const currentPostId = post.id;
        if (!viewCountQueue.has(currentPostId)) {
            viewCountQueue.add(currentPostId);

            const tempKey = `viewed_${currentPostId}`;
            const lastViewed = sessionStorage.getItem(tempKey);
            const now = Date.now();

            if (!lastViewed || now - parseInt(lastViewed) > 1000 * 60 * 30) {
                sessionStorage.setItem(tempKey, now.toString());

                fetch("/api/view-count", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        slug: post.slug,
                        lang: post.lang,
                    }),
                })
                    .then((res) => {
                        if (res.ok) {
                            res.json().then((result) => {
                                viewCount = result.views;
                            });
                        }
                    })
                    .catch((e) =>
                        console.error("Failed to update view count", e),
                    );
            }
        }
    });

    function shareTo(platform: string) {
        const text = encodeURIComponent(shareTitle);
        const url = encodeURIComponent(fullUrl);
        let href = "";

        switch (platform) {
            case "twitter":
                href = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
                break;
            case "facebook":
                href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                break;
            case "threads":
                href = `https://www.threads.net/intent/post?text=${text}%20${url}`;
                break;
            case "linkedin":
                href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
                break;
            case "whatsapp":
                href = `https://wa.me/?text=${text}%20${url}`;
                break;
            case "telegram":
                href = `https://t.me/share/url?url=${url}&text=${text}`;
                break;
            case "copy":
                navigator.clipboard.writeText(fullUrl);
                alert(
                    $t("blog.post.copy_success", {
                        default: "클립보드에 링크가 복사되었습니다!",
                    }),
                );
                return;
        }

        if (href) {
            window.open(href, "_blank", "width=600,height=400");
        }
    }
</script>

<SeoHead {seo} settings={data.settings} />

<article class="post-detail">
    {#if post.isFallback}
        <div class="fallback-banner">
            <svg
                class="warning-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                ></path><line x1="12" y1="9" x2="12" y2="13"></line><line
                    x1="12"
                    y1="17"
                    x2="12.01"
                    y2="17"
                ></line></svg
            >
            <p>
                {data.langData?.fallback_message ||
                    $t("blog.mismatch.warning", {
                        default:
                            "글이 현재 선택하신 언어로 아직 작성되지 않아, 기본 언어({lang}) 글로 대체되어 표시 중입니다.",
                    }).replace(
                        "{lang}",
                        (data.dbDefaultLang || "ko").toUpperCase(),
                    )}
            </p>
        </div>
    {/if}

    {#if post.translations && post.translations.length > 1}
        <div class="language-switcher">
            <div class="ls-label">
                <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="10"></circle><line
                        x1="2"
                        y1="12"
                        x2="22"
                        y2="12"
                    ></line><path
                        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                    ></path></svg
                >
                <span>Read in:</span>
            </div>
            <div class="ls-options">
                {#each post.translations as tr}
                    {@const langObj = data.languages?.find(
                        (l: any) => l.code === tr.lang,
                    )}
                    {#if tr.lang === post.lang}
                        <span class="ls-option current">
                            {langObj?.name || tr.lang}
                        </span>
                    {:else}
                        <a
                            href="/{tr.lang === (data.dbDefaultLang || 'ko')
                                ? ''
                                : tr.lang + '/'}{post.categorySlug}/{tr.slug}"
                            class="ls-option link"
                            data-sveltekit-reload
                        >
                            {langObj?.name || tr.lang}
                        </a>
                    {/if}
                {/each}
            </div>
        </div>
    {/if}

    <header class="post-header">
        <h1 class="title">{post.title}</h1>
        <div class="meta">
            <span class="category">{post.categorySlug || "Uncategorized"}</span>
            <span class="divider">•</span>
            <span class="date"
                >{formatDate(post.displayDate || post.createdAt, data.settings?.timezone || 'Asia/Seoul')}</span
            >
            <span class="divider">•</span>
            <span
                class="views"
                title={$t("blog.post.views_tooltip", { default: "조회수" })}
                >👀 {viewCount}</span
            >
            <span class="divider">•</span>
            <button
                class="like-btn {liked ? 'liked' : ''} {isLikeLoading
                    ? 'loading'
                    : ''}"
                onclick={toggleLike}
                title={liked
                    ? $t("blog.post.likes_tooltip_cancel", {
                          default: "좋아요 취소",
                      })
                    : $t("blog.post.likes_tooltip", { default: "좋아요" })}
                disabled={isLikeLoading}
            >
                <span class="heart">{liked ? "❤️" : "🤍"}</span>
                <span class="count">{likeCount}</span>
            </button>
        </div>
        {#if post.tags && post.tags.length > 0}
            <div class="tags">
                {#each post.tags as tag}
                    <a href="/tags/{tag}" class="tag">#{tag}</a>
                {/each}
            </div>
        {/if}
    </header>

    <div
        class="post-content"
        bind:this={postContentEl}
        onclick={handleContentClick}
        role="presentation"
    >
        {@html post.content}
    </div>

    <div class="post-action-area">
        <h2>
            {$t("blog.post.share_title", {
                default: "소셜 네트워크로 글 공유하기",
            })}
        </h2>
        <div class="action-btn-group">
            <!-- X (Twitter) -->
            <button
                class="action-icon-btn btn-x"
                onclick={() => shareTo("twitter")}
                aria-label={$t("blog.post.share_x", {
                    default: "X(트위터)로 공유",
                })}
                title={$t("blog.post.share_x", { default: "X(트위터)로 공유" })}
            >
                <svg viewBox="0 0 24 24" fill="currentColor"
                    ><path
                        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                    ></path></svg
                >
            </button>
            <!-- Facebook -->
            <button
                class="action-icon-btn btn-fb"
                onclick={() => shareTo("facebook")}
                aria-label={$t("blog.post.share_facebook", {
                    default: "페이스북으로 공유",
                })}
                title={$t("blog.post.share_facebook", {
                    default: "페이스북으로 공유",
                })}
            >
                <svg viewBox="0 0 24 24" fill="currentColor"
                    ><path
                        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                    ></path></svg
                >
            </button>
            <!-- Threads -->
            <button
                class="action-icon-btn btn-th"
                onclick={() => shareTo("threads")}
                aria-label={$t("blog.post.share_threads", {
                    default: "스레드로 공유",
                })}
                title={$t("blog.post.share_threads", {
                    default: "스레드로 공유",
                })}
            >
                <svg viewBox="0 0 24 24" fill="currentColor"
                    ><path
                        d="M14.28 12.39c.28-.2.43-.54.43-.91 0-.68-.45-1.13-1.13-1.13H11.2v4.08h2.38c.68 0 1.13-.45 1.13-1.13 0-.37-.15-.71-.43-.91zM24 12c0 6.63-5.37 12-12 12S0 18.63 0 12 5.37 0 12 0s12 5.37 12 12zm-8.6 1.94c.54-.45.85-1.1.85-1.84 0-1.28-.85-2.22-2.18-2.22H10.2v8.16h3.87c.33 0 .66-.08.96-.23.3-.15.56-.36.78-.63.22-.27.39-.59.49-.94s.15-.73.15-1.11c0-.46-.11-.87-.31-1.19z"
                    ></path><path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
                    ></path></svg
                >
            </button>
            <!-- LinkedIn -->
            <button
                class="action-icon-btn btn-li"
                onclick={() => shareTo("linkedin")}
                aria-label={$t("blog.post.share_linkedin", {
                    default: "LinkedIn으로 공유",
                })}
                title={$t("blog.post.share_linkedin", {
                    default: "LinkedIn으로 공유",
                })}
            >
                <svg viewBox="0 0 24 24" fill="currentColor"
                    ><path
                        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
                    ></path></svg
                >
            </button>
            <!-- WhatsApp -->
            <button
                class="action-icon-btn btn-wa"
                onclick={() => shareTo("whatsapp")}
                aria-label={$t("blog.post.share_whatsapp", {
                    default: "WhatsApp으로 공유",
                })}
                title={$t("blog.post.share_whatsapp", {
                    default: "WhatsApp으로 공유",
                })}
            >
                <svg viewBox="0 0 24 24" fill="currentColor"
                    ><path
                        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.355-5.033c0-5.458 4.441-9.898 9.898-9.898 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.458-4.443 9.898-9.9 9.898m.004-19.175h-.004a9.175 9.175 0 0 0-9.172 9.172c0 1.621.422 3.181 1.224 4.572L2.4 19.337l4.933-1.294a9.171 9.171 0 0 0 4.514 1.173h.004c5.058 0 9.175-4.117 9.175-9.175a9.177 9.177 0 0 0-9.175-9.175"
                    ></path></svg
                >
            </button>
            <!-- Telegram -->
            <button
                class="action-icon-btn btn-tg"
                onclick={() => shareTo("telegram")}
                aria-label={$t("blog.post.share_telegram", {
                    default: "텔레그램으로 공유",
                })}
                title={$t("blog.post.share_telegram", {
                    default: "텔레그램으로 공유",
                })}
            >
                <svg viewBox="0 0 24 24" fill="currentColor"
                    ><path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
                    ></path></svg
                >
            </button>
            <!-- Copy Link -->
            <button
                class="action-icon-btn btn-copy"
                onclick={() => shareTo("copy")}
                aria-label={$t("blog.post.share_link", {
                    default: "링크 복사",
                })}
                title={$t("blog.post.share_link", { default: "링크 복사" })}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><rect x="9" y="9" width="13" height="13" rx="2" ry="2"
                    ></rect><path
                        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                    ></path></svg
                >
            </button>
        </div>
    </div>

    <CommentList postId={post.slug} currentUser={data.user} />
</article>

<!-- Image Modal -->
<ImageModal
    bind:isOpen={modalOpen}
    bind:imageUrl={modalImageUrl}
    imageAlt={modalImageAlt}
/>

<style>
    .post-detail {
        max-width: 100%;
        margin: 0;
        background: transparent;
        padding: 0;
        border-radius: 0;
        box-shadow: none;
    }

    /* Fallback Banner */
    .fallback-banner {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        background-color: #fff8e6;
        border: 1px solid #ffd875;
        color: #b57d00;
        padding: 1rem 1.2rem;
        border-radius: 8px;
        margin-bottom: 2rem;
        font-size: 0.95rem;
        line-height: 1.4;
    }
    .warning-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
    }
    .fallback-banner p {
        margin: 0;
        font-weight: 500;
    }

    /* Language Switcher */
    .language-switcher {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 0.75rem 1.25rem;
        border-radius: 12px;
        margin-bottom: 3rem;
        flex-wrap: wrap;
        gap: 1rem;
    }
    .ls-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #64748b;
        font-weight: 600;
        font-size: 0.9rem;
    }
    .ls-options {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .ls-option {
        padding: 0.4rem 0.8rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.2s ease;
        text-decoration: none;
    }
    .ls-option.current {
        background: var(--primary-color, #2563eb);
        color: white;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
    }
    .ls-option.link {
        color: #475569;
        background: white;
        border: 1px solid #cbd5e1;
    }
    .ls-option.link:hover {
        border-color: var(--primary-color, #2563eb);
        color: var(--primary-color, #2563eb);
        transform: translateY(-1px);
    }

    .post-header {
        margin-bottom: 3rem;
        text-align: center;
    }

    .title {
        font-size: 2.5rem;
        font-weight: 800;
        margin-bottom: 1rem;
        color: #1a1a1a;
        line-height: 1.2;
    }
    .meta {
        font-size: 0.95rem;
        color: #666;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.8rem;
        margin-bottom: 1.5rem;
    }
    .category {
        color: var(--primary-color);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .divider {
        color: #ddd;
    }

    /* Like Button Styles */
    .like-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.3rem 0.6rem;
        background: #f5f5f5;
        border: 1px solid #eee;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
        color: #555;
    }
    .like-btn:hover {
        background: #eee;
        transform: scale(1.05);
    }
    .like-btn.liked {
        background: #fff0f0;
        border-color: #ffd0d0;
        color: #e53e3e;
    }
    .like-btn.loading {
        opacity: 0.7;
        pointer-events: none;
    }
    .heart {
        font-size: 1.1rem;
    }
    .count {
        font-weight: 600;
    }
    .tags {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .tag {
        font-size: 0.85rem;
        color: #555;
        background: #f0f0f0;
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        text-decoration: none;
        transition: all 0.2s;
        display: inline-block;
        max-width: 100%;
        word-break: break-all;
        overflow-wrap: break-word;
    }
    .tag:hover {
        background: var(--primary-color);
        color: white;
    }
    .post-content {
        line-height: 1.8;
        color: #333;
        margin-bottom: 4rem;
        font-size: var(--base-font-size, 16px);
        max-width: 100%;
        overflow-wrap: break-word;
        word-wrap: break-word;
        word-break: break-word;
    }

    /* Force font inheritance for post content children elements */
    :global(
            .post-content p,
            .post-content span,
            .post-content div,
            .post-content li,
            .post-content a,
            .post-content h1,
            .post-content h2,
            .post-content h3,
            .post-content h4,
            .post-content h5,
            .post-content h6
        ) {
        font-family: inherit;
    }
    :global(
            .post-content p,
            .post-content span,
            .post-content div,
            .post-content li,
            .post-content a
        ) {
        font-size: inherit;
    }

    /* Global styles for images inside post-content */
    :global(.post-content img) {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        /* Default: no cursor, no transition if no data-original */
    }

    /* Only interactive if it has data-original */
    :global(.post-content img[data-original]) {
        cursor: pointer;
        transition: transform 0.2s;
    }
    :global(.post-content img[data-original]:hover) {
        transform: scale(1.02);
    }

    /* YouTube Embed Ratio Fix */
    :global(.post-content iframe) {
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 8px;
        border: none;
        margin: 2rem 0;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }

    :global(.post-content figure) {
        display: table;
        margin: 2rem auto;
        text-align: center;
    }
    :global(.post-content figure img) {
        margin: 0;
    }
    :global(.post-content figcaption) {
        display: table-caption;
        caption-side: bottom;
        margin-top: 0;
        font-size: 0.82rem;
        color: #9ca3af;
        font-style: normal;
        font-weight: 600;
        text-align: center;
        letter-spacing: 0.01em;
    }
    /* Image alignment via data-align attribute */
    :global(.post-content figure[data-align="left"]) {
        margin-left: 0;
        margin-right: auto;
    }
    :global(.post-content figure[data-align="center"]) {
        margin-left: auto;
        margin-right: auto;
    }
    :global(.post-content figure[data-align="right"]) {
        margin-left: auto;
        margin-right: 0;
    }
    :global(.post-content img[data-align="left"]) {
        margin-left: 0;
        margin-right: auto;
    }
    :global(.post-content img[data-align="right"]) {
        margin-left: auto;
        margin-right: 0;
    }

    /* Share Section (Renamed to prevent Adblockers) */
    .post-action-area {
        border-top: 1px solid #eee;
        padding-top: 2rem;
        text-align: center;
    }
    .post-action-area h2 {
        font-size: 1.2rem;
        margin-bottom: 1rem;
        color: #444;
    }
    .action-btn-group {
        display: flex;
        justify-content: center;
        gap: 1rem;
        flex-wrap: wrap;
    }
    .action-icon-btn {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        color: white;
        padding: 0;
    }
    .action-icon-btn svg {
        width: 20px;
        height: 20px;
    }
    .action-icon-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .action-icon-btn:active {
        transform: translateY(0);
    }
    .btn-x {
        background: #000000;
    }
    .btn-fb {
        background: #1877f2;
    }
    .btn-th {
        background: #000000;
    }
    .btn-li {
        background: #0077b5;
    }
    .btn-wa {
        background: #25d366;
    }
    .btn-tg {
        background: #0088cc;
    }
    .btn-copy {
        background: #6e7681;
    }

    @media (max-width: 768px) {
        .post-detail {
            padding: 1.25rem 1rem;
            border-radius: 0;
            box-shadow: none;
            margin: 0;
        }
        .title {
            font-size: 1.6rem;
            line-height: 1.3;
        }
        .post-header {
            margin-bottom: 2rem;
        }
        /* meta row: allow wrapping so views/like don't overflow */
        .meta {
            flex-wrap: wrap;
            font-size: 0.82rem;
            gap: 0.4rem 0.6rem;
            justify-content: center;
        }
        .divider {
            display: none; /* hide • separators when wrapped */
        }
        /* action buttons: tighter gap on mobile */
        .action-btn-group {
            gap: 0.6rem;
        }
        .action-icon-btn {
            width: 36px;
            height: 36px;
        }
        .action-icon-btn svg {
            width: 17px;
            height: 17px;
        }
    }

    /* ── Post Content: Editor-generated element safety ── */

    /* Code blocks: horizontal scroll instead of overflow */
    :global(.post-content pre) {
        overflow-x: auto;
        max-width: 100%;
        font-size: 0.85rem;
        border-radius: 8px;
        padding: 1rem;
        background: #1e1e2e;
        color: #cdd6f4;
        line-height: 1.6;
    }
    :global(.post-content code) {
        font-size: 0.875em;
        word-break: break-word;
    }
    :global(.post-content pre code) {
        word-break: normal; /* inside pre, let horizontal scroll handle it */
        white-space: pre;
    }

    /* Tables: wrap in scrollable container via overflow */
    :global(.post-content table) {
        display: block;
        overflow-x: auto;
        max-width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
    }
    :global(.post-content th),
    :global(.post-content td) {
        border: 1px solid #e2e8f0;
        padding: 0.5rem 0.75rem;
        white-space: nowrap;
    }

    /* iframes & videos: constrain width, maintain aspect ratio */
    :global(.post-content iframe),
    :global(.post-content video) {
        max-width: 100% !important;
        height: auto;
    }
    /* YouTube / embed wrappers (TipTap wraps in div) */
    :global(.post-content .youtube-wrapper),
    :global(.post-content .video-wrapper),
    :global(.post-content .embed-wrapper) {
        position: relative;
        width: 100%;
        padding-bottom: 56.25%; /* 16:9 */
        height: 0;
        overflow: hidden;
        border-radius: 8px;
        margin: 1.5rem 0;
    }
    :global(.post-content .youtube-wrapper iframe),
    :global(.post-content .video-wrapper iframe),
    :global(.post-content .embed-wrapper iframe) {
        position: absolute;
        top: 0;
        left: 0;
        width: 100% !important;
        height: 100% !important;
    }

    /* Headings inside content: scale down on small screens */
    @media (max-width: 768px) {
        :global(.post-content h1) {
            font-size: 1.6rem;
        }
        :global(.post-content h2) {
            font-size: 1.35rem;
        }
        :global(.post-content h3) {
            font-size: 1.15rem;
        }
        :global(.post-content h4) {
            font-size: 1rem;
        }

        /* Wider images: allow up to full container width */
        :global(.post-content img) {
            margin: 1.25rem 0;
        }

        /* Table cells: allow wrapping in very narrow cells */
        :global(.post-content th),
        :global(.post-content td) {
            white-space: normal;
            min-width: 80px;
        }

        /* Blockquotes */
        :global(.post-content blockquote) {
            margin-left: 0;
            padding-left: 1rem;
            font-size: 0.95rem;
        }
    }

    /* Premium File Attachment Card Styles */
    :global(.post-content .file-attachment-card) {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.85rem 1.25rem;
        margin: 1.5rem 0;
        text-decoration: none !important;
        color: #1e293b !important;
        transition: all 0.2s ease-in-out;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        max-width: 500px;
    }

    :global(.post-content .file-attachment-card:hover) {
        background: #eff6ff;
        border-color: #bfdbfe;
        transform: translateY(-2px);
        box-shadow:
            0 4px 6px -1px rgba(59, 130, 246, 0.1),
            0 2px 4px -1px rgba(59, 130, 246, 0.06);
    }

    :global(.post-content .file-attachment-card .file-icon) {
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #e2e8f0;
        padding: 0.5rem;
        border-radius: 8px;
        color: #64748b;
        transition: background 0.2s;
    }

    :global(.post-content .file-attachment-card:hover .file-icon) {
        background: #dbeafe;
        color: #2563eb;
    }

    :global(.post-content .file-attachment-card .file-details) {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
    }

    :global(.post-content .file-attachment-card .file-name) {
        font-weight: 600;
        font-size: 0.95rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #1e293b;
    }

    :global(.post-content .file-attachment-card .file-size) {
        font-size: 0.75rem;
        color: #64748b;
        margin-top: 0.125rem;
    }

    :global(.post-content .file-attachment-card .download-badge) {
        font-size: 0.75rem;
        font-weight: 700;
        color: #2563eb;
        background: #eff6ff;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        border: 1px solid #bfdbfe;
        transition: all 0.2s;
        text-transform: uppercase;
    }

    :global(.post-content .file-attachment-card:hover .download-badge) {
        background: #2563eb;
        color: white;
        border-color: #2563eb;
    }

    @media (max-width: 640px) {
        :global(.post-content .file-attachment-card) {
            padding: 0.75rem 1rem;
            gap: 0.75rem;
        }
        :global(.post-content .file-attachment-card .file-name) {
            font-size: 0.875rem;
        }
        :global(.post-content .file-attachment-card .download-badge) {
            display: none;
        }
    }
</style>
