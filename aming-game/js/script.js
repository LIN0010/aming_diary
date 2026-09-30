const startScreen =
    document.getElementById("start-screen");

const startBtn =
    document.getElementById("start-btn");

const loadingScreen =
    document.getElementById("loading-screen");

const gameScreen =
    document.getElementById("game-screen");

const train =
    document.getElementById("train");

const percentage =
    document.getElementById("percentage");


let progress = 0;


/* ==========================
   按下「開始遊戲」
========================== */

startBtn.addEventListener("click", () => {

    // 開始畫面消失
    startScreen.style.display = "none";

    // Loading 出現
    loadingScreen.style.display = "block";

    // 正式開始跑進度
    setTimeout(loadGame, 300);

});


/* ==========================
   Loading
========================== */

function loadGame() {

    progress +=
        Math.floor(Math.random() * 5) + 1;


    if (progress >= 100) {
        progress = 100;
    }


    percentage.textContent = progress;


    /* 火車跟著進度走 */

    const railArea =
        document.querySelector(".rail-area");

    const maxDistance =
        railArea.clientWidth -
        train.offsetWidth;


    train.style.left =
        (maxDistance * progress / 100)
        + "px";


    /* 還沒跑完 */

    if (progress < 100) {

        setTimeout(
            loadGame,
            Math.random() * 120 + 70
        );

    }

    /* 跑完 */

    else {

        setTimeout(() => {

            loadingScreen.style.opacity = "0";

			setTimeout(() => {

				window.location.href = "home.html";

			}, 1200);

        }, 500);

    }

}