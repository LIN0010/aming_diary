GameScenes.register("diary", ctx => {
const memoryCount =
    ctx.id("memory-count");

const memoryDrawer =
    ctx.id("memory-drawer");

const memoryOverlay =
    ctx.id("memory-overlay");

const closeMemory =
    ctx.id("close-memory");

const travelNote =
    ctx.id("travel-note");

const saveTravel =
    ctx.id("save-travel");

const savedMessage =
    document.createElement("div");
	
const amingTab =
    ctx.id("aming-tab");

const playerTab =
    ctx.id("player-tab");

const amingJournal =
    ctx.id("aming-journal");

const playerJournal =
    ctx.id("player-journal");

const diaryIndex =
    ctx.id("diary-index");

const stationDiary =
    ctx.id("station-diary");

const ruisuiJournal =
    ctx.id("ruisui-journal");

const backToIndex =
    ctx.id("back-to-index");
	
const params =
    ctx.params;

const station =
    params.get("station");



/* ==========================
   從探索頁直接開啟指定車站
========================== */

function openStationDiary() { return turnTo(4); }

/* 純HTML書本：沿用六站順序與既有內容元件。 */
const entries=[...diaryIndex.querySelectorAll('.station-journal')];
diaryIndex.querySelector('h2').textContent='目錄';
backToIndex.textContent='← 返回目錄';
const book=document.createElement('section');book.className='diary-book closed';book.setAttribute('aria-label','互動日記書本');
const pages=document.createElement('div');pages.className='db-pages';
const cover=document.createElement('button');cover.type='button';cover.className='db-cover';cover.textContent='阿明的日記';
const coverHinge=document.createElement('div');coverHinge.className='db-cover-hinge';
const coverBack=document.createElement('div');coverBack.className='db-cover-back';coverBack.setAttribute('aria-hidden','true');
// 左右目錄分別持有原始站點節點，不複製完整目錄。
const tocLeft=document.createElement('section');tocLeft.className='db-toc-page db-toc-left';
const heading=diaryIndex.querySelector('.index-title');heading.classList.add('db-toc-heading');
const leftList=document.createElement('div');leftList.className='station-journals';
entries.slice(0,3).forEach(entry=>leftList.append(entry));tocLeft.append(heading,leftList);coverBack.append(tocLeft);
diaryIndex.classList.add('db-toc-page');
const rightHeading=document.createElement('div');rightHeading.className='db-toc-heading';rightHeading.setAttribute('aria-hidden','true');diaryIndex.prepend(rightHeading);
coverHinge.append(cover,coverBack);
const locked=document.createElement('section');locked.className='db-locked';locked.hidden=true;
const controls=document.createElement('nav');controls.className='db-controls';controls.setAttribute('aria-label','書頁導覽');
controls.innerHTML='<button type="button" data-book="previous">← 上一站</button><button type="button" data-book="index">返回目錄</button><span role="status"></span><button type="button" data-book="next">下一站 →</button><button type="button" data-book="close">闔上</button>';
diaryIndex.before(book);pages.append(diaryIndex,stationDiary,locked);book.append(pages,coverHinge,controls);
let pageNumber=-1, flipping=false;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function renderBook(n){
    pageNumber=n;book.classList.toggle('closed',n===-1);book.dataset.pageKind=n<=0?'toc':'station';coverHinge.hidden=n>0;coverHinge.style.transform=n===-1?'rotateY(0deg)':'rotateY(-180deg)';cover.hidden=false;
    diaryIndex.classList.toggle('hidden',n>0);stationDiary.classList.toggle('show',n===4);
    locked.hidden=n<1||n===4;
    if(!locked.hidden){locked.replaceChildren();const heading=document.createElement('h2');heading.textContent=entries[n-1].querySelector('strong').textContent;const message=document.createElement('p');message.textContent='這段旅程尚未開放。';locked.append(heading,message);}
    controls.hidden=n===-1;
    controls.querySelector('[data-book="previous"]').disabled=n<=0;
    controls.querySelector('[data-book="next"]').disabled=n>=entries.length;
    controls.querySelector('span').textContent=n===0?'目錄':`${n} / ${entries.length}`;
}
function snapshot(){
    const copy=pages.cloneNode(true);
    if(pageNumber<=0){const left=tocLeft.cloneNode(true);left.classList.add('db-toc-left-snapshot');copy.append(left);}
copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
    copy.querySelectorAll('.memory-locked > .journal-page,script').forEach(e=>e.remove());
    copy.querySelectorAll('button,input,textarea,a').forEach(e=>{e.tabIndex=-1;e.setAttribute('aria-hidden','true');});
    copy.classList.add('db-snapshot');copy.inert=true;return copy;
}
async function turnTo(target){
    if(flipping||target===pageNumber)return;
    if(noteDirty&&!saveTravelNote())return;
    flipping=true;book.setAttribute('aria-busy','true');pages.inert=true;coverBack.inert=true;controls.inert=true;cover.disabled=true;
    try{
        while(pageNumber!==target){
            if(pageNumber===-1 || (pageNumber===0 && target===-1)){
                const opening=pageNumber===-1;
                // 目錄已在封面底層；動畫結束前不切換頁碼或互動狀態。
                coverHinge.hidden=false;
                coverHinge.style.transform=opening?'rotateY(0deg)':'rotateY(-180deg)';
                book.classList.add('cover-moving');
                const animation=coverHinge.animate([
                    {transform:opening?'rotateY(0deg)':'rotateY(-180deg)'},
                    {transform:opening?'rotateY(-180deg)':'rotateY(0deg)'}
                ],{duration:reduced.matches?1:700,easing:'ease-in-out',fill:'forwards'});
                await animation.finished.catch(()=>{});
                renderBook(opening?0:-1);
                animation.cancel();book.classList.remove('cover-moving');
                continue;
            }
            const old=pageNumber,forward=target>old,next=old+(forward?1:-1),before=snapshot();
            renderBook(next);const after=snapshot();
            const leaf=document.createElement('div');leaf.className='db-leaf '+(forward?'forward':'backward');leaf.setAttribute('aria-hidden','true');
            const front=document.createElement('div'),back=document.createElement('div');front.className='db-face db-front';back.className='db-face db-back';front.append(before);back.append(after);leaf.append(front,back);
            const hold=document.createElement('div');hold.className='db-hold '+(forward?'hold-left':'hold-right');hold.append(before.cloneNode(true));book.append(hold,leaf);
            const duration=reduced.matches?1:(Math.abs(target-old)>1?220:650);
            const animation=leaf.animate([{transform:'rotateY(0deg)'},{transform:`rotateY(${forward?-180:180}deg)`}],{duration,easing:'ease-in-out',fill:'forwards'});
            await animation.finished.catch(()=>{});leaf.remove();hold.remove();
        }
        rememberDiaryView();markVisibleMemoryRead();
    }finally{flipping=false;book.removeAttribute('aria-busy');pages.inert=false;coverBack.inert=false;controls.inert=false;cover.disabled=false;}
}
ctx.on(cover,'click',()=>turnTo(0));

ctx.on(controls,'click',e=>{const action=e.target.closest('[data-book]')?.dataset.book;if(action)turnTo(action==='index'?0:action==='close'?-1:pageNumber+(action==='next'?1:-1));});
ctx.beforeLeave(()=>!flipping);
renderBook(-1);

/* 打開回憶碎片 */

ctx.on(memoryCount, "click", () => {

    memoryDrawer.classList.add("show");
    memoryOverlay.classList.add("show");

});


/* 關閉 */

function closeMemoryDrawer() {

    memoryDrawer.classList.remove("show");
    memoryOverlay.classList.remove("show");

}


ctx.on(closeMemory,
    "click",
    closeMemoryDrawer
);


ctx.on(memoryOverlay,
    "click",
    closeMemoryDrawer
);

/* ==========================
   日記頁籤
========================== */

function selectJournalTab(tab, remember = true) {
    const player = tab === "player";
    amingTab.classList.toggle("active", !player);
    playerTab.classList.toggle("active", player);
    amingJournal.classList.toggle("active", !player);
    playerJournal.classList.toggle("active", player);
    if (remember) rememberDiaryView();
    markVisibleMemoryRead();
}

function rememberDiaryView() {
    const open = stationDiary.classList.contains("show");
    const player = playerJournal.classList.contains("active");
    const view = open ? (player ? "ruisui-player" : "ruisui-memory") : "index";
    GameProgress.enterScene("diary", view);
    ctx.replaceRoute(open ? "diary.html?station=ruisui&tab=" + (player ? "player" : "aming") : "diary.html");
}

ctx.on(amingTab, "click", () => selectJournalTab("aming"));
ctx.on(playerTab, "click", () => selectJournalTab("player"));

/* ==========================
   玩家照片
========================== */

const photoInput =
    ctx.id("player-photo-input");

const photoPreview =
    ctx.id("player-photo-preview");

const playerPhoto =
    ctx.query(".player-photo");


let previewURL;

ctx.on(photoInput, "change", () => {

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

ctx
    .query(".travel-entry")
    .appendChild(savedMessage);


let noteDirty = false;
let savedTimer;
let noteTimer;
savedMessage.setAttribute("role", "status");

function saveTravelNote() {
    ctx.cancelTimer(noteTimer);
    ctx.cancelTimer(savedTimer);
    const saved = GameProgress.saveNote("ruisui", travelNote.value);
    noteDirty = !saved;
    savedMessage.textContent = saved ? "✓ 已記錄這段旅程" : "尚未儲存，請重試儲存";
    savedMessage.classList.add("show");
    if (saved) savedTimer = ctx.delay(() => savedMessage.classList.remove("show"), 2000);
    return saved;
}

ctx.on(travelNote, "input", () => {
    noteDirty = true;
    ctx.cancelTimer(noteTimer);
    savedMessage.textContent = "記錄中…";
    savedMessage.classList.add("show");
    noteTimer = ctx.delay(saveTravelNote, 650);
});
ctx.on(travelNote, "blur", () => { if (noteDirty) saveTravelNote(); });
ctx.on(saveTravel, "click", saveTravelNote);
ctx.on(window, "beforeunload", event => {
    if (noteDirty && !saveTravelNote()) {
        event.preventDefault();
        event.returnValue = "";
    }
});
ctx.on(window, "pagehide", event => {
    if (noteDirty) saveTravelNote();
    if (!event.persisted && previewURL) URL.revokeObjectURL(previewURL);
});

/* ==========================
   日記目錄
========================== */

/* 點瑞穗 */

ctx.on(ruisuiJournal, "click", () => {

    openStationDiary();

});


/* 回到日記目錄 */

ctx.on(backToIndex,'click',()=>turnTo(0));

function markVisibleMemoryRead() {
    if (stationDiary.classList.contains("show") && amingJournal.classList.contains("active")) {
        GameProgress.readMemory("ruisui-01");
    }
}

if (params.get("tab") === "player") selectJournalTab("player", false);
GameProgress.enterScene("diary", "index");
ctx.subscribe((state, status) => {
    const found = state.collectedMemories.includes("ruisui-01");
    const fresh = found && !state.readMemories.includes("ruisui-01");
    ctx.queryAll("[data-memory-total]").forEach(total => {
        total.textContent = `${state.collectedMemories.length} / 30`;
    });
    ctx.queryAll("[data-memory-id]").forEach(item => {
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
    ctx.query(".memory-found").hidden = !fresh;
    // 返回地圖按鈕暫停，與 diary.html 一起恢復。
    // ctx.id("journey-return").hidden = !state.readMemories.includes("ruisui-01");
    if (noteDirty && status.saved && state.notes.ruisui === travelNote.value) {
        noteDirty = false;
        ctx.cancelTimer(noteTimer);
        savedMessage.textContent = "✓ 已記錄這段旅程";
    }
    if (!noteDirty) travelNote.value = state.notes.ruisui ?? "";
    markVisibleMemoryRead();
});

if (station === "ruisui") {renderBook(4);rememberDiaryView();markVisibleMemoryRead();}
if (params.get("memories") === "1") memoryCount.click();

// 切換場景前先存心得；失敗時保留原畫面與文字。
ctx.beforeLeave(() => !noteDirty || saveTravelNote());
ctx.cleanup(() => { if (previewURL) URL.revokeObjectURL(previewURL); });

});
