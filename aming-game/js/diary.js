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

if (station === "ruisui") {

    diaryIndex.classList.add("hidden");

    stationDiary.classList.add("show");

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


photoInput.addEventListener("change", () => {

    const file = photoInput.files[0];

    if (!file) return;

    const imageURL =
        URL.createObjectURL(file);

    photoPreview.src = imageURL;

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


saveTravel.addEventListener("click", () => {

    /*
       Prototype：
       先把文字存在瀏覽器裡
    */

    localStorage.setItem(
        "ruisui-travel-note",
        travelNote.value
    );

    savedMessage.classList.add("show");

    setTimeout(() => {

        savedMessage.classList.remove("show");

    }, 2000);

});


/* 重新進入頁面時讀取 */

const savedNote =
    localStorage.getItem(
        "ruisui-travel-note"
    );

if (savedNote) {

    travelNote.value = savedNote;

}

/* ==========================
   日記目錄
========================== */

/* 點瑞穗 */

ruisuiJournal.addEventListener("click", () => {

    diaryIndex.classList.add("hidden");

    stationDiary.classList.add("show");

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