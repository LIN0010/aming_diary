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
const controls=document.createElement('nav');controls.className='pf-actions';controls.setAttribute('aria-label','日記操作');
controls.innerHTML='<button type="button" data-book="index" aria-label="返回目錄" title="返回目錄"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 3h12v18l-6-4-6 4z"/></svg></button><button type="button" data-book="close">闔書／退出</button><span role="status" aria-live="polite"></span>';
diaryIndex.before(book);book.append(frame,controls);stationDiary.remove();
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
const backCover=makePage('阿明的日記',true);stage.append(backCover);
let readingActive=false,layoutPhase=false;
const readingUI=[ctx.query('.diary-header'),ctx.query('.bottom-nav')];
const ruisuiLeft=amingJournal.parentElement,ruisuiRight=rightAming.parentElement;
const amingRightPage=rightAming.querySelector('.journal-page'),playerRightPage=rightPlayer.querySelector('.journal-page');
const columnLabels=[amingJournal,playerJournal].map((journal,i)=>{const label=document.createElement('h3');label.className='pf-column-label';label.textContent=i?'我的旅程':'阿明的記憶';journal.prepend(label);return label;});
function arrangeReading(active){
 if(active){rightAming.remove();rightPlayer.remove();amingJournal.append(amingRightPage);playerJournal.append(playerRightPage);ruisuiRight.append(playerJournal);}
 else{ruisuiRight.append(rightAming,rightPlayer);rightAming.append(amingRightPage);rightPlayer.append(playerRightPage);ruisuiLeft.append(playerJournal);}
}
function syncBookSize(){
 if(!engine||engine.getState()!=='read')return;
 const size=measureBook();if(size.width<2||size.height<2)return;
 const settings=engine.getSettings();settings.width=size.width/2;settings.height=size.height;engine.update();appliedSize=`${size.width}x${size.height}`;
}
async function setReading(active){
 layoutPhase=true;
 if(active){readingUI.forEach(el=>el.inert=true);ctx.root.classList.add('pf-ui-hidden');}
 readingActive=active;ctx.root.classList.toggle('pf-reading',active);
 book.getBoundingClientRect();
 await Promise.all(book.getAnimations().map(animation=>animation.finished.catch(()=>{})));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 if(!disposed)syncBookSize();layoutPhase=false;
 if(!active){ctx.root.classList.remove('pf-ui-hidden');readingUI.forEach(el=>el.inert=false);}
}
let pageNumber=-1,flipping=false,engine,disposed=false;
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const pageFor=n=>n===-1?0:n===0?1:3+(n-1)*2;
function renderBook(n){pageNumber=n;stationDiary.classList.toggle('show',n===4);book.classList.toggle('pf-station',n===4);controls.hidden=!readingActive;}
arrangeReading(true);
let resolveReady;const ready=new Promise(resolve=>resolveReady=resolve);
let sizeObserver,layoutFrame=0,stableSize='',appliedSize='';
function measureBook(){return {width:Math.round(frame.clientWidth),height:Math.round(frame.clientHeight)};}
function scheduleBookLayout(){
 if(disposed||layoutFrame)return;
 layoutFrame=requestAnimationFrame(()=>{
  layoutFrame=0;if(disposed)return;
  const size=measureBook(),key=`${size.width}x${size.height}`;
  if(size.width<2||size.height<2)return;
  // 等連續兩個繪製週期取得相同尺寸，避開Safari旋轉過渡值。
  if(layoutPhase&&engine){syncBookSize();return;}
  if(stableSize!==key){stableSize=key;scheduleBookLayout();return;}
  if(!engine){initBook(size);return;}
  if(flipping||engine.getState()!=='read')return;
  if(appliedSize!==key){
   // 2.0.7的Render持有同一份settings；update重算bounds並保留當前書頁。
   const settings=engine.getSettings();settings.width=size.width/2;settings.height=size.height;
   engine.update();appliedSize=key;
  }
 });
}
function initBook(size){
 if(disposed||engine)return;
 engine=new St.PageFlip(stage,{width:size.width/2,height:size.height,size:'stretch',minWidth:1,maxWidth:1200,minHeight:1,maxHeight:1200,autoSize:false,usePortrait:false,showCover:true,drawShadow:true,maxShadowOpacity:0.25,useMouseEvents:true,showPageCorners:false,disableFlipByClick:true,mobileScrollSupport:false,clickEventForward:false,flippingTime:reduced.matches?1:350,startPage:pageFor(pageNumber)});
 engine.on('init',()=>{appliedSize=`${size.width}x${size.height}`;resolveReady();scheduleBookLayout();});
 const settleNative=()=>{
  if(disposed||flipping||layoutPhase)return;
  if(engine.getState()!=='read'){ctx.delay(settleNative,32);return;}
  const i=engine.getCurrentPageIndex();renderBook(i===0?-1:i<=2?0:Math.min(6,Math.floor((i-3)/2)+1));
  if((i===0||i===15)&&readingActive)setReading(false).then(()=>controls.hidden=true);
  rememberDiaryView();markVisibleMemoryRead();scheduleBookLayout();
 };
 engine.on('flip',()=>ctx.delay(settleNative,32));
 engine.on('changeState',e=>{if(e.data==='read'){scheduleBookLayout();ctx.delay(settleNative,32);}});
 engine.loadFromHTML(stage.querySelectorAll(':scope > .pf-page'));
}
if(typeof ResizeObserver!=='undefined'){sizeObserver=new ResizeObserver(scheduleBookLayout);sizeObserver.observe(frame);}
ctx.on(window,'resize',scheduleBookLayout);ctx.on(window,'orientationchange',scheduleBookLayout);
if(window.visualViewport)ctx.on(window.visualViewport,'resize',scheduleBookLayout);
ctx.delay(scheduleBookLayout,0);
async function oneFlip(forward){
 const before=engine.getCurrentPageIndex();if(forward)engine.flipNext();else engine.flipPrev();
 const start=performance.now();
 await new Promise((resolve,reject)=>{function check(){if(disposed){resolve();return;}if(engine.getState()==='read'&&engine.getCurrentPageIndex()!==before){resolve();return;}if(performance.now()-start>6000){reject(new Error('翻頁未完成，請重試。'));return;}ctx.delay(check,16);}ctx.delay(check,16);});
}
async function turnTo(target){
 if(flipping||layoutPhase||engine&&engine.getState()!=='read'||target===pageNumber&&engine?.getCurrentPageIndex()===pageFor(target))return;if(noteDirty&&!saveTravelNote())return;
 flipping=true;book.setAttribute('aria-busy','true');frame.inert=true;controls.inert=true;stationDiary.inert=true;
 try{await ready;if(disposed)return;if(!readingActive&&target>=0)await setReading(true);const targetPage=pageFor(target);while(engine.getCurrentPageIndex()!==targetPage&&!disposed){await oneFlip(engine.getCurrentPageIndex()<targetPage);}if(!disposed){renderBook(target);if(target===-1&&readingActive){await setReading(false);controls.hidden=true;}rememberDiaryView();markVisibleMemoryRead();}}
 catch(error){controls.querySelector('span').textContent=error.message;if(readingActive){ctx.root.classList.remove('pf-ui-hidden');readingUI.forEach(el=>el.inert=false);}}
 finally{flipping=false;book.removeAttribute('aria-busy');frame.inert=false;controls.inert=false;stationDiary.inert=false;scheduleBookLayout();}
}
ctx.on(cover,'click',()=>{if(!readingActive)turnTo(0);});
ctx.on(backCover,'click',()=>{if(!readingActive)turnTo(6);});
// 封面先放大、同步尺寸再翻開；內容手勢交給輸入與捲動，紙張邊緣交給套件。
for(const type of ['mousedown','touchstart'])ctx.on(stage,type,event=>{
 if(!readingActive||flipping||layoutPhase||noteDirty&&!saveTravelNote()) {event.stopImmediatePropagation();return;}
 const point=event.touches?.[0]||event, page=event.target.closest('.pf-page'), rect=page?.getBoundingClientRect();
 const edge=rect&&(point.clientX-rect.left<22||rect.right-point.clientX<22);
 if(event.target.closest('input,textarea,label,a,button:not(.station-journal)')||!edge&&event.target.closest('.journal-content,.station-journal'))event.stopPropagation();
},{capture:true});
for(const type of ['mousedown','touchstart'])ctx.on(cover,type,event=>{
 if(!readingActive)event.stopPropagation();
});
ctx.on(controls,'click',e=>{const action=e.target.closest('[data-book]')?.dataset.book;if(action)turnTo(action==='index'?0:action==='close'?-1:pageNumber===-1?0:pageNumber+(action==='next'?1:-1));});
ctx.beforeLeave(()=>!flipping&&!layoutPhase&&(!engine||engine.getState()==='read'));
ctx.on(ctx.root,'scroll',()=>{if(readingActive){ctx.root.scrollLeft=0;ctx.root.scrollTop=0;}},{passive:true});
ctx.cleanup(()=>{readingUI.forEach(el=>el.inert=false);disposed=true;cancelAnimationFrame(layoutFrame);sizeObserver?.disconnect();resolveReady();engine?.destroy();});
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
    if (stationDiary.classList.contains("show") && (readingActive || amingJournal.classList.contains("active"))) {
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

if (station === "ruisui") ctx.delay(()=>turnTo(4),0);
if (params.get("memories") === "1") memoryCount.click();

// 切換場景前先存心得；失敗時保留原畫面與文字。
ctx.beforeLeave(() => !noteDirty || saveTravelNote());
ctx.cleanup(() => { if (previewURL) URL.revokeObjectURL(previewURL); });

});
