/* 多頁共用進度。保留舊心得及無法辨識的存檔，不自動清除玩家資料。 */
(() => {
    "use strict";

    const SAVE_KEY = "aming-diary-progress";
    const LEGACY_NOTE_KEY = "ruisui-travel-note";
    const MEMORY_IDS = ["banqiao-01", "fulong-01", "tainan-01", "ruisui-01"];
    const MISSION_ID = "ruisui-cow";
    const listeners = new Set();
    const pendingNotes = {};
    let issue = "";
    let protectedSave = false;

    function emptyState() {
        return {
            version: 1,
            visitedStations: [],
            completedMissions: [],
            collectedMemories: [],
            readMemories: [],
            notes: {},
            lastScene: "home"
        };
    }

    const copy = value => JSON.parse(JSON.stringify(value));
    const union = (first, second) => [...new Set([...first, ...second])];
    const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

    function normalize(value) {
        if (!isRecord(value) || value.version !== 1) throw new Error("unknown-save");
        for (const key of ["visitedStations", "completedMissions", "collectedMemories", "readMemories"]) {
            if (!Array.isArray(value[key]) || !value[key].every(item => typeof item === "string")) {
                throw new Error("invalid-save");
            }
        }
        if (!isRecord(value.notes) || !Object.values(value.notes).every(note => typeof note === "string")) {
            throw new Error("invalid-save");
        }
        const result = emptyState();
        result.visitedStations = value.visitedStations.includes("ruisui") ? ["ruisui"] : [];
        result.collectedMemories = [...new Set(value.collectedMemories.filter(id => MEMORY_IDS.includes(id)))];
        result.readMemories = [...new Set(value.readMemories.filter(id => result.collectedMemories.includes(id)))];
        if (result.collectedMemories.includes("ruisui-01")) {
            result.completedMissions = [MISSION_ID];
            result.visitedStations = ["ruisui"];
        }
        if (Object.hasOwn(value.notes, "ruisui")) result.notes.ruisui = value.notes.ruisui;
        if (["home", "explore", "ruisui", "diary"].includes(value.lastScene)) result.lastScene = value.lastScene;
        return result;
    }

    function readStoredState() {
        let raw;
        try {
            raw = localStorage.getItem(SAVE_KEY);
        } catch (_) {
            issue = "無法讀取瀏覽器存檔；離開或重新整理頁面後，本次進度可能遺失。";
            protectedSave = true;
            return null;
        }
        if (raw === null) {
            protectedSave = false;
            return emptyState();
        }
        try {
            const parsed = JSON.parse(raw);
            if (isRecord(parsed) && parsed.version !== 1) {
                issue = "這份存檔的版本目前無法讀取，原始存檔已保留；本次進度暫時無法儲存。";
                protectedSave = true;
                return null;
            }
            const result = normalize(parsed);
            protectedSave = false;
            return result;
        } catch (_) {
            issue = "既有存檔無法讀取，原始資料已保留；本次進度暫時無法儲存。";
            protectedSave = true;
            return null;
        }
    }

    let state = readStoredState() || emptyState();
    try {
        const legacyNote = localStorage.getItem(LEGACY_NOTE_KEY);
        if (!Object.hasOwn(state.notes, "ruisui") && legacyNote !== null) {
            state.notes.ruisui = legacyNote;
            pendingNotes.ruisui = legacyNote;
        }
    } catch (_) {
        issue = "無法讀取瀏覽器存檔；離開或重新整理頁面後，本次進度可能遺失。";
    }

    function mergeStored() {
        const stored = readStoredState();
        if (!stored) return;
        for (const key of ["visitedStations", "completedMissions", "collectedMemories", "readMemories"]) {
            state[key] = union(state[key], stored[key]);
        }
        state.notes = { ...state.notes, ...stored.notes, ...pendingNotes };
    }

    function notify() {
        const warning = document.getElementById("progress-warning");
        if (warning) {
            warning.textContent = issue;
            warning.hidden = !issue;
        }
        for (const listener of listeners) listener(copy(state));
    }

    function update(change) {
        mergeStored();
        change(state);
        let saved = false;
        if (!protectedSave) {
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify(state));
                issue = "";
                for (const key of Object.keys(pendingNotes)) delete pendingNotes[key];
                saved = true;
            } catch (_) {
                issue = "無法儲存到瀏覽器；離開或重新整理頁面後，本次進度可能遺失。";
            }
        }
        notify();
        return saved;
    }

    const warning = document.createElement("div");
    warning.id = "progress-warning";
    warning.className = "progress-warning";
    warning.setAttribute("role", "status");
    warning.hidden = true;
    document.body.appendChild(warning);

    // 未完成的導覽保留原入口，避免把玩家帶到不存在的頁面。
    document.querySelectorAll(".bottom-nav a").forEach(link => {
        if (["event.html", "group.html", "#"].includes(link.getAttribute("href"))) {
            link.addEventListener("click", event => {
                event.preventDefault();
                window.alert("這段旅程還在準備中，敬請期待。");
            });
        }
    });

    window.GameProgress = Object.freeze({
        snapshot: () => copy(state),
        subscribe(listener) {
            listeners.add(listener);
            listener(copy(state));
            return () => listeners.delete(listener);
        },
        hasMemory: id => state.collectedMemories.includes(id),
        enterScene(scene) {
            if (!["home", "explore", "ruisui", "diary"].includes(scene)) return false;
            return update(current => { current.lastScene = scene; });
        },
        visitRuisui() {
            return update(current => {
                current.visitedStations = union(current.visitedStations, ["ruisui"]);
                current.lastScene = "ruisui";
            });
        },
        completeRuisui() {
            return update(current => {
                current.visitedStations = union(current.visitedStations, ["ruisui"]);
                current.completedMissions = union(current.completedMissions, [MISSION_ID]);
                current.collectedMemories = union(current.collectedMemories, ["ruisui-01"]);
            });
        },
        readMemory(id) {
            if (!state.collectedMemories.includes(id) || state.readMemories.includes(id)) return false;
            return update(current => { current.readMemories = union(current.readMemories, [id]); });
        },
        saveNote(station, note) {
            if (station !== "ruisui" || typeof note !== "string") return false;
            pendingNotes.ruisui = note;
            return update(current => { current.notes.ruisui = note; });
        }
    });

    function refresh() {
        mergeStored();
        notify();
    }
    window.addEventListener("storage", event => {
        if (event.key === SAVE_KEY || event.key === null) refresh();
    });
    window.addEventListener("pageshow", refresh);
    notify();
})();
