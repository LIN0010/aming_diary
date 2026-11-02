/* 導覽項目與新舊入口的網址轉換，共用同一份定義。 */
(() => {
    "use strict";
    // 共用可視高度與手機直向提示；不縮放場景座標。
    const viewport=window.visualViewport;
    const phone=/iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent)||navigator.userAgentData?.mobile===true;
    const portrait=matchMedia('(orientation: portrait)');
    const prompt=document.createElement('dialog');prompt.className='orientation-prompt';prompt.setAttribute('aria-label','請將手機橫向擺放');
    prompt.innerHTML='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="19" y="8" width="26" height="48" rx="4"/><path d="M28 13h8M29 50h6M10 22a24 24 0 0 1 38-11M48 5v7h-7"/></svg><p>請將手機橫向擺放</p><small>轉動手機，繼續阿明的旅程</small>';
    document.body.append(prompt);prompt.addEventListener('cancel',e=>e.preventDefault());
    function updateViewport(){
        const editing=document.activeElement?.matches('input:not([type=button]):not([type=submit]),textarea,[contenteditable=true]');
        if(!editing&&(!viewport||viewport.scale===1))document.documentElement.style.setProperty('--game-height',`${Math.round(viewport?.height||innerHeight)}px`);
        if(phone&&portrait.matches){if(!prompt.open)prompt.showModal();}
        else if(prompt.open)prompt.close();
        const compact=phone&&!portrait.matches,changed=document.documentElement.classList.contains('mobile-nav')!==compact;
        document.documentElement.classList.toggle('mobile-nav',compact);
        if(changed)document.querySelectorAll('[data-navigation-ready]').forEach(nav=>setExpanded(nav,false));
    }
    window.addEventListener('resize',updateViewport);viewport?.addEventListener('resize',updateViewport);window.addEventListener('pageshow',updateViewport);portrait.addEventListener('change',updateViewport);document.addEventListener('focusout',()=>requestAnimationFrame(updateViewport));updateViewport();
    const scenes = Object.freeze({
        home: Object.freeze({ page: "home.html", root: "home-screen", style: "css/home.css", title: "尋軌：阿明的日記" }),
        explore: Object.freeze({ page: "explore.html", root: "explore-screen", style: "css/explore.css", title: "鐵道探索｜尋軌" }),
        group: Object.freeze({ page: "group.html", root: "group-screen", style: "css/guild.css", title: "旅團小屋｜尋軌" }),
        event: Object.freeze({ page: "event.html", root: "event-screen", style: "css/event.css", title: "期間限定活動｜尋軌" }),
        diary: Object.freeze({ page: "diary.html", root: "diary-screen", style: "css/diary.css", title: "阿明的日記｜尋軌" })
    });
    // Lucide Icons (ISC): house, train-front, book-open, ticket, users-round.
    const icons={"house": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" />\n  <path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />", "train-front": "<path d=\"M8 3.1V7a4 4 0 0 0 8 0V3.1\" />\n  <path d=\"m9 15-1-1\" />\n  <path d=\"m15 15 1-1\" />\n  <path d=\"M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z\" />\n  <path d=\"m8 19-2 3\" />\n  <path d=\"m16 19 2 3\" />", "book-open": "<path d=\"M12 5v16\" />\n  <path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\" />", "ticket": "<path d=\"M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z\" />\n  <path d=\"M13 5v2\" />\n  <path d=\"M13 17v2\" />\n  <path d=\"M13 11v2\" />", "users-round": "<path d=\"M18 21a8 8 0 0 0-16 0\" />\n  <circle cx=\"10\" cy=\"8\" r=\"5\" />\n  <path d=\"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3\" />"};
    const items = [
        ["home", "home.html", "house", "首頁"],
        ["explore", "explore.html", "train-front", "探索"],
        ["diary", "diary.html", "book-open", "日記"],
        ["event", "event.html", "ticket", "活動"],
        ["group", "group.html", "users-round", "旅團"]
    ];

    let navSequence=0;
    function setExpanded(nav,open){
        const button=nav.querySelector('.nav-toggle'),options=nav.querySelector('.nav-options');if(!button||!options)return;
        const compact=phone&&!portrait.matches;
        nav.dataset.expanded=String(compact&&open);button.hidden=!compact;button.setAttribute('aria-expanded',String(compact&&open));
        options.inert=compact&&!open;options.setAttribute('aria-hidden',String(compact&&!open));
        options.querySelectorAll('a').forEach(link=>{if(compact&&!open)link.tabIndex=-1;else link.removeAttribute('tabindex');});
    }
    document.addEventListener('pointerdown',event=>{document.querySelectorAll('[data-game-nav][data-expanded="true"]').forEach(nav=>{if(!nav.contains(event.target))setExpanded(nav,false);});});
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
                symbol.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-lucide="${icon}">${icons[icon]}</svg>`;
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
            const options=document.createElement('div');options.className='nav-options';options.id='game-nav-options-'+(++navSequence);options.append(...nav.children);
            const toggle=document.createElement('button');toggle.type='button';toggle.className='nav-toggle';toggle.setAttribute('aria-controls',options.id);toggle.setAttribute('aria-expanded','false');
            nav.append(toggle,options);
            toggle.addEventListener('click',()=>setExpanded(nav,nav.dataset.expanded!=='true'));
            nav.addEventListener('click',event=>{if(event.target.closest('a'))setExpanded(nav,false);});
            nav.addEventListener('focusout',event=>{if(!nav.contains(event.relatedTarget))setExpanded(nav,false);});
            nav.addEventListener('keydown',event=>{
                if(!phone||portrait.matches)return;
                const links=[...options.querySelectorAll('a')],index=links.indexOf(document.activeElement);
                if(event.key==='Escape'){event.preventDefault();setExpanded(nav,false);toggle.focus();return;}
                if(event.target===toggle&&event.key==='ArrowDown'){event.preventDefault();setExpanded(nav,true);options.getBoundingClientRect();Promise.all(options.getAnimations().map(a=>a.finished.catch(()=>{}))).then(()=>{if(nav.dataset.expanded==='true')(options.querySelector('[aria-current]')||links[0]).focus();});return;}
                if(index>=0&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();links[event.key==='Home'?0:event.key==='End'?links.length-1:(index+(event.key==='ArrowRight'?1:-1)+links.length)%links.length].focus();}
            });
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
        const selected=nav.querySelector('a.active'),toggle=nav.querySelector('.nav-toggle');
        toggle.replaceChildren(selected.querySelector('.nav-icon').cloneNode(true));
        const name=document.createElement('span');name.textContent=selected.querySelector('.nav-label').textContent;toggle.append(name);
        const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('viewBox','0 0 24 24');arrow.setAttribute('aria-hidden','true');arrow.innerHTML='<path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>';arrow.classList.add('nav-toggle-arrow');toggle.append(arrow);toggle.setAttribute('aria-label','遊戲導覽，目前為'+name.textContent);
        setExpanded(nav,false);
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
