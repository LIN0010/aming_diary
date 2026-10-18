GameScenes.register("home", ctx => {
const amingCharacter =
    ctx.id("aming-click-area");

const amingDialogue =
    ctx.id("aming-dialogue");


const dialogues = [
    "……嗯？到站了？",
    "再五分鐘……",
    "我真的很睏。",
    "……你怎麼還在戳。",
    "別吵，我沒睡。",
    "你再戳一下試試。"
];

let dialogueTimer;

ctx.on(amingCharacter, "click", () => {


    const randomIndex =
        Math.floor(Math.random() * dialogues.length);

    amingDialogue.textContent =
        dialogues[randomIndex];

    amingDialogue.classList.add("show");

    ctx.cancelTimer(dialogueTimer);

    dialogueTimer = ctx.delay(() => {
        amingDialogue.classList.remove("show");
    }, 3500);

});

GameProgress.enterScene("home");
ctx.subscribe((state, status) => {
    ctx.id("memory-count").textContent = state.collectedMemories.length;
    const stage = GameProgress.ruisuiStage();
    const next = ctx.id("journey-next");
    const found = stage === "memory-found" || stage === "complete";
    next.href = found ? "diary.html?station=ruisui" : "explore.html?station=ruisui";
    next.textContent = {
        unvisited: "前往瑞穗・尋找回憶",
        exploring: "繼續瑞穗探索",
        "memory-found": "閱讀新找回的記憶",
        complete: "瑞穗・第一段記憶已完成"
    }[stage];
    ctx.id("save-status").textContent = status.saved ? "✓ 旅程已儲存" : "旅程尚未儲存";
});
ctx.on(ctx.id("save-progress"), "click", () => GameProgress.save());
ctx.on(ctx.id("memory-btn"), "click", () => {
    ctx.go("diary.html?memories=1");
});

});
