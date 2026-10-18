GameScenes.register("explore", ctx => {
const ruisuiStation =
    ctx.id("ruisui-station");

const locationCheck =
    ctx.id("location-check");

const missionCard =
    ctx.id("mission-card");

const missionClose =
    ctx.id("mission-close");

const startMission =
    ctx.id("start-mission");
	
const stationExplore =
    ctx.id("station-explore");

const leaveStation =
    ctx.id("leave-station");
	
const stationScene =
    ctx.id("station-scene");

const sceneWorld =
    ctx.id("scene-world");
	
const cowTarget =
    ctx.id("cow-target");

const cameraMode =
    ctx.id("camera-mode");

const closeCamera =
    ctx.id("close-camera");

const shutterButton =
    ctx.id("shutter-button");

const cameraFlash =
    ctx.id("camera-flash");

const bottomNav =
    ctx.query(".bottom-nav");
	
const photoSuccess =
    ctx.id("photo-success");

const viewMemory =
    ctx.id("view-memory");
	
const missionProgress =
    ctx.query(".mission-progress");

let locating = false;

let isDragging = false;

let startX = 0;
let startWorldX = 0;

let worldX = 0;



/* 點擊瑞穗站 */

ctx.on(ruisuiStation, "click", () => {

    if (locating) return;

    locating = true;

    // 先把舊任務卡收起來
    missionCard.classList.remove("show");

    // 顯示定位確認
    locationCheck.classList.add("show");


    // 模擬定位時間
    ctx.delay(() => {

        locationCheck.classList.remove("show");

        // 稍微停一下再跳任務
        ctx.delay(() => {

            missionCard.classList.add("show");

            locating = false;

        }, 300);

    }, 1600);

});


/* 關閉任務卡 */

ctx.on(missionClose, "click", () => {

    missionCard.classList.remove("show");

});


/* 開始探索 */

function enterStation() {
    GameProgress.visitRuisui();
    missionCard.classList.remove("show");
    stationExplore.classList.add("show");
    bottomNav.classList.add("explore-hidden");
    ctx.replaceRoute("explore.html?station=ruisui");
}

ctx.on(startMission, "click", enterStation);

ctx.on(leaveStation, "click", () => {

    resetCamera();
    endDrag();
    GameProgress.enterScene("explore");
    ctx.replaceRoute("explore.html");
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

ctx.on(stationScene, "pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest("button")) return;
    isDragging = true;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startWorldX = worldX;
    stationScene.setPointerCapture(event.pointerId);
    stationScene.classList.add("dragging");
    event.preventDefault();
});

ctx.on(window, "pointermove", event => {
    if (!isDragging || event.pointerId !== activePointerId) return;
    worldX = startWorldX + event.clientX - startX;
    clampWorld();
});

for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    ctx.on(window, type, event => {
        if (event.pointerId === activePointerId) endDrag();
    });
}
ctx.on(window, "blur", endDrag);
ctx.on(window, "resize", () => { endDrag(); clampWorld(); });

/* ==========================
   乳牛拍照
========================== */

/* 點乳牛 */

ctx.on(cowTarget, "click", (event) => {

    event.stopPropagation();

    resetCamera();
    cameraMode.classList.add("show");

});


/* 關閉相機 */

ctx.on(closeCamera, "click", () => {

    resetCamera();

});


/* 拍照 */

ctx.on(shutterButton, "click", () => {

    if (shutterButton.disabled) return;

    // 防止連續狂按
    shutterButton.disabled = true;

    // 白色閃光
    cameraFlash.classList.remove("flash");
    void cameraFlash.offsetWidth;
    cameraFlash.classList.add("flash");

    // 快門按壓
    shutterButton.classList.add("shot");

    pressTimer = ctx.delay(() => {
        shutterButton.classList.remove("shot");
    }, 180);

    // 拍攝成功
    shotTimer = ctx.delay(() => {

        const alreadyFound = GameProgress.hasMemory("ruisui-01");
        const saved = GameProgress.completeRuisui();
        ctx.id("photo-result").textContent = saved
            ? (alreadyFound ? "這段回憶已收藏" : "已找回一段新記憶")
            : "已找到回憶，尚未儲存";
        photoSuccess.classList.add("show");

    }, 600);

});

function openRuisuiMemory(event) {
    event.preventDefault();
    if (!GameProgress.saveStatus().saved && !GameProgress.save()) return;
    ctx.go("diary.html?station=ruisui");
}
for (const link of [viewMemory, ctx.id("scene-diary"), ctx.id("mission-diary")]) {
    ctx.on(link, "click", openRuisuiMemory);
}

let shotTimer;
let pressTimer;

function resetCamera() {
    ctx.cancelTimer(shotTimer);
    ctx.cancelTimer(pressTimer);
    cameraMode.classList.remove("show");
    photoSuccess.classList.remove("show");
    cameraFlash.classList.remove("flash");
    shutterButton.classList.remove("shot");
    shutterButton.disabled = false;
}

ctx.subscribe((state, status) => {
    const stage = GameProgress.ruisuiStage();
    const found = stage === "memory-found" || stage === "complete";
    const complete = stage === "complete";
    missionProgress.textContent = found ? "1 / 1" : "0 / 1";
    ctx.query(".mission-tag").textContent = {
        unvisited: "NEW MISSION", exploring: "IN PROGRESS",
        "memory-found": "MEMORY FOUND", complete: "JOURNEY COMPLETE"
    }[stage];
    ctx.query(".mission-story").textContent = found
        ? (complete ? "阿明的記憶已記錄在日記中，隨時可以回來重溫。" : "你已找回瑞穗的第一段記憶，翻開日記看看吧。")
        : "阿明似乎對車站裡的某樣東西有印象……";
    ctx.query(".mission-goal strong").textContent = found
        ? (complete ? "這段旅程已完成" : "閱讀瑞穗・第一段記憶") : "尋找瑞穗站的乳牛裝置";
    startMission.textContent = found ? "再次探索" : (stage === "exploring" ? "繼續探索" : "開始探索");
    const diaryLink = ctx.id("mission-diary");
    diaryLink.hidden = !found;
    diaryLink.textContent = complete ? "重溫日記" : "閱讀新回憶";
    ctx.id("scene-mission-label").textContent = found
        ? (complete ? "瑞穗・第一段記憶已完成" : "已尋回瑞穗・01") : "尋找瑞穗站的乳牛裝置";
    ctx.id("scene-diary").hidden = !found;
    viewMemory.textContent = status.saved ? (complete ? "重溫日記" : "查看新回憶") : "儲存並查看日記";
    if (photoSuccess.classList.contains("show")) {
        ctx.id("photo-result").textContent = status.saved ? "這段回憶已儲存" : "已找到回憶，尚未儲存";
    }
});
if (ctx.params.get("station") === "ruisui") {
    enterStation();
} else {
    GameProgress.enterScene("explore");
}

ctx.cleanup(endDrag);

});
