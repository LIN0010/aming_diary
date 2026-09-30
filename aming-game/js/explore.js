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

/* 開始探索 */

startMission.addEventListener("click", () => {

    // 收起任務卡
    missionCard.classList.remove("show");

    // 進入瑞穗站探索模式
    stationExplore.classList.add("show");

    // 隱藏底部導覽
    bottomNav.classList.add("explore-hidden");

});

leaveStation.addEventListener("click", () => {

    stationExplore.classList.remove("show");

    bottomNav.classList.remove("explore-hidden");

});

/*let isDragging = false;

let startX = 0;
let startWorldX = 0;

let worldX = 0;*/


/* 開始拖 */

stationScene.addEventListener("pointerdown", (event) => {

    console.log("抓到了！");

    isDragging = true;

    startX = event.clientX;
    startWorldX = worldX;

    stationScene.classList.add("dragging");

    event.preventDefault();
});


/* 拖動 */

window.addEventListener("pointermove", (event) => {

    if (!isDragging) return;

    const movedX = event.clientX - startX;

    const overflow =
        sceneWorld.scrollWidth -
        stationScene.clientWidth;

    let nextX = startWorldX + movedX;

    // 左邊不能超過圖片盡頭
    if (nextX < -overflow) {
        nextX = -overflow;
    }

    // 右邊不能超過起點
    if (nextX > 0) {
        nextX = 0;
    }

    worldX = nextX;

    sceneWorld.style.transform =
        `translate3d(${worldX}px, 0, 0)`;

    /*console.log("worldX:", worldX);*/
});


/* 放開 */

window.addEventListener("pointerup", () => {

    if (!isDragging) return;

    isDragging = false;

    stationScene.classList.remove("dragging");

});

/* ==========================
   乳牛拍照
========================== */

/* 點乳牛 */

cowTarget.addEventListener("click", (event) => {

    event.stopPropagation();

    cameraMode.classList.add("show");

});


/* 關閉相機 */

closeCamera.addEventListener("click", () => {

    cameraMode.classList.remove("show");

});


/* 拍照 */

shutterButton.addEventListener("click", () => {

    console.log("📸 按下快門");

    // 防止連續狂按
    shutterButton.disabled = true;

    // 白色閃光
    cameraFlash.classList.remove("flash");
    void cameraFlash.offsetWidth;
    cameraFlash.classList.add("flash");

    // 快門按壓
    shutterButton.classList.add("shot");

    setTimeout(() => {
        shutterButton.classList.remove("shot");
    }, 180);

    // 拍攝成功
    setTimeout(() => {

        console.log("🐄 拍攝成功卡出現");

        missionProgress.textContent = "1 / 1";
        photoSuccess.classList.add("show");

    }, 600);

});

viewMemory.addEventListener("click", () => {
    window.location.href = "diary.html?station=ruisui";
});