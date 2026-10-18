/* 活動 Demo 獨立存檔，不改寫主線進度、心得或回憶碎片。 */
(() => {
    "use strict";
    const C = EventConfig;
    const listeners = new Set();
    const copy = value => JSON.parse(JSON.stringify(value));
    let issue = "";
    let protectedSave = false;
    function empty() {
        return { version: 1, photoId: C.photo.id, raceId: C.race.id, clockStartedAt: Date.now(), photos: [], photoJoined: false,
            team: null, answers: [], completed: [], postcard: "", claims: [] };
    }
    function validate(s) {
        const valid = s && s.version === 1 && s.photoId === C.photo.id && s.raceId === C.race.id &&
            Number.isFinite(s.clockStartedAt) && s.clockStartedAt > 0 && typeof s.photoJoined === "boolean" &&
            Array.isArray(s.photos) && s.photos.length <= C.maxPhotos &&
            s.photos.every(p => p && typeof p.id === "string" && p.id.length <= 80 && typeof p.title === "string" && p.title.length <= 60 &&
                typeof p.description === "string" && p.description.length <= 180 && typeof p.image === "string" &&
                p.image.length <= C.maxImageBytes && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.image)) &&
            new Set(s.photos.map(p => p.id)).size === s.photos.length &&
            (s.team === null || C.race.teams.some(t => t.id === s.team)) && Array.isArray(s.answers) &&
            (s.team === null ? s.answers.length === 0 : s.answers.length === C.race.questions.length) && s.answers.every(a => a === 0 || a === 1) &&
            Array.isArray(s.completed) && new Set(s.completed).size === s.completed.length &&
            s.completed.every(id => C.race.tasks.some(t => t.id === id)) && (s.team !== null || s.completed.length === 0) &&
            typeof s.postcard === "string" && s.postcard.length <= 180 && Array.isArray(s.claims) &&
            s.claims.every(id => ["pose", "frame", "collection", "participation", "personal", "winner"].includes(id));
        if (!valid) throw new Error("invalid-save");
        if (s.team !== null && s.team !== teamFor(s.answers)) throw new Error("invalid-team");
        return s;
    }
    function read() {
        try {
            const raw = localStorage.getItem(C.storageKey);
            const next = raw === null ? empty() : validate(JSON.parse(raw));
            issue = ""; protectedSave = false;
            return next;
        } catch (_) {
            protectedSave = true;
            issue = "活動存檔無法讀取，原資料已保留。請恢復瀏覽器儲存權限，或重置活動紀錄。";
            return null;
        }
    }
    let state = read() || empty();
    function notify() { listeners.forEach(fn => fn(copy(state), issue)); }
    function now() { return C.demoClock ? Date.parse(C.demoDate) + Math.max(0, Date.now() - state.clockStartedAt) : Date.now(); }
    function phase(kind) {
        const event = C[kind], time = now();
        return time < Date.parse(event.start) ? "upcoming" : time >= Date.parse(event.end) ? "ended" : "active";
    }
    function teamFor(answers) {
        return C.race.teams[answers.reduce((n, a) => n + a, 0) > answers.length / 2 ? 1 : 0].id;
    }
    function personal(s = state) { return C.race.tasks.filter(t => s.completed.includes(t.id)).reduce((sum, t) => sum + t.points, 0); }
    function teams(s = state) {
        return C.race.teams.map(t => ({ ...t, score: t.score + (s.team === t.id ? personal(s) : 0), members: t.members + (s.team === t.id ? 1 : 0) }));
    }
    function leader(s = state) {
        const [a, b] = teams(s);
        return a.score === b.score ? null : (a.score > b.score ? a.id : b.id);
    }
    function requireActive(kind) {
        if (phase(kind) !== "active") throw new Error(phase(kind) === "ended" ? "活動已結束，不能再增加進度。" : "活動尚未開始，請稍後再來。");
    }
    function unlocked(id, s = state) {
        const photoReward = C.photo.rewards.find(r => r.id === id);
        if (photoReward) return s.photoJoined && C.photo.baseCount + s.photos.length >= photoReward.at;
        if (id === "participation") return s.team !== null;
        if (id === "personal") return s.team !== null && personal(s) >= C.race.contributionThreshold;
        return id === "winner" && phase("race") === "ended" && s.team !== null && leader(s) === s.team;
    }
    function transact(change, reset = false) {
        const latest = read();
        if (!latest && !reset) { notify(); return { ok: false, message: issue }; }
        if (latest) state = latest;
        const candidate = reset ? empty() : copy(latest);
        try {
            change(candidate);
            validate(candidate);
            localStorage.setItem(C.storageKey, JSON.stringify(candidate));
            state = candidate; issue = ""; protectedSave = false; notify();
            return { ok: true };
        } catch (error) {
            issue = error instanceof DOMException || error.message === "quota exceeded"
                ? "活動紀錄未能儲存，可能空間不足或儲存被禁止；本次操作尚未完成，請重試。"
                : error.message;
            notify();
            return { ok: false, message: issue };
        }
    }
    window.EventStore = Object.freeze({
        snapshot: () => copy(state), status: () => ({ issue, protectedSave }), now, phase, personal, teams, leader, unlocked,
        subscribe(fn) { listeners.add(fn); fn(copy(state), issue); return () => listeners.delete(fn); },
        refresh() { const latest = read(); if (latest) state = latest; notify(); },
        joinPhoto: () => transact(s => { requireActive("photo"); s.photoJoined = true; }),
        submitPhoto(title, description, image) {
            return transact(s => {
                requireActive("photo");
                if (!s.photoJoined) throw new Error("請先參加攝影祭。");
                if (s.photos.length >= C.maxPhotos) throw new Error("本機相簿已滿，請先重置活動紀錄。");
                if (typeof title !== "string" || !title.trim()) throw new Error("請為照片寫一個標題。");
                if (typeof image !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > C.maxImageBytes) throw new Error("照片格式或大小不符合本機相簿限制。");
                s.photos.push({ id: "local-" + Date.now() + "-" + s.photos.length, title: title.trim().slice(0, 60), description: String(description).trim().slice(0, 180), image });
            });
        },
        assign(answers) {
            return transact(s => {
                requireActive("race");
                if (s.team !== null) throw new Error("你已完成分隊，活動中不能更換陣營。");
                if (!Array.isArray(answers) || answers.length !== C.race.questions.length || !answers.every(a => a === 0 || a === 1)) throw new Error("請完成所有測驗題目。");
                s.answers = [...answers]; s.team = teamFor(answers);
            });
        },
        completeTask(id, answer = "") {
            return transact(s => {
                requireActive("race");
                if (!s.team) throw new Error("請先完成旅行人格測驗。");
                const task = C.race.tasks.find(t => t.id === id);
                if (!task || s.completed.includes(id)) throw new Error("這個任務已完成或不存在。");
                if (id === "compass" && answer !== "east") throw new Error("再想一想：太平洋在台灣的東側。");
                if (id === "postcard" && (typeof answer !== "string" || answer.trim().length < 5)) throw new Error("請寫下至少 5 個字的旅行祝福。");
                if (id === "postcard") s.postcard = answer.trim().slice(0, 180);
                s.completed.push(id);
            });
        },
        claim(id) { return transact(s => {
            if (!unlocked(id, s)) throw new Error("尚未達成這項獎勵條件。");
            if (s.claims.includes(id)) throw new Error("這份獎勵已領取。");
            s.claims.push(id);
        }); },
        reset: () => transact(() => {}, true)
    });
    window.addEventListener("storage", event => { if (event.key === C.storageKey || event.key === null) EventStore.refresh(); });
})();
