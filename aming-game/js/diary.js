const memoryCount =
    document.getElementById("memory-count");

const memoryDrawer =
    document.getElementById("memory-drawer");

const memoryOverlay =
    document.getElementById("memory-overlay");

const closeMemory =
    document.getElementById("close-memory");

const travelNote =
    document.getElementById("travel-note");

const saveTravel =
    document.getElementById("save-travel");

const savedMessage =
    document.createElement("div");
	
const amingTab =
    document.getElementById("aming-tab");

const playerTab =
    document.getElementById("player-tab");

const amingJournal =
    document.getElementById("aming-journal");

const playerJournal =
    document.getElementById("player-journal");

const diaryIndex =
    document.getElementById("diary-index");

const stationDiary =
    document.getElementById("station-diary");

const ruisuiJournal =
    document.getElementById("ruisui-journal");

const backToIndex =
    document.getElementById("back-to-index");
	
const params =
    new URLSearchParams(window.location.search);

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

memoryCount.addEventListener("click", () => {

    memoryDrawer.classList.add("show");
    memoryOverlay.classList.add("show");

});


/* 關閉 */

function closeMemoryDrawer() {

    memoryDrawer.classList.remove("show");
    memoryOverlay.classList.remove("show");

}


closeMemory.addEventListener(
    "click",
    closeMemoryDrawer
);


memoryOverlay.addEventListener(
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
    history.replaceState({}, "", open ? "diary.html?station=ruisui&tab=" + (player ? "player" : "aming") : "diary.html");
}

amingTab.addEventListener("click", () => selectJournalTab("aming"));
playerTab.addEventListener("click", () => selectJournalTab("player"));

/* ==========================
   玩家照片
========================== */

const photoInput =
    document.getElementById("player-photo-input");

const photoPreview =
    document.getElementById("player-photo-preview");

const playerPhoto =
    document.querySelector(".player-photo");


let previewURL;

photoInput.addEventListener("change", () => {

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

document
    .querySelector(".travel-entry")
    .appendChild(savedMessage);


let noteDirty = false;
let savedTimer;
let noteTimer;
savedMessage.setAttribute("role", "status");

function saveTravelNote() {
    clearTimeout(noteTimer);
    clearTimeout(savedTimer);
    const saved = GameProgress.saveNote("ruisui", travelNote.value);
    noteDirty = !saved;
    savedMessage.textContent = saved ? "✓ 已記錄這段旅程" : "尚未儲存，請重試儲存";
    savedMessage.classList.add("show");
    if (saved) savedTimer = setTimeout(() => savedMessage.classList.remove("show"), 2000);
    return saved;
}

travelNote.addEventListener("input", () => {
    noteDirty = true;
    clearTimeout(noteTimer);
    savedMessage.textContent = "記錄中…";
    savedMessage.classList.add("show");
    noteTimer = setTimeout(saveTravelNote, 650);
});
travelNote.addEventListener("blur", () => { if (noteDirty) saveTravelNote(); });
saveTravel.addEventListener("click", saveTravelNote);
window.addEventListener("beforeunload", event => {
    if (noteDirty && !saveTravelNote()) {
        event.preventDefault();
        event.returnValue = "";
    }
});
window.addEventListener("pagehide", event => {
    if (noteDirty) saveTravelNote();
    if (!event.persisted && previewURL) URL.revokeObjectURL(previewURL);
});

/* ==========================
   日記目錄
========================== */

/* 點瑞穗 */

ruisuiJournal.addEventListener("click", () => {

    openStationDiary();

});


/* 回到日記目錄 */

backToIndex.addEventListener("click", () => {

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
GameProgress.subscribe((state, status) => {
    const found = state.collectedMemories.includes("ruisui-01");
    const fresh = found && !state.readMemories.includes("ruisui-01");
    document.querySelectorAll("[data-memory-total]").forEach(total => {
        total.textContent = `${state.collectedMemories.length} / 30`;
    });
    document.querySelectorAll("[data-memory-id]").forEach(item => {
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
    document.querySelector(".memory-found").hidden = !fresh;
    document.getElementById("journey-return").hidden = !state.readMemories.includes("ruisui-01");
    if (noteDirty && status.saved && state.notes.ruisui === travelNote.value) {
        noteDirty = false;
        clearTimeout(noteTimer);
        savedMessage.textContent = "✓ 已記錄這段旅程";
    }
    if (!noteDirty) travelNote.value = state.notes.ruisui ?? "";
    markVisibleMemoryRead();
});

if (station === "ruisui") openStationDiary();
if (params.get("memories") === "1") memoryCount.click();
