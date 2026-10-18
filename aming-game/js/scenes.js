/* 場景共用生命週期：切換時移除事件、訂閱與計時器，保留舊頁自動啟動。 */
(() => {
    "use strict";
    const factories = new Map();

    function createScope(root, options) {
        const events = new AbortController();
        const timers = new Set();
        const cleaners = [];
        const guards = [];
        let disposed = false;
        let initializing = true;
        const ctx = {
            root,
            params: new URL(options.url || location.href, document.baseURI).searchParams,
            id: id => root.querySelector("#" + id),
            query: selector => root.querySelector(selector),
            queryAll: selector => root.querySelectorAll(selector),
            on(target, event, callback, settings = {}) {
                target.addEventListener(event, callback, { ...settings, signal: events.signal });
            },
            delay(callback, delay) {
                const timer = setTimeout(() => {
                    timers.delete(timer);
                    if (!disposed) callback();
                }, delay);
                timers.add(timer);
                return timer;
            },
            cancelTimer(timer) {
                clearTimeout(timer);
                timers.delete(timer);
            },
            subscribe(callback) {
                const unsubscribe = GameProgress.subscribe(callback);
                cleaners.push(unsubscribe);
                return unsubscribe;
            },
            cleanup(callback) { cleaners.push(callback); },
            beforeLeave(callback) { guards.push(callback); },
            canLeave: () => guards.every(guard => guard() !== false),
            go(url) {
                if (options.navigate) return options.navigate(url);
                window.location.href = url;
            },
            replaceRoute(url) {
                if (options.syncRoute) options.syncRoute(url, initializing);
                else history.replaceState({}, "", url);
            },
            ready() { initializing = false; },
            dispose() {
                if (disposed) return;
                disposed = true;
                events.abort();
                timers.forEach(clearTimeout);
                timers.clear();
                cleaners.reverse().forEach(cleanup => cleanup());
            }
        };
        return ctx;
    }

    function mount(name, root, options = {}) {
        if (!factories.has(name)) throw new Error("場景尚未準備完成");
        const scope = createScope(root, options);
        try {
            factories.get(name)(scope);
            scope.ready();
            return scope;
        } catch (error) {
            scope.dispose();
            throw error;
        }
    }

    window.GameScenes = Object.freeze({
        mount,
        register(name, factory) {
            factories.set(name, factory);
            if (!document.body.hasAttribute("data-scene-shell")) {
                const root = document.getElementById(GameNavigation.scenes[name].root);
                if (root) mount(name, root);
            }
        }
    });
})();
