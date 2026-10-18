GameScenes.register("diary", ctx => {
const memoryCount =
    ctx.id("memory-count");

const memoryDrawer =
    ctx.id("memory-drawer");

const memoryOverlay =
    ctx.id("memory-overlay");

const closeMemory =
    ctx.id("close-memory");

const travelNote =
    ctx.id("travel-note");

const saveTravel =
    ctx.id("save-travel");

const savedMessage =
    document.createElement("div");
	
const amingTab =
    ctx.id("aming-tab");

const playerTab =
    ctx.id("player-tab");

const amingJournal =
    ctx.id("aming-journal");

const playerJournal =
    ctx.id("player-journal");

const diaryIndex =
    ctx.id("diary-index");

const stationDiary =
    ctx.id("station-diary");

const ruisuiJournal =
    ctx.id("ruisui-journal");

const backToIndex =
    ctx.id("back-to-index");
	
const params =
    ctx.params;

const station =
    params.get("station");



/* ==========================
   從探索頁直接開啟指定車站
========================== */

function openStationDiary() {
    diaryIndex.classList.add("hidden");
    stationDiary.classList.add("show");
    rememberDiaryView();
    markVisibleMemoryRead();
}

/* 打開回憶碎片 */

ctx.on(memoryCount, "click", () => {

    memoryDrawer.classList.add("show");
    memoryOverlay.classList.add("show");

});


/* 關閉 */

function closeMemoryDrawer() {

    memoryDrawer.classList.remove("show");
    memoryOverlay.classList.remove("show");

}


ctx.on(closeMemory,
    "click",
    closeMemoryDrawer
);


ctx.on(memoryOverlay,
    "click",
    closeMemoryDrawer
);

/* ==========================
   日記頁籤
========================== */

function selectJournalTab(tab, remember = true) {
    const player = tab === "player";
    amingTab.classList.toggle("active", !player);
    playerTab.classList.toggle("active", player);
    amingJournal.classList.toggle("active", !player);
    playerJournal.classList.toggle("active", player);
    if (remember) rememberDiaryView();
    markVisibleMemoryRead();
}

function rememberDiaryView() {
    const open = stationDiary.classList.contains("show");
    const player = playerJournal.classList.contains("active");
    const view = open ? (player ? "ruisui-player" : "ruisui-memory") : "index";
    GameProgress.enterScene("diary", view);
    ctx.replaceRoute(open ? "diary.html?station=ruisui&tab=" + (player ? "player" : "aming") : "diary.html");
}

ctx.on(amingTab, "click", () => selectJournalTab("aming"));
ctx.on(playerTab, "click", () => selectJournalTab("player"));

/* ==========================
   玩家照片
========================== */

const photoInput =
    ctx.id("player-photo-input");

const photoPreview =
    ctx.id("player-photo-preview");

const playerPhoto =
    ctx.query(".player-photo");


let previewURL;

ctx.on(photoInput, "change", () => {

    const file = photoInput.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        window.alert("請選擇圖片檔案。");
        return;
    }
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(file);
    photoPreview.src = previewURL;

    playerPhoto.classList.add("has-photo");

});


/* ==========================
   儲存旅行心得
========================== */

savedMessage.className =
    "travel-saved";

savedMessage.textContent =
    "✓ 已記錄這段旅程";

ctx
    .query(".travel-entry")
    .appendChild(savedMessage);


let noteDirty = false;
let savedTimer;
let noteTimer;
savedMessage.setAttribute("role", "status");

function saveTravelNote() {
    ctx.cancelTimer(noteTimer);
    ctx.cancelTimer(savedTimer);
    const saved = GameProgress.saveNote("ruisui", travelNote.value);
    noteDirty = !saved;
    savedMessage.textContent = saved ? "✓ 已記錄這段旅程" : "尚未儲存，請重試儲存";
    savedMessage.classList.add("show");
    if (saved) savedTimer = ctx.delay(() => savedMessage.classList.remove("show"), 2000);
    return saved;
}

ctx.on(travelNote, "input", () => {
    noteDirty = true;
    ctx.cancelTimer(noteTimer);
    savedMessage.textContent = "記錄中…";
    savedMessage.classList.add("show");
    noteTimer = ctx.delay(saveTravelNote, 650);
});
ctx.on(travelNote, "blur", () => { if (noteDirty) saveTravelNote(); });
ctx.on(saveTravel, "click", saveTravelNote);
ctx.on(window, "beforeunload", event => {
    if (noteDirty && !saveTravelNote()) {
        event.preventDefault();
        event.returnValue = "";
    }
});
ctx.on(window, "pagehide", event => {
    if (noteDirty) saveTravelNote();
    if (!event.persisted && previewURL) URL.revokeObjectURL(previewURL);
});

/* ==========================
   日記目錄
========================== */

/* 點瑞穗 */

ctx.on(ruisuiJournal, "click", () => {

    openStationDiary();

});


/* 回到日記目錄 */

ctx.on(backToIndex, "click", () => {

    stationDiary.classList.remove("show");

    diaryIndex.classList.remove("hidden");
    rememberDiaryView();

});

function markVisibleMemoryRead() {
    if (stationDiary.classList.contains("show") && amingJournal.classList.contains("active")) {
        GameProgress.readMemory("ruisui-01");
    }
}

if (params.get("tab") === "player") selectJournalTab("player", false);
GameProgress.enterScene("diary", "index");
ctx.subscribe((state, status) => {
    const found = state.collectedMemories.includes("ruisui-01");
    const fresh = found && !state.readMemories.includes("ruisui-01");
    ctx.queryAll("[data-memory-total]").forEach(total => {
        total.textContent = `${state.collectedMemories.length} / 30`;
    });
    ctx.queryAll("[data-memory-id]").forEach(item => {
        const id = item.dataset.memoryId;
        const collected = state.collectedMemories.includes(id);
        const unread = collected && !state.readMemories.includes(id);
        item.classList.toggle("found", collected);
        item.classList.toggle("locked", !collected);
        item.classList.toggle("new", unread);
        item.querySelector(".fragment-status").textContent = collected ? (unread ? "NEW" : "✓") : "?";
    });
    ruisuiJournal.classList.toggle("new", fresh);
    ruisuiJournal.querySelector("[data-ruisui-summary]").textContent = found ? (fresh ? "1 段新回憶" : "1 段回憶") : "尚未尋回";
    ruisuiJournal.querySelector(".journal-new").textContent = fresh ? "NEW" : (found ? "✓" : "◇");
    amingJournal.classList.toggle("memory-locked", !found);
    ctx.query(".memory-found").hidden = !fresh;
    // 返回地圖按鈕暫停，與 diary.html 一起恢復。
    // ctx.id("journey-return").hidden = !state.readMemories.includes("ruisui-01");
    if (noteDirty && status.saved && state.notes.ruisui === travelNote.value) {
        noteDirty = false;
        ctx.cancelTimer(noteTimer);
        savedMessage.textContent = "✓ 已記錄這段旅程";
    }
    if (!noteDirty) travelNote.value = state.notes.ruisui ?? "";
    markVisibleMemoryRead();
});

if (station === "ruisui") openStationDiary();
if (params.get("memories") === "1") memoryCount.click();

// 切換場景前先存心得；失敗時保留原畫面與文字。
ctx.beforeLeave(() => !noteDirty || saveTravelNote());
ctx.cleanup(() => { if (previewURL) URL.revokeObjectURL(previewURL); });

});
