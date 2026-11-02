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

/* StPageFlip HTML 書頁：沿用原站點節點、瑞穗內容與存檔。 */
const entries=[...diaryIndex.querySelectorAll('.station-journal')];
const book=document.createElement('section');book.className='pf-book';
const frame=document.createElement('div');frame.className='pf-frame';
const stage=document.createElement('div');stage.className='pf-stage';frame.append(stage);
const controls=document.createElement('nav');controls.className='pf-controls';controls.setAttribute('aria-label','書頁導覽');
controls.innerHTML='<button type="button" data-book="previous">← 上一站</button><button type="button" data-book="index">返回目錄</button><span role="status"></span><button type="button" data-book="next">下一站 →</button><button type="button" data-book="close">闔上</button>';
diaryIndex.before(book);book.append(stationDiary,frame,controls);
backToIndex.textContent='← 返回目錄';
function makePage(title,hard=false){const page=document.createElement('section');page.className='pf-page'+(hard?' pf-hard':'');if(hard)page.dataset.density='hard';if(title){const h=document.createElement('h2');h.textContent=title;page.append(h);}return page;}
const cover=makePage('阿明的日記',true);stage.append(cover);
const leftIndex=makePage('目錄');leftIndex.classList.add('pf-toc');
const heading=diaryIndex.querySelector('.index-title');heading.remove();
const leftList=document.createElement('div');leftList.className='station-journals';entries.slice(0,3).forEach(e=>leftList.append(e));leftIndex.append(leftList);
diaryIndex.className='pf-page pf-toc';const rightHeading=document.createElement('h2');rightHeading.textContent='目錄';diaryIndex.prepend(rightHeading);stage.append(leftIndex,diaryIndex);
// 將原左右頁節點移入對應HTML書頁，不複製內容與事件。
const rightAming=document.createElement('section'),rightPlayer=document.createElement('section');
rightAming.className=amingJournal.className+' pf-aming-right';rightPlayer.className=playerJournal.className;
rightAming.append(amingJournal.querySelector('.right-page'));rightPlayer.append(playerJournal.querySelector('.right-page'));
const lockedMessage=document.createElement('div');lockedMessage.className='locked-memory-message';lockedMessage.textContent='這段記憶尚未尋回。';rightAming.prepend(lockedMessage);
for(let n=1;n<=entries.length;n++){
 const left=makePage(),right=makePage();
 if(n===4){left.append(amingJournal,playerJournal);right.append(rightAming,rightPlayer);}
 else{for(const page of [left,right]){const h=document.createElement('h2');h.textContent=entries[n-1].querySelector('strong').textContent;const text=document.createElement('p');text.textContent='這段旅程尚未開放。';page.append(h,text);}}
 stage.append(left,right);
}
stage.append(makePage('阿明的日記',true));
let pageNumber=-1,flipping=false,engine,disposed=false;
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const pageFor=n=>n===-1?0:n===0?1:3+(n-1)*2;
function renderBook(n){pageNumber=n;stationDiary.classList.toggle('show',n===4);book.classList.toggle('pf-station',n===4);controls.querySelector('[data-book="previous"]').disabled=n<=0;controls.querySelector('[data-book="next"]').disabled=n>=entries.length;controls.querySelector('[data-book="close"]').disabled=n===-1;controls.querySelector('span').textContent=n===-1?'封面':n===0?'目錄':`${n} / ${entries.length}`;}
let resolveReady;const ready=new Promise(resolve=>resolveReady=resolve);
function initBook(){
 if(disposed)return;if(!stage.clientWidth||!stage.clientHeight){ctx.delay(initBook,16);return;}
 engine=new St.PageFlip(stage,{width:Math.max(100,Math.round(stage.clientWidth/2)),height:Math.max(150,Math.round(stage.clientHeight)),size:'stretch',minWidth:100,maxWidth:1200,minHeight:150,maxHeight:1200,autoSize:false,usePortrait:false,showCover:true,useMouseEvents:false,clickEventForward:true,flippingTime:reduced.matches?1:350,startPage:pageFor(pageNumber)});
 engine.on('init',()=>resolveReady());engine.loadFromHTML(stage.querySelectorAll(':scope > .pf-page'));
}
ctx.delay(initBook,0);
async function oneFlip(forward){
 const before=engine.getCurrentPageIndex();if(forward)engine.flipNext();else engine.flipPrev();
 const start=performance.now();
 await new Promise((resolve,reject)=>{function check(){if(disposed){resolve();return;}if(engine.getState()==='read'&&engine.getCurrentPageIndex()!==before){resolve();return;}if(performance.now()-start>6000){reject(new Error('翻頁未完成，請重試。'));return;}ctx.delay(check,16);}ctx.delay(check,16);});
}
async function turnTo(target){
 if(flipping||target===pageNumber)return;if(noteDirty&&!saveTravelNote())return;
 flipping=true;book.setAttribute('aria-busy','true');frame.inert=true;controls.inert=true;stationDiary.inert=true;
 try{await ready;if(disposed)return;const targetPage=pageFor(target);while(engine.getCurrentPageIndex()!==targetPage&&!disposed){await oneFlip(engine.getCurrentPageIndex()<targetPage);}if(!disposed){renderBook(target);rememberDiaryView();markVisibleMemoryRead();}}
 catch(error){controls.querySelector('span').textContent=error.message;}
 finally{flipping=false;book.removeAttribute('aria-busy');frame.inert=false;controls.inert=false;stationDiary.inert=false;}
}
ctx.on(cover,'click',()=>turnTo(0));
ctx.on(controls,'click',e=>{const action=e.target.closest('[data-book]')?.dataset.book;if(action)turnTo(action==='index'?0:action==='close'?-1:pageNumber===-1?0:pageNumber+(action==='next'?1:-1));});
ctx.beforeLeave(()=>!flipping);
ctx.cleanup(()=>{disposed=true;resolveReady();engine?.destroy();});
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
    rightAming.classList.toggle("active", !player);rightPlayer.classList.toggle("active", player);
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
    rightAming.classList.toggle("memory-locked", !found);
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
