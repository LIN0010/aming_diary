/* 預載即將進入的頁面及其實際引用的資源，不執行該頁程式或改動遊戲進度。 */
(() => {
    "use strict";

    async function load(destination, onProgress = () => {}, options = {}) {
        const controller = new AbortController();
        const signal = controller.signal;
        const resources = new Map();
        let timedOut = false;
        let completed = 0;
        const abort = () => controller.abort();
        if (options.signal?.aborted) abort();
        options.signal?.addEventListener("abort", abort, { once: true });
        const timeout = setTimeout(() => {
            timedOut = true;
            abort();
        }, options.timeoutMs ?? 45000);

        function add(reference, base, kind) {
            if (!reference || /^(data:|blob:|#)/i.test(reference)) return null;
            const url = new URL(reference, base);
            if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) {
                throw new Error("旅程引用了無法預載的資源");
            }
            url.hash = "";
            if (!resources.has(url.href)) resources.set(url.href, { url: url.href, kind, loaded: false });
            return resources.get(url.href);
        }

        async function textResource(resource) {
            const response = await fetch(resource.url, { signal, credentials: "same-origin", cache: "default" });
            if (!response.ok) throw new Error("無法載入旅程內容");
            const text = await response.text();
            resource.loaded = true;
            return text;
        }

        function imageResource(resource) {
            return new Promise((resolve, reject) => {
                const image = new Image();
                const cleanup = () => {
                    image.onload = null;
                    image.onerror = null;
                    signal.removeEventListener("abort", cancel);
                };
                const cancel = () => {
                    cleanup();
                    image.src = "";
                    reject(new DOMException("載入已取消", "AbortError"));
                };
                if (signal.aborted) { cancel(); return; }
                signal.addEventListener("abort", cancel, { once: true });
                image.onload = async () => {
                    try {
                        if (typeof image.decode === "function") await image.decode();
                        if (signal.aborted) { cancel(); return; }
                        cleanup();
                        resolve();
                    } catch (error) {
                        cleanup();
                        reject(error);
                    }
                };
                image.onerror = () => {
                    cleanup();
                    reject(new Error("無法載入旅程圖片"));
                };
                image.src = resource.url;
            });
        }

        try {
            const pageURL = new URL(destination, document.baseURI);
            const page = add(pageURL.href, document.baseURI, "html");
            const html = await textResource(page);
            const pages = [{ url: pageURL, html }];
            if (options.shell) {
                const shellURL = new URL(options.shell, document.baseURI);
                const shell = add(shellURL.href, document.baseURI, "html");
                pages.push({ url: shellURL, html: await textResource(shell) });
            }
            for (const content of pages) {
                const parsed = new DOMParser().parseFromString(content.html, "text/html");
                parsed.querySelectorAll('link[rel="stylesheet"][href]').forEach(link => {
                    add(link.getAttribute("href"), content.url, "css");
                });
                parsed.querySelectorAll('script[src]').forEach(script => {
                    add(script.getAttribute("src"), content.url, "script");
                });
                parsed.querySelectorAll('img[src]').forEach(image => {
                    add(image.getAttribute("src"), content.url, "image");
                });
            }

            // 先找齊 CSS 的背景圖片及匯入樣式，再固定總數，避免百分比倒退。
            let styles;
            while ((styles = [...resources.values()].filter(resource => resource.kind === "css" && !resource.loaded)).length) {
                const texts = await Promise.all(styles.map(textResource));
                styles.forEach((style, index) => {
                    const css = texts[index].replace(/\/\*[\s\S]*?\*\//g, "");
                    const imports = /@import\s+(?:url\(\s*["']?([^\s"')]+)["']?\s*\)|["']([^"']+)["'])/gi;
                    for (const match of css.matchAll(imports)) add(match[1] || match[2], style.url, "css");
                    const urls = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi;
                    for (const match of css.matchAll(urls)) {
                        const reference = match[1] || match[2] || match[3];
                        const kind = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(?:[?#]|$)/i.test(reference) ? "image" : "asset";
                        add(reference, style.url, kind);
                    }
                });
            }

            const total = resources.size;
            completed = [...resources.values()].filter(resource => resource.loaded).length;
            onProgress(completed, total);
            await Promise.all([...resources.values()].filter(resource => !resource.loaded).map(async resource => {
                if (resource.kind === "image") {
                    await imageResource(resource);
                } else {
                    const response = await fetch(resource.url, { signal, credentials: "same-origin", cache: "default" });
                    if (!response.ok) throw new Error("無法載入旅程內容");
                    await response.arrayBuffer();
                }
                if (signal.aborted) throw new DOMException("載入已取消", "AbortError");
                resource.loaded = true;
                onProgress(++completed, total);
            }));
            if (signal.aborted) throw new DOMException("載入已取消", "AbortError");
            return { completed, total, html };
        } catch (error) {
            abort();
            if (timedOut) throw new Error("載入逾時，請重試");
            throw error;
        } finally {
            clearTimeout(timeout);
            options.signal?.removeEventListener("abort", abort);
        }
    }

    window.JourneyLoader = Object.freeze({ load });
})();
