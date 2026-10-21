GameScenes.register("event", ctx => {
    "use strict";
    const C = EventConfig, store = EventStore;
    const content = ctx.id("ev-content"), scroller = ctx.query(".ev-scroll");
    const modal = ctx.id("ev-lightbox");
    const startModal = document.createElement("dialog");
    startModal.className = "ev-start-modal";
    startModal.setAttribute("aria-labelledby", "ev-start-title");
    startModal.innerHTML = `<p class="ev-eyebrow">READY FOR YOUR JOURNEY?</p><h2 id="ev-start-title">準備出發了嗎？</h2><p>跟著直覺完成三道旅行選擇，揭曉屬於你的陣營。</p><div class="ev-start-actions"><button type="button" class="ev-button" data-action="begin-quiz">開始測驗 →</button><button type="button" class="ev-button ev-secondary" data-action="close-start">稍後再說</button></div>`;
    ctx.root.append(startModal);
    let view = ["photo", "race"].includes(ctx.params.get("activity")) ? ctx.params.get("activity") : "home";
    let category = ctx.params.get("category") === "race" ? "race" : "photo";
    let photoSection = "submit", albumSelection = [];
    let photoData = "", photoTitle = "", photoDescription = "", fileName = "", postcard = "";
    let answers = [], preparing = false, disposed = false, fileToken = 0, messageTimer;
    let previousLeader = store.leader(), lastPhase = store.phase("photo") + store.phase("race");
    let raceStage = store.snapshot().team ? "hub" : "intro";
    let questionIndex = 0, answering = false, quizRevision = 0;
    let startPrompt = view === "race" && !store.snapshot().team && store.phase("race") === "active";
    const imageURLs = new Set();
    let activityDrag = null, activityTap = null, swipeDirection = 0;
    const activatedTouches = new WeakSet();
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
        quizRevision++; answering = false;
        raceStage = store.snapshot().team ? "hub" : "intro";
        view = next;
        if (next === "photo") photoSection = "submit";
        startPrompt = next === "race" && !store.snapshot().team && store.phase("race") === "active";
        if (view === "race") category = "race";
        route(); render(); scroller.scrollTop = 0;
        const heading = content.querySelector("h2");
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    function clock() {
        ctx.queryAll("[data-countdown]").forEach(el => { el.textContent = timeLeft(el.dataset.countdown); });
    }
    function banner(kind, hero = false, summary = "", action = "open-" + kind, label = "參加活動 →") {
        const event = C[kind];
        return `<section class="ev-banner ev-${kind} ${hero ? "ev-hero" : ""}">
            <div class="ev-banner-art" aria-label="活動主視覺"><span>${kind === "photo" ? "SPRING / 2027" : "TWO WAYS, ONE JOURNEY"}</span><div class="ev-rail" aria-hidden="true"></div></div>
            <div class="ev-banner-copy"><span class="ev-tag">${hero ? "本期推薦 · " : ""}${kind === "photo" ? "全服合作" : "陣營競賽"}</span>
            <h2>${h(event.title)}</h2><p>${h(event.introduction)}</p><div class="ev-meta"><span>${dates(kind)}</span><span class="ev-status">${phaseText(kind)}</span><span data-countdown="${kind}">${timeLeft(kind)}</span></div>
            ${summary ? `<p class="ev-pass-summary">${h(summary)}</p>` : ""}
            ${hero ? button(action, label, "", action === "start-quiz" && store.phase("race") !== "active") : ""}</div></section>`;
    }
    function home(state) {
        const summary = category === "photo" ? `${C.photo.baseCount + state.photos.length} / ${C.photo.goal} 份共同投稿` : (state.team ? `${store.teams()[0].score} : ${store.teams()[1].score} · 陣營貢獻` : "跟著旅行直覺，找到屬於你的陣營");
        return `<section class="ev-catalog"><div class="ev-carousel-heading"><span>左右滑動或點箭頭挑選活動</span></div>
            <div class="ev-carousel-row"><button type="button" class="ev-carousel-arrow" data-action="previous-activity" aria-label="上一個活動">◀</button><div id="ev-cards" class="ev-carousel" role="region" aria-roledescription="活動輪播" aria-label="左右滑動或使用方向鍵挑選活動" tabindex="0" style="--ev-slide-from:${swipeDirection * 24}px">${banner(category, true, summary)}</div><button type="button" class="ev-carousel-arrow" data-action="next-activity" aria-label="下一個活動">▶</button></div><div class="ev-carousel-dots" aria-hidden="true"><i class="${category === "photo" ? "is-active" : ""}"></i><i class="${category === "race" ? "is-active" : ""}"></i></div></section>`;
    }
    function reward(id, title, detail, state) {
        const claimed = state.claims.includes(id), unlocked = store.unlocked(id);
        return `<article class="ev-reward ${unlocked ? "is-unlocked" : ""} ${claimed ? "is-claimed" : ""}"><span class="ev-reward-mark" aria-hidden="true">${claimed ? "✓" : unlocked ? "✧" : "◇"}</span><h4>${h(title)}</h4><p>${h(detail)}</p><span class="ev-reward-state">${claimed ? "已收藏" : unlocked ? "已解鎖" : "尚未解鎖"}</span><button type="button" class="ev-button ev-secondary" data-claim="${id}"${disabled(!unlocked || claimed)}>${claimed ? "已領取" : "領取獎勵"}</button></article>`;
    }
    function sampleAlbum() {
        const photos = [...C.photo.album];
        for (let i = photos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [photos[i], photos[j]] = [photos[j], photos[i]];
        }
        const selected = photos.slice(0, 3);
        // 素材只有三張時也避免刷新後呈現完全相同的順序。
        if (selected.length > 1 && selected.every((p, i) => p.id === albumSelection[i]?.id)) selected.push(selected.shift());
        return selected;
    }
    function photoAlbum(state, own = false) {
        if (!own && !albumSelection.length) albumSelection = sampleAlbum();
        const photos = own ? [...state.photos].reverse() : albumSelection;
        return `<section class="ev-album"><div class="ev-section-heading"><h3>${own ? "我的投稿" : "全服共同相簿"}</h3>${own ? `<span>${photos.length} 張本機投稿</span>` : ""}${own ? "" : button("refresh-album", "↻ 刷新照片", "ev-secondary")}</div>
            ${own ? '<p class="ev-muted">這裡收藏你在此瀏覽器投稿的照片。點擊照片，翻開它的故事。</p>' : ""}
            ${photos.length ? `<div class="ev-photo-wall">${photos.map(p => own ? `<button type="button" class="ev-polaroid" data-photo="${h(p.id)}"><img src="${p.image}" alt="${h(p.title)}"><strong>${h(p.title)}</strong><span>${h(C.playerName)} · 本機投稿</span></button>` : `<button type="button" class="ev-polaroid" data-photo="${h(p.id)}"><span class="ev-sample ev-sample-${p.art}" aria-label="示意照片"><span>春日留影</span></span><strong>${h(p.title)}</strong><span>${h(p.name)} · 模擬旅人</span></button>`).join("")}</div>` : '<p class="ev-album-empty">還沒有照片，先到投稿區留下你的春天吧。</p>'}</section>`;
    }
    function photo(state) {
        const count = C.photo.baseCount + state.photos.length;
        const ready = store.phase("photo") === "active";
        const sections = [["submit", "投稿區"], ["tasks", "任務區"], ["album", "共同相簿區"], ["mine", "我的投稿"]];
        const pane = (id, markup) => `<div id="ev-photo-panel-${id}" class="ev-photo-panel" role="tabpanel" aria-labelledby="ev-photo-tab-${id}" tabindex="0"${photoSection === id ? "" : " hidden"}>${markup}</div>`;
        return `<div class="ev-photo-workspace"><header class="ev-photo-heading">${button("back", "← 返回活動首頁", "ev-text-button")}<h2>${h(C.photo.title)}</h2><div class="ev-meta"><span>${dates("photo")}</span><span>${phaseText("photo")}</span><span data-countdown="photo">${timeLeft("photo")}</span></div></header>
            <section class="ev-paper ev-photo-progress-area"><div class="ev-section-heading"><div><p class="ev-eyebrow">TOGETHER, WE BLOOM</p><h3>一起，把春天收集起來</h3></div><span class="ev-count" id="ev-photo-count">${count} <small>/ ${C.photo.goal} 份</small></span></div>
            <progress class="ev-progress" id="ev-photo-progress" max="${C.photo.goal}" value="${Math.min(count, C.photo.goal)}" aria-label="共同相簿投稿進度"></progress><div class="ev-milestones" aria-hidden="true">${C.photo.rewards.map(r => `<span class="${count >= r.at ? "is-unlocked" : ""}" style="left:${Math.min(98, r.at * 100 / C.photo.goal)}%" title="${h(r.name)}：${r.at} 份">${r.at}</span>`).join("")}</div><p class="ev-muted">模擬基數 ${C.photo.baseCount} 份 ＋ 本機投稿 ${state.photos.length} 份 · 達標後仍可投稿</p></section>
            <div class="ev-photo-body"><div class="ev-photo-display">
            ${pane("submit", `<section class="ev-paper" id="ev-submit-area"><div class="ev-section-heading"><h3>留下一張你的春天</h3><span>YOUR PHOTO</span></div><form id="ev-photo-form"><fieldset${disabled(!state.photoJoined || !ready)}><legend class="ev-sr-only">攝影祭投稿</legend><div class="ev-upload-grid"><div class="ev-upload-wrap"><${photoData ? 'div' : 'button type="button" data-action="pick-photo" aria-label="選擇本機照片"'} class="ev-upload"><span id="ev-file-status">${h(preparing ? "正在整理照片…" : fileName || "JPEG / PNG / WebP，來源不超過 10 MB")}</span>${photoData ? `<img class="ev-upload-preview" src="${photoData}" alt="待投稿照片預覽">` : '<span class="ev-upload-empty" aria-hidden="true">一張照片<br>留住沿途的光</span>'}${photoData ? "" : '<span class="ev-button ev-picker-label">選擇本機照片</span>'}</${photoData ? "div" : "button"}>${photoData ? '<button type="button" class="ev-remove-photo" data-action="remove-photo" aria-label="移除照片，重新選擇">×</button>' : ""}<input type="file" id="ev-photo-file" accept="image/jpeg,image/png,image/webp" aria-label="選擇照片檔案" hidden></div><div class="ev-upload-fields"><label for="ev-photo-title">照片標題</label><input id="ev-photo-title" maxlength="60" required placeholder="例如：在月台邊遇見春天" value="${h(photoTitle)}"><label for="ev-photo-description">照片裡的故事（選填）</label><textarea id="ev-photo-description" maxlength="180" rows="3" placeholder="寫下這一刻的心情…">${h(photoDescription)}</textarea><p class="ev-muted">壓縮後只保存在你的瀏覽器，不會上傳。</p><button class="ev-button" id="ev-submit-photo" type="submit"${disabled(preparing || !photoData || state.photos.length >= C.maxPhotos)}>投稿照片 →</button></div></div></fieldset></form></section>`)}
            ${pane("tasks", `<p>${state.photoJoined ? '<span class="ev-tag">✓ 已參加攝影祭</span>' : (ready ? button("open-photo", "重試開啟投稿", "ev-secondary") : `<span class="ev-tag">${phaseText("photo")}</span>`)}</p><section class="ev-paper"><div class="ev-section-heading"><h3>階段獎勵</h3><span>EVENT REWARDS</span></div><div class="ev-rewards">${C.photo.rewards.map(r => reward(r.id, r.name, `共同投稿達 ${r.at} 份 · ${r.description}`, state)).join("")}</div></section>`)}
            ${pane("album", photoAlbum(state))}
            ${pane("mine", photoAlbum(state, true))}
            </div><nav class="ev-photo-menu" role="tablist" aria-label="攝影祭功能" aria-orientation="${matchMedia("(max-width: 700px)").matches ? "horizontal" : "vertical"}">${sections.map(([id, label]) => `<button type="button" role="tab" id="ev-photo-tab-${id}" aria-controls="ev-photo-panel-${id}" aria-selected="${photoSection === id}" tabindex="${photoSection === id ? 0 : -1}" data-photo-section="${id}"><span>${label}</span><span aria-hidden="true">${photoSection === id ? "●" : "○"}</span></button>`).join("")}</nav></div></div>`;
    }
    function selectPhotoSection(next) {
        if (view !== "photo" || !["submit", "tasks", "album", "mine"].includes(next)) return;
        photoSection = next;
        ctx.queryAll("[data-photo-section]").forEach(tab => {
            const selected = tab.dataset.photoSection === next;
            tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1;
            tab.lastElementChild.textContent = selected ? "●" : "○";
            ctx.id(tab.getAttribute("aria-controls")).hidden = !selected;
        });
    }
    function raceScreen() {
        render(); scroller.scrollTop = 0;
        const heading = content.querySelector("h2");
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    function quiz() {
        const q = C.race.questions[questionIndex];
        return `${button("race-intro", "← 返回活動介紹", "ev-text-button")}<section class="ev-paper ev-quiz-stage" id="ev-quiz">
            <p class="ev-eyebrow">YOUR TRAVEL RHYTHM</p><h2>旅行風格測驗</h2>
            <div class="ev-quiz-progress"><span id="ev-question-progress">${questionIndex + 1} / ${C.race.questions.length}</span><progress class="ev-progress" value="${questionIndex + 1}" max="${C.race.questions.length}" aria-label="測驗題目進度"></progress></div>
            <h3 id="ev-question-title">${h(q.title)}</h3><p class="ev-muted">選擇最接近你的旅行直覺，選好後將前往下一題。</p>
            <div class="ev-quiz-choices" role="group" aria-labelledby="ev-question-title">${q.choices.map((choice, i) => `<button type="button" class="ev-quiz-choice ${answers[questionIndex] === i ? "is-selected" : ""}" data-answer="${i}"${disabled(answering || store.phase("race") !== "active")}><span aria-hidden="true">${i === 0 ? "A" : "B"}</span>${h(choice)}</button>`).join("")}</div>
            ${answers.length === C.race.questions.length && !answering ? button("retry-assign", "重試儲存並揭曉陣營 →") : ""}
            <p class="ev-muted">完成全部題目後才會判定陣營，分隊完成後不能自行更換。</p></section>`;
    }
    function reveal(state) {
        const t = C.race.teams.find(t => t.id === state.team);
        return `<section class="ev-team-result ev-reveal ev-race-reveal" id="ev-team-result"><span class="ev-eyebrow">YOUR JOURNEY BEGINS</span><p class="ev-result-seal" aria-hidden="true">✧</p><h2>你的旅行陣營是<br>「${h(t.name)}」</h2><p>${h(t.subtitle)}</p><p class="ev-muted">依照你的三道旅行選擇完成分隊，結果已保存。</p>${button("enter-race", "走進我的陣營 →")}</section>`;
    }
    function assignTeam() {
        if (answers.length !== C.race.questions.length || answers.some(a => a !== 0 && a !== 1)) return;
        // 先設定揭曉階段，避免存檔通知觸發 render 時提前顯示比較資訊。
        raceStage = "reveal";
        const result = store.assign(answers);
        answering = false;
        if (!result.ok) { raceStage = "quiz"; notice(result.message); }
        raceScreen();
    }
    function race(state) {
        if (!state.team) {
            if (raceStage === "quiz") return quiz();
            return `${button("back", "← 返回活動首頁", "ev-text-button")}${banner("race", true, "", "start-quiz", "開始測驗 →")}<p class="ev-race-intro-note">三道旅行選擇，找到屬於你的旅行節奏。完成測驗後揭曉陣營，再開啟活動任務。</p>`;
        }
        if (raceStage !== "hub") return reveal(state);
        const teams = store.teams(), lead = store.leader(), score = store.personal(), active = store.phase("race") === "active";
        const team = teams.find(t => t.id === state.team);
        const ranking = [...C.race.ranking.map(p => ({ ...p })), ...(team ? [{ name: C.playerName, points: score, you: true }] : [])].sort((a, b) => b.points - a.points);
        const yourRank = ranking.findIndex(p => p.you) + 1;
        return `${button("back", "← 返回活動首頁", "ev-text-button")}${banner("race")}
            <section class="ev-paper"><div class="ev-section-heading"><h3>兩種步調，同一段鐵道</h3><span class="ev-tag">貢獻比較</span></div><div class="ev-team-grid">${teams.map(t => `<article class="ev-team ev-team-${t.id} ${lead === t.id ? "is-leading" : ""}"><span class="ev-team-symbol" aria-hidden="true">${t.id === "blue" ? "↗" : "❋"}</span><span class="ev-tag">${lead === t.id ? "目前領先" : lead ? "努力追趕" : "並列"}${state.team === t.id ? " · 我的陣營" : ""}</span><h3>${h(t.name)}</h3><p>${h(t.subtitle)}</p><strong class="ev-score" data-team-score="${t.id}">${t.score}</strong><span>${t.members} 位旅人 · ${state.team === t.id ? "含你" : "模擬人數"}</span></article>`).join("")}</div>
            <div class="ev-versus" role="img" aria-label="${h(teams.map(t => t.name + ' ' + t.score + ' 分').join('，'))}"><span style="width:${teams[0].score * 100 / (teams[0].score + teams[1].score)}%"></span></div><p class="ev-leader" id="ev-leader">${lead ? teams.find(t => t.id === lead).name + (store.phase("race") === "ended" ? " 最終獲勝" : " 暫時領先") : "雙方平手"}${!active ? " · " + phaseText("race") : ""}</p></section>
            <section class="ev-paper"><div class="ev-section-heading"><div><p class="ev-eyebrow">MY CONTRIBUTION</p><h3>我的活動足跡</h3></div><strong class="ev-count" id="ev-personal-score">${score} <small>分</small></strong></div><p>${team ? h(team.name) + ` · 個人排名第 ${yourRank} 名` : "完成測驗後，開啟你的活動限定任務。"}</p><div class="ev-tasks">${C.race.tasks.map(t => {
                const done = state.completed.includes(t.id);
                return `<article class="ev-task ${done ? "is-done" : ""}"><div><span class="ev-tag">${done ? "✓ 已完成" : "活動限定"} · ＋${t.points} 分</span><h4>${h(t.name)}</h4><p>${h(t.instruction)}</p></div><div class="ev-task-control">${t.id === "compass" && !done ? '<label for="ev-direction">旅行方向</label><select id="ev-direction"><option value="">選擇方向</option><option value="west">向西</option><option value="east">向東</option><option value="north">向北</option></select>' : ""}${t.id === "postcard" && !done ? `<label for="ev-postcard">給下一位旅人的祝福</label><textarea id="ev-postcard" maxlength="180" rows="2" placeholder="願每次出發都遇見好風景…">${h(postcard)}</textarea>` : ""}<button type="button" class="ev-button ev-secondary" data-task="${t.id}"${disabled(done || !state.team || !active)}>${done ? "已記錄貢獻" : h(t.action)}</button></div></article>`;
            }).join("")}</div></section>
            <section class="ev-paper"><div class="ev-section-heading"><h3>每一位旅人，都值得紀念</h3><span>EVENT REWARDS</span></div><div class="ev-rewards">${reward("participation", "基本參與獎", C.race.rewards.participation + " · 完成分隊即可領", state)}${reward("personal", "個人貢獻獎", C.race.rewards.personal + ` · 達 ${C.race.contributionThreshold} 分`, state)}${reward("winner", "勝利陣營獎", C.race.rewards.winner + " · 活動結束後開放", state)}</div></section>
            <section class="ev-paper"><div class="ev-section-heading"><h3>旅人貢獻榜</h3><span>TRAVELER RANKING</span></div><ol class="ev-ranking">${ranking.map(p => `<li class="${p.you ? "is-you" : ""}"><span>${h(p.name)}${p.you ? " · 你" : " · 模擬"}</span><strong>${p.points} 分</strong></li>`).join("")}</ol></section>`;
    }
    function render() {
        const state = store.snapshot();
        ctx.root.classList.toggle("ev-photo-mode", view === "photo");
        content.innerHTML = view === "photo" ? photo(state) : view === "race" ? race(state) : home(state);
        if (startPrompt && (view === "race" || (view === "home" && category === "race")) && raceStage === "intro" && !state.team && store.phase("race") === "active") {
            // SPA 完成掛載後才開啟，避免換場搬移 DOM 使對話框掉出浮層。
            ctx.delay(() => {
                if (!disposed && startPrompt && (view === "race" || (view === "home" && category === "race")) && raceStage === "intro" && !store.snapshot().team && !startModal.open) startModal.showModal();
            }, 0);
        } else if (startModal.open) startModal.close();
        const warning = ctx.id("ev-storage-warning");
        warning.textContent = store.status().issue; warning.hidden = !warning.textContent;
        clock();
    }
    async function preparePhoto(file) {
        const token = ++fileToken;
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > C.maxFileBytes) { photoData = fileName = ""; preparing = false; render(); notice("請選擇 10 MB 以下的 JPEG、PNG 或 WebP 照片。"); return; }
        preparing = true; photoData = ""; fileName = file.name;
        ctx.query(".ev-upload-preview")?.remove();
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
        if (event.isTrusted && activatedTouches.has(target)) { activatedTouches.delete(target); event.preventDefault(); return; }
        if (view === "home" && target.dataset.action === "previous-activity") stepActivity(-1);
        if (view === "home" && target.dataset.action === "next-activity") stepActivity(1);
        if (target.dataset.photoSection) selectPhotoSection(target.dataset.photoSection);
        if (view === "photo" && target.dataset.action === "refresh-album") {
            albumSelection = sampleAlbum();
            ctx.id("ev-photo-panel-album").innerHTML = photoAlbum(store.snapshot());
            ctx.query('[data-action="refresh-album"]')?.focus({ preventScroll: true });
        }
        if (target.dataset.action === "remove-photo") {
            fileToken++; preparing = false; photoData = fileName = "";
            render(); ctx.query('[data-action="pick-photo"]')?.focus({ preventScroll: true });
        }
        if (target.dataset.action === "pick-photo") ctx.id("ev-photo-file").click();
        if (target.dataset.action === "open-photo") {
            if (!store.snapshot().photoJoined && store.phase("photo") === "active") {
                const result = store.joinPhoto();
                if (!result.ok) { notice(result.message); return; }
            }
            switchView("photo");
        }
        if (target.dataset.action === "open-race") {
            if (!store.snapshot().team && store.phase("race") === "active") { startPrompt = true; raceStage = "intro"; render(); }
            else switchView("race");
        }
        if (target.dataset.action === "back") switchView("home");
        if (target.dataset.action === "start-quiz" && !store.snapshot().team && store.phase("race") === "active") { startPrompt = true; render(); }
        if (target.dataset.action === "close-start") { startPrompt = false; render(); ctx.query('[data-action="start-quiz"], [data-action="open-race"]')?.focus(); }
        if (target.dataset.action === "begin-quiz" && startModal.open && !store.snapshot().team && store.phase("race") === "active") {
            startPrompt = false; quizRevision++; answers = []; questionIndex = 0; answering = false; raceStage = "quiz"; view = "race"; category = "race"; route(); raceScreen();
        }
        if (target.dataset.action === "race-intro") { quizRevision++; answering = false; raceStage = "intro"; raceScreen(); }
        if (target.dataset.action === "enter-race" && store.snapshot().team) { raceStage = "hub"; raceScreen(); }
        if (target.dataset.action === "retry-assign" && raceStage === "quiz" && !answering) assignTeam();
        if (target.dataset.answer !== undefined && raceStage === "quiz" && !answering && !store.snapshot().team && store.phase("race") === "active") {
            answers[questionIndex] = Number(target.dataset.answer); answering = true; render();
            const revision = quizRevision;
            ctx.delay(() => {
                if (disposed || revision !== quizRevision || view !== "race") return;
                if (questionIndex < C.race.questions.length - 1) { questionIndex++; answering = false; raceScreen(); }
                else assignTeam();
            }, 180);
        }
        if (target.dataset.photo) showPhoto(target.dataset.photo);
        if (target.dataset.claim) operate(store.claim(target.dataset.claim), "✓ 獎勵已加入本機活動收藏。");
        if (target.dataset.task) {
            const id = target.dataset.task, before = store.leader();
            const answer = id === "compass" ? ctx.id("ev-direction").value : id === "postcard" ? postcard : "";
            if (operate(store.completeTask(id, answer), "✓ 任務完成，個人與陣營貢獻已同步增加。") && before !== store.leader()) notice(store.leader() ? "陣營比分反超！" + C.race.teams.find(t => t.id === store.leader()).name + " 現在領先。" : "雙方貢獻追平了，下一次行動可能改變領先！");
        }
    });
    function stepActivity(direction) { selectActivity(category === "photo" ? "race" : "photo", direction); }
    function selectActivity(next, direction = next === "race" ? 1 : -1) {
        if (category === next) return;
        swipeDirection = direction;
        category = next; route(); render(); ctx.id("ev-cards")?.focus({ preventScroll: true });
    }
    ctx.on(ctx.root, "keydown", event => {
        const tab = event.target.closest("[data-photo-section]");
        if (view === "photo" && tab && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const ids = ["submit", "tasks", "album", "mine"], index = ids.indexOf(photoSection);
            selectPhotoSection(event.key === "Home" ? ids[0] : event.key === "End" ? ids[ids.length - 1] : ids[(index + (["ArrowUp", "ArrowLeft"].includes(event.key) ? ids.length - 1 : 1)) % ids.length]);
            ctx.id("ev-photo-tab-" + photoSection).focus();
        }

        if (view === "home" && event.target.closest("#ev-cards") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            if (["Home", "End"].includes(event.key)) selectActivity(event.key === "End" ? "race" : "photo");
            else stepActivity(event.key === "ArrowRight" ? 1 : -1);
        }
    });
    ctx.on(ctx.root, "pointerdown", event => {
        const carousel = event.target.closest("#ev-cards");
        if (view !== "home" || !carousel || !event.isPrimary || event.button !== 0) return;
        const control = event.target.closest("button, input, a");
        if (control) {
            if (event.pointerType === "touch" && control.matches("button")) activityTap = { id: event.pointerId, button: control, x: event.clientX, y: event.clientY };
            return;
        }
        activityDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY };
        carousel.setPointerCapture(event.pointerId);
    });
    ctx.on(ctx.root, "pointermove", event => {
        if (!activityDrag || activityDrag.id !== event.pointerId) return;
        activityDrag.lastX = event.clientX; activityDrag.lastY = event.clientY;
        const dx = event.clientX - activityDrag.x, dy = event.clientY - activityDrag.y;
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            const card = ctx.query("#ev-cards .ev-banner");
            if (card) card.style.transform = `translateX(${Math.max(-60, Math.min(60, dx * .25))}px)`;
        }
    });
    ctx.on(window, "pointerup", event => {
        // 手機滑動後的第一下按鈕觸控直接處理，避免相容 click 被瀏覽器抑制。
        if (activityTap?.id === event.pointerId) {
            const tap = activityTap; activityTap = null;
            if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 12 && tap.button.isConnected && !tap.button.disabled) {
                activatedTouches.add(tap.button); tap.button.click();
            }
        }
        if (!activityDrag || activityDrag.id !== event.pointerId) return;
        const dx = event.clientX - activityDrag.x, dy = event.clientY - activityDrag.y;
        activityDrag = null;
        const card = ctx.query("#ev-cards .ev-banner"); if (card) card.style.transform = "";
        if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            // 觸控結束事件完成後再換 DOM，避免吞掉後續點擊。
            ctx.delay(() => { if (view === "home") stepActivity(dx < 0 ? 1 : -1); }, 0);
        }
    });
    for (const type of ["pointercancel", "blur"]) ctx.on(window, type, () => {
        activityDrag = activityTap = null; const card = ctx.query("#ev-cards .ev-banner"); if (card) card.style.transform = "";
    });
    ctx.on(ctx.root, "input", event => {
        if (event.target.id === "ev-photo-title") photoTitle = event.target.value;
        if (event.target.id === "ev-photo-description") photoDescription = event.target.value;
        if (event.target.id === "ev-postcard") postcard = event.target.value;
    });
    ctx.on(ctx.root, "change", event => { if (event.target.id === "ev-photo-file") preparePhoto(event.target.files[0]); });
    ctx.on(ctx.root, "submit", event => {
        event.preventDefault();
        if (event.target.id === "ev-photo-form") {
            if (preparing || !photoData) { notice("請先選擇並等待照片整理完成。"); return; }
            if (operate(store.submitPhoto(photoTitle, photoDescription, photoData), "✓ 投稿成功！共同相簿與合作進度已更新。")) { photoData = photoTitle = photoDescription = fileName = ""; render(); }
        }

    });
    ctx.on(startModal, "cancel", event => { event.preventDefault(); startPrompt = false; render(); ctx.query('[data-action="start-quiz"], [data-action="open-race"]')?.focus(); });
    ctx.on(ctx.id("ev-lightbox-close"), "click", () => modal.close());
    ctx.on(modal, "click", event => { if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close(); } });
    // 獨立詳情網址也直接開放投稿，不要求第二次參加。
    if (view === "photo" && !store.snapshot().photoJoined && store.phase("photo") === "active") store.joinPhoto();
    const unsubscribe = store.subscribe(() => {
        const leader = store.leader();
        if (previousLeader && leader && previousLeader !== leader) ctx.root.classList.add("ev-lead-change");
        previousLeader = leader; render();
    });
    ctx.cleanup(unsubscribe);
    ctx.cleanup(() => { disposed = true; fileToken++; imageURLs.forEach(url => URL.revokeObjectURL(url)); imageURLs.clear(); if (modal.open) modal.close(); if (startModal.open) startModal.close(); startModal.remove(); });
    function tick() {
        clock(); const phases = store.phase("photo") + store.phase("race");
        if (phases !== lastPhase) { lastPhase = phases; render(); }
        ctx.delay(tick, 10000);
    }
    route(); tick();
});
