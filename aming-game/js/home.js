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

let dialogueIndex = 0;

amingCharacter.addEventListener("click", () => {

    amingDialogue.textContent =
        dialogues[dialogueIndex];

    dialogueIndex++;

    if (dialogueIndex >= dialogues.length) {
        dialogueIndex = dialogues.length - 1;
    }

    amingDialogue.classList.add("show");

    clearTimeout(dialogueTimer);

    dialogueTimer = setTimeout(() => {
        amingDialogue.classList.remove("show");
    }, 3500);
});

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

amingCharacter.addEventListener("click", () => {

    console.log("阿明被戳了！！！");

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