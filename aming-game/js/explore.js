const ruisuiStation =
    document.getElementById("ruisui-station");

const locationCheck =
    document.getElementById("location-check");

const missionCard =
    document.getElementById("mission-card");

const missionClose =
    document.getElementById("mission-close");

const startMission =
    document.getElementById("start-mission");
	
const stationExplore =
    document.getElementById("station-explore");

const leaveStation =
    document.getElementById("leave-station");
	
const stationScene =
    document.getElementById("station-scene");

const sceneWorld =
    document.getElementById("scene-world");
	
const cowTarget =
    document.getElementById("cow-target");

const cameraMode =
    document.getElementById("camera-mode");

const closeCamera =
    document.getElementById("close-camera");

const shutterButton =
    document.getElementById("shutter-button");

const cameraFlash =
    document.getElementById("camera-flash");

const bottomNav =
    document.querySelector(".bottom-nav");
	
const photoSuccess =
    document.getElementById("photo-success");

const viewMemory =
    document.getElementById("view-memory");
	
const missionProgress =
    document.querySelector(".mission-progress");

let locating = false;

let isDragging = false;

let startX = 0;
let startWorldX = 0;

let worldX = 0;



/* 點擊瑞穗站 */

ruisuiStation.addEventListener("click", () => {

    if (locating) return;

    locating = true;

    // 先把舊任務卡收起來
    missionCard.classList.remove("show");

    // 顯示定位確認
    locationCheck.classList.add("show");


    // 模擬定位時間
    setTimeout(() => {

        locationCheck.classList.remove("show");

        // 稍微停一下再跳任務
        setTimeout(() => {

            missionCard.classList.add("show");

            locating = false;

        }, 300);

    }, 1600);

});


/* 關閉任務卡 */

missionClose.addEventListener("click", () => {

    missionCard.classList.remove("show");

});


/* 開始探索 */

function enterStation() {
    GameProgress.visitRuisui();
    missionCard.classList.remove("show");
    stationExplore.classList.add("show");
    bottomNav.classList.add("explore-hidden");
    history.replaceState({}, "", "explore.html?station=ruisui");
}

startMission.addEventListener("click", enterStation);

leaveStation.addEventListener("click", () => {

    resetCamera();
    endDrag();
    GameProgress.enterScene("explore");
    history.replaceState({}, "", "explore.html");
    stationExplore.classList.remove("show");

    bottomNav.classList.remove("explore-hidden");

});

/* 拖曳只處理場景背景，保留乳牛按鈕的點擊。 */
let activePointerId = null;

function clampWorld() {
    const overflow = Math.max(0, sceneWorld.scrollWidth - stationScene.clientWidth);
    worldX = Math.max(-overflow, Math.min(0, worldX));
    sceneWorld.style.transform = `translate3d(${worldX}px, 0, 0)`;
}

function endDrag() {
    if (activePointerId !== null && stationScene.hasPointerCapture(activePointerId)) {
        stationScene.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    isDragging = false;
    stationScene.classList.remove("dragging");
}

stationScene.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest("button")) return;
    isDragging = true;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startWorldX = worldX;
    stationScene.setPointerCapture(event.pointerId);
    stationScene.classList.add("dragging");
    event.preventDefault();
});

window.addEventListener("pointermove", event => {
    if (!isDragging || event.pointerId !== activePointerId) return;
    worldX = startWorldX + event.clientX - startX;
    clampWorld();
});

for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    window.addEventListener(type, event => {
        if (event.pointerId === activePointerId) endDrag();
    });
}
window.addEventListener("blur", endDrag);
window.addEventListener("resize", () => { endDrag(); clampWorld(); });

/* ==========================
   乳牛拍照
========================== */

/* 點乳牛 */

cowTarget.addEventListener("click", (event) => {

    event.stopPropagation();

    resetCamera();
    cameraMode.classList.add("show");

});


/* 關閉相機 */

closeCamera.addEventListener("click", () => {

    resetCamera();

});


/* 拍照 */

shutterButton.addEventListener("click", () => {

    if (shutterButton.disabled) return;

    // 防止連續狂按
    shutterButton.disabled = true;

    // 白色閃光
    cameraFlash.classList.remove("flash");
    void cameraFlash.offsetWidth;
    cameraFlash.classList.add("flash");

    // 快門按壓
    shutterButton.classList.add("shot");

    pressTimer = setTimeout(() => {
        shutterButton.classList.remove("shot");
    }, 180);

    // 拍攝成功
    shotTimer = setTimeout(() => {

        const alreadyFound = GameProgress.hasMemory("ruisui-01");
        const saved = GameProgress.completeRuisui();
        document.getElementById("photo-result").textContent = saved
            ? (alreadyFound ? "這段回憶已收藏" : "已找回一段新記憶")
            : "已找到回憶，尚未儲存";
        photoSuccess.classList.add("show");

    }, 600);

});

function openRuisuiMemory(event) {
    event.preventDefault();
    if (!GameProgress.saveStatus().saved && !GameProgress.save()) return;
    window.location.href = "diary.html?station=ruisui";
}
for (const link of [viewMemory, document.getElementById("scene-diary"), document.getElementById("mission-diary")]) {
    link.addEventListener("click", openRuisuiMemory);
}

let shotTimer;
let pressTimer;

function resetCamera() {
    clearTimeout(shotTimer);
    clearTimeout(pressTimer);
    cameraMode.classList.remove("show");
    photoSuccess.classList.remove("show");
    cameraFlash.classList.remove("flash");
    shutterButton.classList.remove("shot");
    shutterButton.disabled = false;
}

GameProgress.subscribe((state, status) => {
    const stage = GameProgress.ruisuiStage();
    const found = stage === "memory-found" || stage === "complete";
    const complete = stage === "complete";
    missionProgress.textContent = found ? "1 / 1" : "0 / 1";
    document.querySelector(".mission-tag").textContent = {
        unvisited: "NEW MISSION", exploring: "IN PROGRESS",
        "memory-found": "MEMORY FOUND", complete: "JOURNEY COMPLETE"
    }[stage];
    document.querySelector(".mission-story").textContent = found
        ? (complete ? "阿明的記憶已記錄在日記中，隨時可以回來重溫。" : "你已找回瑞穗的第一段記憶，翻開日記看看吧。")
        : "阿明似乎對車站裡的某樣東西有印象……";
    document.querySelector(".mission-goal strong").textContent = found
        ? (complete ? "這段旅程已完成" : "閱讀瑞穗・第一段記憶") : "尋找瑞穗站的乳牛裝置";
    startMission.textContent = found ? "再次探索" : (stage === "exploring" ? "繼續探索" : "開始探索");
    const diaryLink = document.getElementById("mission-diary");
    diaryLink.hidden = !found;
    diaryLink.textContent = complete ? "重溫日記" : "閱讀新回憶";
    document.getElementById("scene-mission-label").textContent = found
        ? (complete ? "瑞穗・第一段記憶已完成" : "已尋回瑞穗・01") : "尋找瑞穗站的乳牛裝置";
    document.getElementById("scene-diary").hidden = !found;
    viewMemory.textContent = status.saved ? (complete ? "重溫日記" : "查看新回憶") : "儲存並查看日記";
    if (photoSuccess.classList.contains("show")) {
        document.getElementById("photo-result").textContent = status.saved ? "這段回憶已儲存" : "已找到回憶，尚未儲存";
    }
});
if (new URLSearchParams(window.location.search).get("station") === "ruisui") {
    enterStation();
} else {
    GameProgress.enterScene("explore");
}
