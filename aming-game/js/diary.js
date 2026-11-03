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
const borderDebug = params.get('debug') === '1';
if (borderDebug) {
 const settings=document.createElement('button');settings.type='button';settings.className='pf-debug-toggle';settings.setAttribute('aria-label','書頁外框設定');settings.setAttribute('aria-expanded','false');settings.setAttribute('aria-controls','pf-border-panel');
 settings.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="#f5ecdb"/><circle cx="16" cy="17" r="3" fill="#f5ecdb"/></svg>';
 const panel=document.createElement('section');panel.id='pf-border-panel';panel.className='pf-border-panel';panel.hidden=true;panel.setAttribute('aria-label','書頁外框調整');
 panel.innerHTML='<label for="pf-border-range">外框透明度</label><input id="pf-border-range" type="range" min="0.10" max="0.70" step="0.01" value="0.35"><output for="pf-border-range">0.35</output>';
 const slider=panel.querySelector('input'),value=panel.querySelector('output');
 const update=()=>{const next=Number(slider.value).toFixed(2);ctx.root.style.setProperty('--page-border-opacity',next);value.value=next;};update();
 ctx.root.append(settings,panel);ctx.on(slider,'input',update);
 const close=()=>{panel.hidden=true;settings.setAttribute('aria-expanded','false');};
 ctx.on(settings,'click',()=>{panel.hidden=!panel.hidden;settings.setAttribute('aria-expanded',String(!panel.hidden));});
 ctx.on(panel,'keydown',e=>{if(e.key==='Escape'){close();settings.focus();}});
 ctx.on(document,'pointerdown',e=>{if(!panel.contains(e.target)&&!settings.contains(e.target))close();});
}


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
controls.innerHTML='<button type="button" class="pf-index-tab" data-book="index" hidden aria-label="返回目錄" title="返回目錄">目錄</button><button type="button" data-book="close">闔上日記</button><span role="status" aria-live="polite"></span>';
const indexBookmark=controls.querySelector('[data-book="index"]');
diaryIndex.before(book);book.append(indexBookmark,frame,controls);stationDiary.remove();
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
// 共用未發現跨頁：保持原紙色，兩張紙頁各自承載小鎖頭與提示。
function mountUndiscoveredSpread(left, right, entry) {
 const name=entry.querySelector('strong').textContent.trim();
 const unknown=entry.querySelector('small')?.textContent.trim()==='UNKNOWN'||!name||/[?？]/.test(name);
 const title=unknown?'未知的下一站，正等待你的發現。':name+'，正等待你的發現。';
 const placeholders=[left,right].map((page,side)=>{
  const placeholder=document.createElement('div');placeholder.className='pf-undiscovered-page';
  const copy=document.createElement('div');copy.className='pf-undiscovered-copy';
  const lock=document.createElement('span');lock.className='pf-undiscovered-lock';lock.setAttribute('aria-hidden','true');
  lock.innerHTML='<svg viewBox="0 0 24 28" width="24" height="28" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 12V8a5 5 0 0 1 10 0v4"/><rect x="4" y="12" width="16" height="13" rx="2"/><path d="M12 17v3"/></svg>';
  const text=document.createElement('p');text.className=side?'pf-undiscovered-hint':'pf-undiscovered-title';
  text.textContent=side?'沿著鐵道前行，尋找尚未拾起的記憶。':title;
  copy.append(lock,text);placeholder.append(copy);page.append(placeholder);return placeholder;
 });
 // 沿用原目錄的鎖定條件，不刪除頁內內容，也不新增解鎖途徑。
 const sync=()=>{const locked=entry.disabled||entry.classList.contains('locked');placeholders.forEach(placeholder=>placeholder.hidden=!locked);};
 sync();
 const observer=new MutationObserver(sync);observer.observe(entry,{attributes:true,attributeFilter:['class','disabled']});
 ctx.cleanup(()=>observer.disconnect());
}
for(let n=1;n<=entries.length;n++){
 const left=makePage(),right=makePage();
 if(n===4){left.append(amingJournal,playerJournal);right.append(rightAming,rightPlayer);}
 else{mountUndiscoveredSpread(left,right,entries[n-1]);}
 stage.append(left,right);
}
const backCover=makePage('阿明的日記',true);stage.append(backCover);
let readingActive=false,layoutPhase=false;
const readingUI=[ctx.query('.diary-header'),ctx.query('.bottom-nav')];
// 只搬移既有節點：左欄照片、右欄故事與心得，各自捲動。
const photoColumn=document.createElement('div'),textColumn=document.createElement('div');
photoColumn.className='pf-rui-column pf-photo-column';textColumn.className='pf-rui-column pf-text-column';
amingJournal.parentElement.prepend(photoColumn);rightAming.parentElement.prepend(textColumn);
photoColumn.append(amingJournal,playerJournal);textColumn.append(rightAming,rightPlayer);
// 收藏物件仍使用原節點，作為故事旁的小貼紙。
const storyEntry=rightAming.querySelector('.diary-entry');
storyEntry.insertBefore(rightAming.querySelector('.memory-fragment'),storyEntry.querySelector('p'));
rightPlayer.classList.add('pf-player-writing');
rightPlayer.querySelector('.travel-entry h2').textContent='我的旅行心得';
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
let bookmarkClosing=false,bookmarkFadeToken=0,bookmarkFadePromise=null;
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const pageFor=n=>n===-1?0:n===0?1:3+(n-1)*2;
// 闔書先淡出索引；token 避免取消拖曳後的舊動畫回呼再次隱藏它。
function fadeIndexForClose(){
 if(bookmarkClosing)return bookmarkFadePromise||Promise.resolve();
 bookmarkClosing=true;const token=++bookmarkFadeToken;
 indexBookmark.disabled=true;
 indexBookmark.getBoundingClientRect();indexBookmark.classList.add('pf-index-fading');
 bookmarkFadePromise=Promise.all(indexBookmark.getAnimations().map(a=>a.finished.catch(()=>{}))).then(()=>{
  if(!disposed&&token===bookmarkFadeToken)indexBookmark.hidden=true;
 });
 return bookmarkFadePromise;
}
// 一般翻頁仍在穩定頁碼才同步；取消闔書拖曳時可恢復車站索引。
function syncIndexBookmark(){
 if(disposed)return;
 if(!engine){indexBookmark.hidden=true;return;}
 if(layoutPhase||engine.getState()!=='read')return;
 const current=engine.getCurrentPageIndex();
 ++bookmarkFadeToken;bookmarkClosing=false;bookmarkFadePromise=null;
 indexBookmark.classList.remove('pf-index-fading');indexBookmark.disabled=false;
 indexBookmark.hidden=!(readingActive&&current>=3&&current<=14);
}
function renderBook(n){pageNumber=n;stationDiary.classList.toggle('show',n===4);book.classList.toggle('pf-station',n===4);controls.hidden=!readingActive;syncIndexBookmark();}
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
 engine=new St.PageFlip(stage,{width:size.width/2,height:size.height,size:'stretch',minWidth:1,maxWidth:1200,minHeight:1,maxHeight:1200,autoSize:false,usePortrait:false,showCover:true,useMouseEvents:true,showPageCorners:false,disableFlipByClick:true,mobileScrollSupport:false,clickEventForward:false,flippingTime:reduced.matches?1:350,startPage:pageFor(pageNumber)});
 engine.on('init',()=>{appliedSize=`${size.width}x${size.height}`;resolveReady();scheduleBookLayout();});
 const settleNative=()=>{
  if(disposed||flipping||layoutPhase)return;
  if(engine.getState()!=='read'){ctx.delay(settleNative,32);return;}
  const i=engine.getCurrentPageIndex();renderBook(i===0?-1:i<=2?0:Math.min(6,Math.floor((i-3)/2)+1));
  if((i===0||i===15)&&readingActive)setReading(false).then(()=>controls.hidden=true);
  rememberDiaryView();markVisibleMemoryRead();scheduleBookLayout();
 };
 engine.on('flip',()=>ctx.delay(settleNative,32));
 engine.on('changeState',e=>{
  if(!flipping&&(e.data==='user_fold'||e.data==='flipping')){
   const checkNativeClose=()=>{
    if(disposed||flipping||engine.getState()==='read')return;
    const i=engine.getCurrentPageIndex(),direction=engine.getFlipController().getCalculation()?.getDirection();
    if((i===13&&direction===0)||(i===1&&direction===1))fadeIndexForClose();
   };
   // user_fold 事件早於套件建立計算物件，下一個事件週期再讀取方向。
   ctx.delay(checkNativeClose,0);
  }
  if(e.data==='read'){scheduleBookLayout();ctx.delay(settleNative,32);}
 });
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
 const closeFade=target===-1?fadeIndexForClose():null;
 try{await ready;if(closeFade)await closeFade;if(disposed)return;if(!readingActive&&target>=0)await setReading(true);const targetPage=pageFor(target);while(engine.getCurrentPageIndex()!==targetPage&&!disposed){await oneFlip(engine.getCurrentPageIndex()<targetPage);}if(!disposed){renderBook(target);if(target===-1&&readingActive){await setReading(false);controls.hidden=true;}rememberDiaryView();markVisibleMemoryRead();}}
 catch(error){controls.querySelector('span').textContent=error.message;if(readingActive){ctx.root.classList.remove('pf-ui-hidden');readingUI.forEach(el=>el.inert=false);}}
 finally{flipping=false;book.removeAttribute('aria-busy');frame.inert=false;controls.inert=false;stationDiary.inert=false;syncIndexBookmark();scheduleBookLayout();}
}
ctx.on(cover,'click',()=>{if(!readingActive)turnTo(0);});
ctx.on(backCover,'click',()=>{if(!readingActive)turnTo(6);});
// 封面先放大、同步尺寸再翻開；內容手勢交給輸入與捲動，紙張邊緣交給套件。
for(const type of ['mousedown','touchstart'])ctx.on(stage,type,event=>{
 if(!readingActive||flipping||layoutPhase||noteDirty&&!saveTravelNote()) {event.stopImmediatePropagation();return;}
 const point=event.touches?.[0]||event, page=event.target.closest('.pf-page'), rect=page?.getBoundingClientRect();
 const edge=rect&&(point.clientX-rect.left<22||rect.right-point.clientX<22);
 if(event.target.closest('input,textarea,label,a,button:not(.station-journal)')||!edge&&event.target.closest('.journal-content,.station-journal,.pf-rui-column'))event.stopPropagation();
},{capture:true});
for(const type of ['mousedown','touchstart'])ctx.on(cover,type,event=>{
 if(!readingActive)event.stopPropagation();
});
ctx.on(indexBookmark,'click',()=>turnTo(0));
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
    const nextRoute=open ? "diary.html?station=ruisui&tab=" + (player ? "player" : "aming") : "diary.html";
    ctx.replaceRoute(nextRoute + (borderDebug ? (open ? "&" : "?") + "debug=1" : ""));
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
