const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const loadingScreen = document.getElementById("loading-screen");
const train = document.getElementById("train");
const percentage = document.getElementById("percentage");
const loadingProgress = document.getElementById("loading-progress");
const loadingStatus = document.getElementById("loading-status");
const retryLoading = document.getElementById("retry-loading");
let destination = "home.html";
let starting = false;
let loadController;

GameProgress.subscribe((state, status) => {
    startBtn.textContent = status.canResume ? "繼續旅程" : "開始遊戲";
});

function renderProgress(completed, total) {
    const progress = total ? Math.floor(completed * 100 / total) : 0;
    percentage.textContent = progress;
    loadingProgress.setAttribute("aria-valuenow", progress);
    const railArea = document.querySelector(".rail-area");
    const maxDistance = Math.max(0, railArea.clientWidth - train.offsetWidth);
    train.style.left = (maxDistance * progress / 100) + "px";
}

async function loadGame() {
    if (starting) return;
    starting = true;
    loadController = new AbortController();
    const signal = loadController.signal;
    startBtn.disabled = true;
    startScreen.style.display = "none";
    loadingScreen.style.display = "block";
    loadingScreen.style.opacity = "1";
    retryLoading.hidden = true;
    loadingStatus.textContent = "正在準備旅程…";
    renderProgress(0, 0);

    try {
        await JourneyLoader.load(destination, (completed, total) => {
            renderProgress(completed, total);
            if (loadingStatus.textContent !== "正在載入旅程…") loadingStatus.textContent = "正在載入旅程…";
        }, { signal });
        if (signal.aborted) return;
        loadingStatus.textContent = "載入完成，即將出發。";
        // 百分比由真實載入結果決定；這裡只等待原有的畫面淡出動畫。
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (signal.aborted) return;
        loadingScreen.style.opacity = "0";
        await Promise.all(loadingScreen.getAnimations().map(animation => animation.finished.catch(() => {})));
        if (!signal.aborted) window.location.href = destination;
    } catch (_) {
        if (signal.aborted) return;
        loadingStatus.textContent = "部分遊戲內容未能載入，請確認網路連線後重試。";
        retryLoading.hidden = false;
        starting = false;
    }
}

startBtn.addEventListener("click", () => {
    if (starting) return;
    destination = GameProgress.resumeUrl();
    loadGame();
});
retryLoading.addEventListener("click", loadGame);
window.addEventListener("pagehide", () => loadController?.abort());
window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    starting = false;
    startBtn.disabled = false;
    startScreen.style.display = "block";
    loadingScreen.style.display = "none";
    loadingScreen.style.opacity = "1";
});
