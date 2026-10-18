GameScenes.register("event", ctx => {
    "use strict";
    const C = EventConfig, store = EventStore;
    const content = ctx.id("ev-content"), scroller = ctx.query(".ev-scroll");
    const modal = ctx.id("ev-lightbox");
    let view = ["photo", "race"].includes(ctx.params.get("activity")) ? ctx.params.get("activity") : "home";
    let category = ctx.params.get("category") === "race" ? "race" : "photo";
    let photoData = "", photoTitle = "", photoDescription = "", fileName = "", postcard = "";
    let answers = [], preparing = false, disposed = false, fileToken = 0, messageTimer;
    let previousLeader = store.leader(), lastPhase = store.phase("photo") + store.phase("race");
    let resultTeam = null;
    const imageURLs = new Set();
    const h = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const disabled = value => value ? " disabled" : "";
    const phaseText = kind => ({ active: "活動進行中", upcoming: "即將開始", ended: "活動已結束" })[store.phase(kind)];
    const fmtDate = value => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit" }).format(new Date(value));
    const dates = kind => fmtDate(C[kind].start) + " — " + fmtDate(C[kind].end);
    const button = (action, text, extra = "", off = false) => `<button type="button" class="ev-button ${extra}" data-action="${action}"${disabled(off)}>${h(text)}</button>`;
    function timeLeft(kind) {
        if (store.phase(kind) === "ended") return "活動已結束";
        const end = Date.parse(store.phase(kind) === "upcoming" ? C[kind].start : C[kind].end);
        const seconds = Math.max(0, Math.floor((end - store.now()) / 1000));
        return `${store.phase(kind) === "upcoming" ? "距開始" : "剩餘"} ${Math.floor(seconds / 86400)} 天 ${Math.floor(seconds / 3600) % 24} 時 ${Math.floor(seconds / 60) % 60} 分`;
    }
    function notice(text) {
        ctx.cancelTimer(messageTimer);
        ctx.id("ev-message").textContent = text;
        ctx.id("ev-message").hidden = false;
        messageTimer = ctx.delay(() => { ctx.id("ev-message").hidden = true; }, 5000);
    }
    function operate(result, text) { notice(result.ok ? text : result.message); return result.ok; }
    function route() {
        ctx.replaceRoute(view === "home" ? "event.html?category=" + category : "event.html?activity=" + view);
    }
    function switchView(next) {
        fileToken++; preparing = false;
        view = next;
        if (view === "race") category = "race";
        route(); render(); scroller.scrollTop = 0;
        const heading = content.querySelector("h2");
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    function clock() {
        const display = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(store.now()));
        ctx.id("ev-clock").textContent = (C.demoClock ? "活動日曆：" : "台灣日期：") + display;
        ctx.queryAll("[data-countdown]").forEach(el => { el.textContent = timeLeft(el.dataset.countdown); });
    }
    function banner(kind, hero = false, summary = "") {
        const event = C[kind];
        return `<section class="ev-banner ev-${kind} ${hero ? "ev-hero" : ""}">
            <div class="ev-banner-art" aria-label="活動主視覺"><span>${kind === "photo" ? "SPRING / 2027" : "TWO WAYS, ONE JOURNEY"}</span><div class="ev-rail" aria-hidden="true"></div></div>
            <div class="ev-banner-copy"><span class="ev-tag">${hero ? "本期推薦 · " : ""}${kind === "photo" ? "全服合作" : "陣營競賽"}</span>
            <h2>${h(event.title)}</h2><p>${h(event.introduction)}</p><div class="ev-meta"><span>${dates(kind)}</span><span class="ev-status">${phaseText(kind)}</span><span data-countdown="${kind}">${timeLeft(kind)}</span></div>
            ${summary ? `<p class="ev-pass-summary">${h(summary)}</p>` : ""}
            ${hero ? button("open-" + kind, "參加活動 →") : ""}</div></section>`;
    }
    function home(state) {
        const summary = category === "photo" ? `${C.photo.baseCount + state.photos.length} / ${C.photo.goal} 份共同投稿` : `${store.teams()[0].score} : ${store.teams()[1].score} · 陣營貢獻`;
        return `<section class="ev-catalog">
            <div class="ev-tabs" role="tablist" aria-label="活動分類"><button type="button" role="tab" id="ev-tab-photo" aria-selected="${category === "photo"}" aria-controls="ev-cards" tabindex="${category === "photo" ? 0 : -1}" data-category="photo">全服合作</button><button type="button" role="tab" id="ev-tab-race" aria-selected="${category === "race"}" aria-controls="ev-cards" tabindex="${category === "race" ? 0 : -1}" data-category="race">陣營競賽</button></div>
            <div id="ev-cards" role="tabpanel" aria-labelledby="ev-tab-${category}">${banner(category, true, summary)}</div></section>`;
    }
    function reward(id, title, detail, state) {
        const claimed = state.claims.includes(id), unlocked = store.unlocked(id);
        return `<article class="ev-reward ${unlocked ? "is-unlocked" : ""} ${claimed ? "is-claimed" : ""}"><span class="ev-reward-mark" aria-hidden="true">${claimed ? "✓" : unlocked ? "✧" : "◇"}</span><h4>${h(title)}</h4><p>${h(detail)}</p><span class="ev-reward-state">${claimed ? "已收藏" : unlocked ? "已解鎖" : "尚未解鎖"}</span><button type="button" class="ev-button ev-secondary" data-claim="${id}"${disabled(!unlocked || claimed)}>${claimed ? "已領取" : "領取獎勵"}</button></article>`;
    }
    function photo(state) {
        const count = C.photo.baseCount + state.photos.length;
        const ready = store.phase("photo") === "active";
        return `${button("back", "← 返回活動首頁", "ev-text-button")}${banner("photo")}
            <details class="ev-rules"><summary>攝影祭規則與投稿說明</summary><p>先參加活動，再選擇一張自己的照片投稿。每次成功保存增加 1 份共同投稿，不以瀏覽或重複領獎加分。起始 ${C.photo.baseCount} 份為模擬基數，下方只展示其中幾張 示意照片；沒有真實玩家連線或圖片上傳。</p><p>獎勵須參加後解鎖並領取，僅作本機收藏展示。每張照片會縮圖壓縮，本機最多 ${C.maxPhotos} 張。請只使用可分享的照片；重置活動紀錄只清除活動資料。</p></details>
            <section class="ev-paper"><div class="ev-section-heading"><div><p class="ev-eyebrow">TOGETHER, WE BLOOM</p><h3>一起，把春天收集起來</h3></div><span class="ev-count" id="ev-photo-count">${count} <small>/ ${C.photo.goal} 份</small></span></div>
            <progress class="ev-progress" id="ev-photo-progress" max="${C.photo.goal}" value="${Math.min(count, C.photo.goal)}" aria-label="共同相簿投稿進度"></progress><div class="ev-milestones" aria-hidden="true">${C.photo.rewards.map(r => `<span class="${count >= r.at ? "is-unlocked" : ""}" style="left:${Math.min(98, r.at * 100 / C.photo.goal)}%" title="${h(r.name)}：${r.at} 份">${r.at}</span>`).join("")}</div><p class="ev-muted">模擬基數 ${C.photo.baseCount} 份 ＋ 本機投稿 ${state.photos.length} 份 · 達標後仍可投稿</p>
            <div class="ev-rewards">${C.photo.rewards.map(r => reward(r.id, r.name, `共同投稿達 ${r.at} 份 · ${r.description}`, state)).join("")}</div></section>
            <section class="ev-theme"><span class="ev-eyebrow">本期攝影主題</span><h3>${h(C.photo.theme)}</h3><p>${h(C.photo.themeDescription)}</p>${state.photoJoined ? '<span class="ev-tag">✓ 已參加攝影祭</span>' : button("join-photo", "加入這次共同攝影", "", !ready)}</section>
            <section class="ev-paper" id="ev-submit-area"><div class="ev-section-heading"><h3>留下一張你的春天</h3><span>YOUR PHOTO</span></div><form id="ev-photo-form"><fieldset${disabled(!state.photoJoined || !ready)}><legend class="ev-sr-only">攝影祭投稿</legend><div class="ev-upload-grid"><div class="ev-upload"><label for="ev-photo-file">＋ 選擇本機照片</label><input type="file" id="ev-photo-file" accept="image/jpeg,image/png,image/webp"><p id="ev-file-status">${h(preparing ? "正在整理照片…" : fileName || "JPEG / PNG / WebP，來源不超過 10 MB")}</p>${photoData ? `<img class="ev-upload-preview" src="${photoData}" alt="待投稿照片預覽">` : '<div class="ev-upload-empty" aria-hidden="true">一張照片<br>留住沿途的光</div>'}</div><div class="ev-upload-fields"><label for="ev-photo-title">照片標題</label><input id="ev-photo-title" maxlength="60" required placeholder="例如：在月台邊遇見春天" value="${h(photoTitle)}"><label for="ev-photo-description">照片裡的故事（選填）</label><textarea id="ev-photo-description" maxlength="180" rows="3" placeholder="寫下這一刻的心情…">${h(photoDescription)}</textarea><p class="ev-muted">壓縮後只保存在你的瀏覽器，不會上傳。</p><button class="ev-button" id="ev-submit-photo" type="submit"${disabled(preparing || !photoData || state.photos.length >= C.maxPhotos)}>投稿照片 →</button></div></div></fieldset></form></section>
            <section class="ev-album"><div class="ev-section-heading"><h3>全服共同相簿</h3><span>${state.photos.length + C.photo.album.length} 張展示照片</span></div><p class="ev-muted">這面照片牆由模擬旅人卡片與你的本機投稿組成。點擊照片，翻開它的故事。</p><div class="ev-photo-wall">${[...state.photos].reverse().map(p => `<button type="button" class="ev-polaroid" data-photo="${h(p.id)}"><img src="${p.image}" alt="${h(p.title)}"><strong>${h(p.title)}</strong><span>${h(C.playerName)} · 本機投稿</span></button>`).join("")}${C.photo.album.map(p => `<button type="button" class="ev-polaroid" data-photo="${p.id}"><span class="ev-sample ev-sample-${p.art}" aria-label="示意照片"><span>春日留影</span></span><strong>${h(p.title)}</strong><span>${h(p.name)} · 模擬旅人</span></button>`).join("")}</div></section>`;
    }
    function quiz(state) {
        if (state.team) {
            const t = C.race.teams.find(t => t.id === state.team);
            return `<section class="ev-team-result ${resultTeam ? "ev-reveal" : ""}" id="ev-team-result"><span class="ev-eyebrow">你的旅行人格・${resultTeam ? "分隊完成" : "已固定分隊"}</span><h3>歡迎登上「${h(t.name)}」</h3><p>${h(t.subtitle)}</p><span class="ev-muted">依測驗結果分配，活動期間不能自行選擇或更換陣營。</span></section>`;
        }
        return `<section class="ev-paper"><div class="ev-section-heading"><h3>先找到你的旅行節奏</h3><span>TRAVEL QUIZ · ${C.race.questions.length} 題</span></div><p>跟著直覺選擇。系統會依答案分隊，完成後不能自行更換。</p><form id="ev-quiz"><fieldset${disabled(store.phase("race") !== "active")}><legend class="ev-sr-only">旅行人格測驗</legend>${C.race.questions.map((q, i) => `<fieldset class="ev-question"><legend>${i + 1}. ${h(q.title)}</legend>${q.choices.map((choice, j) => `<label><input type="radio" name="ev-answer-${i}" value="${j}" required${answers[i] === j ? " checked" : ""}>${h(choice)}</label>`).join("")}</fieldset>`).join("")}<button type="submit" class="ev-button">完成測驗，揭曉我的陣營 →</button></fieldset></form></section>`;
    }
    function race(state) {
        const teams = store.teams(), lead = store.leader(), score = store.personal(), active = store.phase("race") === "active";
        const team = teams.find(t => t.id === state.team);
        const ranking = [...C.race.ranking.map(p => ({ ...p })), ...(team ? [{ name: C.playerName, points: score, you: true }] : [])].sort((a, b) => b.points - a.points);
        const yourRank = ranking.findIndex(p => p.you) + 1;
        return `${button("back", "← 返回活動首頁", "ev-text-button")}${banner("race")}
            <details class="ev-rules"><summary>陣營競賽規則與獎勵方式</summary><p>完成 ${C.race.questions.length} 題測驗後，依答案多數分到對應旅行陣營。不自選、不換隊、不自動平衡。每個活動任務只能加分一次，個人貢獻同步加入所屬陣營。</p><p>所有完成分隊的旅人都能領參與獎；個人累積 ${C.race.contributionThreshold} 分再得加碼獎。活動結束時才確定勝方並開放勝方獎勵，平手則不發勝方獎。敗方保留參與及個人獎勵。</p><p>對手、起始人數及排名皆為固定模擬資料；沒有即時玩家對戰。</p></details>
            <section class="ev-paper"><div class="ev-section-heading"><h3>兩種步調，同一段鐵道</h3><span class="ev-tag">貢獻比較</span></div><div class="ev-team-grid">${teams.map(t => `<article class="ev-team ev-team-${t.id} ${lead === t.id ? "is-leading" : ""}"><span class="ev-team-symbol" aria-hidden="true">${t.id === "blue" ? "↗" : "❋"}</span><span class="ev-tag">${lead === t.id ? "目前領先" : lead ? "努力追趕" : "並列"}${state.team === t.id ? " · 我的陣營" : ""}</span><h3>${h(t.name)}</h3><p>${h(t.subtitle)}</p><strong class="ev-score" data-team-score="${t.id}">${t.score}</strong><span>${t.members} 位旅人 · ${state.team === t.id ? "含你" : "模擬人數"}</span></article>`).join("")}</div>
            <div class="ev-versus" role="img" aria-label="${h(teams.map(t => t.name + ' ' + t.score + ' 分').join('，'))}"><span style="width:${teams[0].score * 100 / (teams[0].score + teams[1].score)}%"></span></div><p class="ev-leader" id="ev-leader">${lead ? teams.find(t => t.id === lead).name + (store.phase("race") === "ended" ? " 最終獲勝" : " 暫時領先") : "雙方平手"}${!active ? " · " + phaseText("race") : ""}</p></section>
            ${quiz(state)}<section class="ev-paper"><div class="ev-section-heading"><div><p class="ev-eyebrow">MY CONTRIBUTION</p><h3>我的活動足跡</h3></div><strong class="ev-count" id="ev-personal-score">${score} <small>分</small></strong></div><p>${team ? h(team.name) + ` · 個人排名第 ${yourRank} 名` : "完成測驗後，開啟你的活動限定任務。"}</p><div class="ev-tasks">${C.race.tasks.map(t => {
                const done = state.completed.includes(t.id);
                return `<article class="ev-task ${done ? "is-done" : ""}"><div><span class="ev-tag">${done ? "✓ 已完成" : "活動限定"} · ＋${t.points} 分</span><h4>${h(t.name)}</h4><p>${h(t.instruction)}</p></div><div class="ev-task-control">${t.id === "compass" && !done ? '<label for="ev-direction">旅行方向</label><select id="ev-direction"><option value="">選擇方向</option><option value="west">向西</option><option value="east">向東</option><option value="north">向北</option></select>' : ""}${t.id === "postcard" && !done ? `<label for="ev-postcard">給下一位旅人的祝福</label><textarea id="ev-postcard" maxlength="180" rows="2" placeholder="願每次出發都遇見好風景…">${h(postcard)}</textarea>` : ""}<button type="button" class="ev-button ev-secondary" data-task="${t.id}"${disabled(done || !state.team || !active)}>${done ? "已記錄貢獻" : h(t.action)}</button></div></article>`;
            }).join("")}</div></section>
            <section class="ev-paper"><div class="ev-section-heading"><h3>每一位旅人，都值得紀念</h3><span>EVENT REWARDS</span></div><div class="ev-rewards">${reward("participation", "基本參與獎", C.race.rewards.participation + " · 完成分隊即可領", state)}${reward("personal", "個人貢獻獎", C.race.rewards.personal + ` · 達 ${C.race.contributionThreshold} 分`, state)}${reward("winner", "勝利陣營獎", C.race.rewards.winner + " · 活動結束後開放", state)}</div></section>
            <section class="ev-paper"><div class="ev-section-heading"><h3>旅人貢獻榜</h3><span>TRAVELER RANKING</span></div><ol class="ev-ranking">${ranking.map(p => `<li class="${p.you ? "is-you" : ""}"><span>${h(p.name)}${p.you ? " · 你" : " · 模擬"}</span><strong>${p.points} 分</strong></li>`).join("")}</ol></section>`;
    }
    function render() {
        const state = store.snapshot();
        content.innerHTML = view === "photo" ? photo(state) : view === "race" ? race(state) : home(state);
        const warning = ctx.id("ev-storage-warning");
        warning.textContent = store.status().issue; warning.hidden = !warning.textContent;
        clock();
    }
    async function preparePhoto(file) {
        const token = ++fileToken;
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > C.maxFileBytes) { photoData = fileName = ""; preparing = false; render(); notice("請選擇 10 MB 以下的 JPEG、PNG 或 WebP 照片。"); return; }
        preparing = true; photoData = ""; fileName = file.name;
        const submit = ctx.id("ev-submit-photo"); if (submit) submit.disabled = true;
        ctx.id("ev-file-status").textContent = "正在整理照片…";
        const url = URL.createObjectURL(file);
        imageURLs.add(url);
        try {
            const image = new Image(); image.src = url; await image.decode();
            if (disposed || token !== fileToken) return;
            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const painter = canvas.getContext("2d"); painter.fillStyle = "#fff8ed"; painter.fillRect(0, 0, canvas.width, canvas.height); painter.drawImage(image, 0, 0, canvas.width, canvas.height);
            let encoded = canvas.toDataURL("image/jpeg", .8);
            if (encoded.length > C.maxImageBytes) encoded = canvas.toDataURL("image/jpeg", .45);
            if (encoded.length > C.maxImageBytes) throw new Error("照片內容較複雜，請換一張較小的圖片。");
            photoData = encoded;
        } catch (error) { if (!disposed && token === fileToken) { fileName = ""; notice(error.message.includes("照片") ? error.message : "這張圖片無法解碼，請重新選擇。"); } }
        finally { URL.revokeObjectURL(url); imageURLs.delete(url); if (!disposed && token === fileToken) { preparing = false; render(); } }
    }
    function showPhoto(id) {
        const state = store.snapshot();
        const photo = state.photos.find(p => p.id === id), sample = C.photo.album.find(p => p.id === id);
        if (!photo && !sample) return;
        ctx.id("ev-lightbox-image").innerHTML = photo ? `<img src="${photo.image}" alt="${h(photo.title)}">` : `<div class="ev-sample ev-sample-${sample.art}"><span>示意照片</span></div>`;
        ctx.id("ev-lightbox-title").textContent = (photo || sample).title;
        ctx.id("ev-lightbox-description").textContent = photo ? (photo.description || "一段來自你的本機旅行紀錄。") : `${sample.name} · 模擬旅人，此封面為 CSS 佔位區。`;
        modal.showModal();
    }
    ctx.on(ctx.root, "click", event => {
        const target = event.target.closest("button"); if (!target || target.disabled) return;
        if (target.dataset.category) { category = target.dataset.category; route(); render(); ctx.id("ev-tab-" + category).focus(); }
        if (target.dataset.action === "open-photo") switchView("photo");
        if (target.dataset.action === "open-race") switchView("race");
        if (target.dataset.action === "back") switchView("home");
        if (target.dataset.action === "join-photo") { if (operate(store.joinPhoto(), "已加入攝影祭，一起收藏春天吧。")) ctx.id("ev-submit-area").scrollIntoView({ behavior: "smooth", block: "start" }); }
        if (target.dataset.photo) showPhoto(target.dataset.photo);
        if (target.dataset.claim) operate(store.claim(target.dataset.claim), "✓ 獎勵已加入本機活動收藏。");
        if (target.dataset.task) {
            const id = target.dataset.task, before = store.leader();
            const answer = id === "compass" ? ctx.id("ev-direction").value : id === "postcard" ? postcard : "";
            if (operate(store.completeTask(id, answer), "✓ 任務完成，個人與陣營貢獻已同步增加。") && before !== store.leader()) notice(store.leader() ? "陣營比分反超！" + C.race.teams.find(t => t.id === store.leader()).name + " 現在領先。" : "雙方貢獻追平了，下一次行動可能改變領先！");
        }
    });
    ctx.on(ctx.root, "keydown", event => {
        if (event.target.matches('[role="tab"]') && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault(); category = event.key === "Home" ? "photo" : event.key === "End" ? "race" : category === "photo" ? "race" : "photo";
            route(); render(); ctx.id("ev-tab-" + category).focus();
        }
    });
    ctx.on(ctx.root, "input", event => {
        if (event.target.id === "ev-photo-title") photoTitle = event.target.value;
        if (event.target.id === "ev-photo-description") photoDescription = event.target.value;
        if (event.target.id === "ev-postcard") postcard = event.target.value;
        if (event.target.name?.startsWith("ev-answer-")) answers[Number(event.target.name.slice(10))] = Number(event.target.value);
    });
    ctx.on(ctx.root, "change", event => { if (event.target.id === "ev-photo-file") preparePhoto(event.target.files[0]); });
    ctx.on(ctx.root, "submit", event => {
        event.preventDefault();
        if (event.target.id === "ev-photo-form") {
            if (preparing || !photoData) { notice("請先選擇並等待照片整理完成。"); return; }
            if (operate(store.submitPhoto(photoTitle, photoDescription, photoData), "✓ 投稿成功！共同相簿與合作進度已更新。")) { photoData = photoTitle = photoDescription = fileName = ""; render(); }
        }
        if (event.target.id === "ev-quiz") {
            const data = new FormData(event.target);
            const values = C.race.questions.map((_, i) => data.has("ev-answer-" + i) ? Number(data.get("ev-answer-" + i)) : NaN);
            if (operate(store.assign(values), "分隊完成！歡迎加入這次鐵道旅程。")) { resultTeam = store.snapshot().team; render(); }
        }
    });
    ctx.on(ctx.id("ev-lightbox-close"), "click", () => modal.close());
    ctx.on(modal, "click", event => { if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close(); } });
    ctx.on(ctx.id("ev-reset"), "click", () => {
        if (!window.confirm("重置本機活動紀錄？這會清除活動投稿、分隊與獎勵，主線遊戲、日記和回憶碎片不受影響。")) return;
        if (operate(store.reset(), "活動紀錄已重置，主線資料保留。")) { photoData = photoTitle = photoDescription = fileName = postcard = ""; answers = []; resultTeam = null; fileToken++; preparing = false; render(); }
    });
    const unsubscribe = store.subscribe(() => {
        const leader = store.leader();
        if (previousLeader && leader && previousLeader !== leader) ctx.root.classList.add("ev-lead-change");
        previousLeader = leader; render();
    });
    ctx.cleanup(unsubscribe);
    ctx.cleanup(() => { disposed = true; fileToken++; imageURLs.forEach(url => URL.revokeObjectURL(url)); imageURLs.clear(); if (modal.open) modal.close(); });
    function tick() {
        clock(); const phases = store.phase("photo") + store.phase("race");
        if (phases !== lastPhase) { lastPhase = phases; render(); }
        ctx.delay(tick, 10000);
    }
    route(); tick();
});
