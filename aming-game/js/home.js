const amingCharacter =
    document.getElementById("aming-click-area");

const amingDialogue =
    document.getElementById("aming-dialogue");


const dialogues = [
    "……嗯？到站了？",
    "再五分鐘……",
    "我真的很睏。",
    "……你怎麼還在戳。",
    "別吵，我沒睡。",
    "你再戳一下試試。"
];

let dialogueTimer;

amingCharacter.addEventListener("click", () => {


    const randomIndex =
        Math.floor(Math.random() * dialogues.length);

    amingDialogue.textContent =
        dialogues[randomIndex];

    amingDialogue.classList.add("show");

    clearTimeout(dialogueTimer);

    dialogueTimer = setTimeout(() => {
        amingDialogue.classList.remove("show");
    }, 3500);

});

GameProgress.enterScene("home");
GameProgress.subscribe(state => {
    document.getElementById("memory-count").textContent = state.collectedMemories.length;
});
document.getElementById("memory-btn").addEventListener("click", () => {
    window.location.href = "diary.html?memories=1";
});
