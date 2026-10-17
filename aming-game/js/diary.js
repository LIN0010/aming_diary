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

amingTab.addEventListener("click", () => {

    amingTab.classList.add("active");
    playerTab.classList.remove("active");

    amingJournal.classList.add("active");
    playerJournal.classList.remove("active");
    markVisibleMemoryRead();

});


playerTab.addEventListener("click", () => {

    playerTab.classList.add("active");
    amingTab.classList.remove("active");

    playerJournal.classList.add("active");
    amingJournal.classList.remove("active");

});


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
travelNote.addEventListener("input", () => { noteDirty = true; });
savedMessage.setAttribute("role", "status");

saveTravel.addEventListener("click", () => {
    clearTimeout(savedTimer);
    const saved = GameProgress.saveNote("ruisui", travelNote.value);
    noteDirty = !saved;
    savedMessage.textContent = saved ? "✓ 已記錄這段旅程" : "尚未儲存，請查看下方提示";
    savedMessage.classList.add("show");
    if (saved) {
        savedTimer = setTimeout(() => savedMessage.classList.remove("show"), 2000);
    }
});

window.addEventListener("pagehide", event => {
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

    history.replaceState(
        {},
        "",
        "diary.html"
    );

});

function markVisibleMemoryRead() {
    if (stationDiary.classList.contains("show") && amingJournal.classList.contains("active")) {
        GameProgress.readMemory("ruisui-01");
    }
}

GameProgress.enterScene("diary");
GameProgress.subscribe(state => {
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
    if (!noteDirty) travelNote.value = state.notes.ruisui ?? "";
    markVisibleMemoryRead();
});

if (station === "ruisui") openStationDiary();
if (params.get("memories") === "1") memoryCount.click();
