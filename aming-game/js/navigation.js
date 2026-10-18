/* 導覽項目與新舊入口的網址轉換，共用同一份定義。 */
(() => {
    "use strict";
    const scenes = Object.freeze({
        home: Object.freeze({ page: "home.html", root: "home-screen", style: "css/home.css", title: "尋軌：阿明的日記" }),
        explore: Object.freeze({ page: "explore.html", root: "explore-screen", style: "css/explore.css", title: "鐵道探索｜尋軌" }),
        event: Object.freeze({ page: "event.html", root: "event-screen", style: "css/event.css", title: "期間限定活動｜尋軌" }),
        diary: Object.freeze({ page: "diary.html", root: "diary-screen", style: "css/diary.css", title: "阿明的日記｜尋軌" })
    });
    const items = [
        ["home", "home.html", "⌂", "首頁"],
        ["explore", "explore.html", "⌖", "探索"],
        ["diary", "diary.html", "▤", "日記"],
        ["event", "event.html", "☆", "活動"],
        ["group", "group.html", "♙", "旅團"]
    ];

    function render(nav, active) {
        if (!nav.dataset.navigationReady) {
            nav.replaceChildren();
            for (const [id, href, icon, label] of items) {
                const link = document.createElement("a");
                link.className = "nav-item";
                link.href = href;
                link.dataset.destination = id;
                const symbol = document.createElement("span");
                symbol.className = "nav-icon";
                symbol.textContent = icon;
                const text = document.createElement("span");
                text.className = "nav-label";
                text.textContent = label;
                link.append(symbol, text);
                if (!scenes[id]) {
                    link.classList.add("notification-item");
                    link.addEventListener("click", event => {
                        event.preventDefault();
                        window.alert("這段旅程還在準備中，敬請期待。");
                    });
                }
                nav.appendChild(link);
            }
            nav.dataset.navigationReady = "true";
            nav.setAttribute("aria-label", "遊戲導覽");
        }
        nav.className = "bottom-nav";
        nav.dataset.active = active;
        nav.querySelectorAll("a").forEach(link => {
            const selected = link.dataset.destination === active;
            link.classList.toggle("active", selected);
            if (selected) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
        nav.querySelector(".notification-dot")?.remove();
        if (active === "home") {
            const dot = document.createElement("span");
            dot.className = "notification-dot";
            dot.setAttribute("aria-hidden", "true");
            nav.querySelector('[data-destination="explore"]').prepend(dot);
        }
        return nav;
    }

    function route(reference) {
        const url = new URL(reference, document.baseURI);
        const base = new URL(".", document.baseURI);
        if (url.origin !== base.origin || new URL(".", url).pathname !== base.pathname) return null;
        let name;
        let params;
        if (url.pathname === new URL("game.html", base).pathname && url.hash.startsWith("#/")) {
            const [path, query = ""] = url.hash.slice(2).split("?");
            name = path;
            params = new URLSearchParams(query);
        } else {
            name = Object.keys(scenes).find(key => url.pathname.endsWith("/" + scenes[key].page));
            params = new URLSearchParams(url.search);
        }
        if (!Object.hasOwn(scenes, name)) return null;
        // 只保留遊戲支援的參數，不把任意 hash 當成檔案或程式載入。
        const query = new URLSearchParams();
        if (["explore", "diary"].includes(name) && params.get("station") === "ruisui") query.set("station", "ruisui");
        if (name === "diary") {
            if (["aming", "player"].includes(params.get("tab"))) query.set("tab", params.get("tab"));
            if (params.get("memories") === "1") query.set("memories", "1");
        }
        if (name === "event") {
            if (["photo", "race"].includes(params.get("activity"))) query.set("activity", params.get("activity"));
            else if (["photo", "race"].includes(params.get("category"))) query.set("category", params.get("category"));
        }
        const suffix = query.size ? "?" + query : "";
        return { name, url: scenes[name].page + suffix, hash: "#/" + name + suffix };
    }

    window.GameNavigation = Object.freeze({
        scenes,
        route,
        render,
        create(active) {
            const nav = document.createElement("nav");
            nav.dataset.gameNav = "";
            return render(nav, active);
        }
    });
    document.querySelectorAll("[data-game-nav]").forEach(nav => render(nav, nav.dataset.active));
})();
