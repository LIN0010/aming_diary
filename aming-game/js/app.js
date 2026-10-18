/* 漸進單頁入口：沿用原頁主畫面，每次只啟用一個場景及其樣式。 */
(() => {
    "use strict";
    const host = document.getElementById("scene-host");
    const loading = document.getElementById("scene-loading");
    const status = document.getElementById("scene-status");
    const progress = document.getElementById("scene-progress");
    const percentage = document.getElementById("scene-percentage");
    const retry = document.getElementById("scene-retry");
    const cancel = document.getElementById("scene-cancel");
    const fallback = document.getElementById("scene-fallback");
    const nav = GameNavigation.create("home");
    let active;
    let current;
    let activeStyle;
    let pending;
    let requested;
    let requestedReplace;

    function writeRoute(route, replace) {
        if (location.hash !== route.hash) history[replace ? "replaceState" : "pushState"]({}, "", route.hash);
    }

    function hideLoading() {
        loading.hidden = true;
        if (active) active.root.inert = false;
        host.removeAttribute("aria-busy");
    }

    function restoreRoute() {
        if (current) writeRoute(current, true);
    }

    // media=not all 先準備樣式，成功切換前不影響目前畫面。
    function prepareStyle(href, signal) {
        return new Promise((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            link.media = "not all";
            const timeout = setTimeout(() => fail(new Error("場景樣式載入逾時")), 15000);
            function clean() {
                clearTimeout(timeout);
                link.onload = link.onerror = null;
                signal.removeEventListener("abort", abort);
            }
            function fail(error) { clean(); link.remove(); reject(error); }
            function abort() { fail(new DOMException("已取消", "AbortError")); }
            link.onload = () => { clean(); resolve(link); };
            link.onerror = () => fail(new Error("無法載入場景樣式"));
            if (signal.aborted) { abort(); return; }
            signal.addEventListener("abort", abort, { once: true });
            document.head.insertBefore(link, document.getElementById("common-style"));
        });
    }

    async function navigate(reference, replace = false) {
        const route = GameNavigation.route(reference);
        if (!route || current?.hash === route.hash) {
            if (current) {
                pending?.abort();
                pending = null;
                restoreRoute();
                hideLoading();
            }
            return Boolean(route);
        }
        if (active && !active.canLeave()) { restoreRoute(); return false; }
        pending?.abort();
        const controller = new AbortController();
        const { signal } = controller;
        pending = controller;
        requested = route.url;
        requestedReplace = replace;
        loading.hidden = false;
        if (active) active.root.inert = true;
        host.setAttribute("aria-busy", "true");
        status.textContent = "正在準備旅程…";
        status.focus({ preventScroll: true });
        progress.value = 0;
        percentage.textContent = "0%";
        retry.hidden = true;
        cancel.hidden = !active;
        fallback.href = route.url;
        let style;
        try {
            const result = await JourneyLoader.load(route.url, (done, total) => {
                if (signal.aborted) return;
                const value = Math.floor(done * 100 / total);
                progress.value = value;
                percentage.textContent = value + "%";
                status.textContent = "正在載入旅程…";
            }, { signal });
            const parsed = new DOMParser().parseFromString(result.html, "text/html");
            const definition = GameNavigation.scenes[route.name];
            const template = parsed.getElementById(definition.root);
            if (!template) throw new Error("找不到場景內容");
            const root = document.importNode(template, true);
            // 只取既有主畫面，不重複執行原頁的 script。
            root.querySelectorAll("script").forEach(script => script.remove());
            root.querySelector("[data-game-nav]")?.remove();
            style = await prepareStyle(definition.style, signal);
            if (signal.aborted) { style.remove(); return false; }

            // 先以隱藏的新畫面完成初始化；失敗仍保留舊場景。
            root.hidden = true;
            const oldNavParent = nav.parentElement;
            GameNavigation.render(nav, route.name);
            root.append(nav);
            host.append(root);
            let normalized = route;
            let next;
            try {
                next = GameScenes.mount(route.name, root, {
                    url: route.url,
                    navigate,
                    syncRoute(url, initializing) {
                        const nextRoute = GameNavigation.route(url);
                        if (initializing) { normalized = nextRoute; return; }
                        current = nextRoute;
                        writeRoute(current, false);
                    }
                });
            } catch (error) {
                root.remove();
                if (oldNavParent) {
                    GameNavigation.render(nav, current.name);
                    oldNavParent.append(nav);
                    if (current.name === "explore" && oldNavParent.querySelector("#station-explore.show")) nav.classList.add("explore-hidden");
                }
                throw error;
            }
            active?.dispose();
            activeStyle?.remove();
            host.replaceChildren(root);
            active = next;
            activeStyle = style;
            style.media = "all";
            root.hidden = false;
            current = normalized;
            document.title = definition.title;
            writeRoute(current, replace);
            hideLoading();
            root.tabIndex = -1;
            root.focus({ preventScroll: true });
            return true;
        } catch (error) {
            style?.remove();
            if (signal.aborted) return false;
            restoreRoute();
            status.textContent = "這段旅程未能載入，請確認網路後重試。";
            retry.hidden = false;
            return false;
        } finally {
            if (pending === controller) pending = null;
        }
    }

    document.addEventListener("click", event => {
        const link = event.target.closest("a[href]");
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
        if (!host.contains(link) || !GameNavigation.route(link.href)) return;
        event.preventDefault();
        navigate(link.href);
    });
    window.addEventListener("hashchange", () => navigate(location.href, true));
    retry.addEventListener("click", () => navigate(requested, requestedReplace));
    cancel.addEventListener("click", () => { pending?.abort(); pending = null; restoreRoute(); hideLoading(); });
    window.addEventListener("pagehide", () => pending?.abort());
    window.addEventListener("pageshow", event => { if (event.persisted) { if (active) { restoreRoute(); hideLoading(); } else navigate(requested, true); } });
    const initial = GameNavigation.route(location.href);
    navigate(initial?.url || GameProgress.resumeUrl(), true);
})();
