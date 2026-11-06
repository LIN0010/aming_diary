/* 真實 HTML 群組：不將故事或心得轉成 Canvas；同頁座標與裝飾存檔共用。 */
(() => {
 'use strict';
 window.JournalDomLayout={mount({ctx,groups,checkpoint,changed,select,saved=[]}){
  let editing=false,initialized=false,active=null,gesture=null;
  const items=[],defaults=[];let rightPaper;
  if(!Array.isArray(saved))throw Error('invalid-dom-layout');
  let pending=saved;
  const allowed=new Set(groups.map(g=>g.id));
  if(pending.some(r=>!allowed.has(r.id)||![r.x,r.y,r.width,r.angle,r.order].every(Number.isFinite)||r.width<=0))throw Error('invalid-dom-layout');
  function initialize(){
   if(initialized||!ctx.root.classList.contains('pf-reading')||!GameProgress.hasMemory('ruisui-01')||!groups.every(g=>g.node.getBoundingClientRect().width))return;
   const measurements=groups.map(g=>{const n=g.node,p=n.closest('.pf-page'),r=n.getBoundingClientRect(),b=p.getBoundingClientRect(),cs=getComputedStyle(n);const angle=cs.transform==='none'?0:Math.atan2(new DOMMatrix(cs.transform).b,new DOMMatrix(cs.transform).a)*180/Math.PI;return {...g,page:p,width:n.offsetWidth,height:n.offsetHeight,style:cs,record:{id:g.id,page:g.side,type:'html',x:(r.left+r.width/2-b.left-n.offsetWidth/2)/b.width,y:(r.top+r.height/2-b.top-n.offsetHeight/2)/b.height,width:n.offsetWidth/b.width,angle,order:g.id==='memory-fragment'?20:10+groups.indexOf(g)}};});
   // 先量測全部群組，再搬移節點，避免抽出收藏圖後改變故事的基準矩形。
   for(const g of measurements){
    const slot=document.createElement('div');slot.className='journal-dom-slot';slot.style.cssText=`width:${g.width}px;height:${g.height}px;order:${g.style.order};float:${g.style.cssFloat};margin:${g.style.margin};flex:${g.style.flex};visibility:hidden;pointer-events:none;`;
    g.node.before(slot);
    const box=document.createElement('section');box.className='journal-dom-object '+(g.text?'is-text':'is-picture');box.dataset.domObject=g.id;box.style.setProperty('--dom-photo-ratio',g.width/g.height);box.setAttribute('aria-label',g.name);box.tabIndex=-1;
    const content=document.createElement('div');content.className='journal-dom-content';content.append(g.node);box.append(content);g.page.append(box);
    const handles=document.createElement('div');handles.className='journal-dom-handles';
    for(const [action,label] of [['move','移動'],['resize','調整寬度與大小'],['rotate','旋轉']]){const h=document.createElement('button');h.type='button';h.dataset.domHandle=action;h.setAttribute('aria-label',g.name+label);h.title=label;h.textContent=action==='move'?'✥':action==='resize'?'↘':'↻';handles.append(h);}
    if(g.side==='right'){if(!rightPaper){const surface=document.createElement('div');surface.className='journal-dom-surface';rightPaper=document.createElement('div');rightPaper.className='journal-dom-paper';surface.append(rightPaper);g.page.append(surface);}rightPaper.append(box);}
    box.append(handles);const item={...g,box,content,slot,record:{...g.record}};items.push(item);defaults.push({...g.record});
    ctx.on(box,'pointerdown',e=>start(e,item));
    ctx.on(box,'keydown',e=>{const action=e.target.dataset.domHandle;if(!editing||!action||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();checkpoint();choose(item);const delta=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;if(action==='rotate')item.record.angle+=delta*5;else if(action==='resize')item.record.width+=delta*.02;else item.record[e.key.includes('Left')||e.key.includes('Right')?'x':'y']+=delta*.02;apply(item);changed();});
   }
   initialized=true;if(pending.length)restore(pending);else items.forEach(apply);
  }
  function apply(item){
   const {record:r,box,page}=item,w=page.clientWidth,h=page.clientHeight;if(!w||!h)return;
   r.width=Math.max(Math.min(item.text?160:48,w-16)/w,Math.min(1-16/w,r.width));r.angle=Math.max(-45,Math.min(45,r.angle));
   if(item.text){while(Math.abs(r.angle)>.1&&r.width*w*Math.cos(r.angle*Math.PI/180)+80*Math.abs(Math.sin(r.angle*Math.PI/180))>w-16)r.angle/=2;}
   const sin=Math.abs(Math.sin(r.angle*Math.PI/180)),cos=Math.cos(r.angle*Math.PI/180);
   if(!item.text){const ratio=item.width/item.height;r.width=Math.min(r.width,(w-16)/(cos+sin/ratio)/w,(h-16)/(sin+cos/ratio)/w);}
   box.style.width=r.width*100+'%';box.style.zIndex=String(editing&&active===item?100:r.order);
   const maxHeight=item.text?Math.min(h-20,(h-20-r.width*w*sin)/cos,sin>.001?(w-16-r.width*w*cos)/sin:h-20):h-20;
   box.style.setProperty('--dom-max-height',Math.max(80,maxHeight)+'px');
   r.x=Math.max(8/w,Math.min(1-r.width-8/w,r.x));r.y=item.side==='right'?Math.max(8/h,r.y):Math.max(8/h,Math.min(Math.max(8/h,(h-box.offsetHeight-8)/h),r.y));
   box.style.left=r.x*100+'%';box.style.top=r.y*100+'%';box.style.transform=`rotate(${r.angle}deg)`;
   const bounds=box.getBoundingClientRect(),paper=page.getBoundingClientRect();
   r.x+=(Math.max(paper.left+8-bounds.left,Math.min(0,paper.right-8-bounds.right)))/w;if(item.side!=='right')r.y+=(Math.max(paper.top+8-bounds.top,Math.min(0,paper.bottom-8-bounds.bottom)))/h;
   box.style.left=r.x*100+'%';box.style.top=r.y*h+'px';
   if(rightPaper)rightPaper.style.height=Math.max(h,...items.filter(g=>g.side==='right').map(g=>g.record.y*h+g.box.offsetHeight+24))+'px';
  }
  function choose(item){active=item;items.forEach(g=>(g.box.classList.toggle('is-selected',g===item),g.box.style.zIndex=String(g===item?100:g.record.order)));select();}
  function clear(){active=null;items.forEach(g=>(g.box.classList.remove('is-selected'),g.box.style.zIndex=String(g.record.order)));}
  function start(e,item){
   if(!editing||e.button>0)return;
   const control=e.target.closest('input,textarea,a,button:not([data-dom-handle])');
   if(control){choose(item);return;}
   e.preventDefault();e.stopPropagation();choose(item);checkpoint();
   const page=item.page.getBoundingClientRect(),box=item.box.getBoundingClientRect();
   gesture={item,action:e.target.dataset.domHandle||'move',x:e.clientX,y:e.clientY,record:{...item.record},page,cx:box.left+box.width/2,cy:box.top+box.height/2};
   item.box.setPointerCapture(e.pointerId);
  }
  ctx.on(window,'pointermove',e=>{
   if(!gesture)return;e.preventDefault();const g=gesture,r=g.item.record,dx=e.clientX-g.x,dy=e.clientY-g.y;
   if(g.action==='move'){r.x=g.record.x+dx/g.page.width;r.y=g.record.y+dy/g.page.height;}
   if(g.action==='resize')r.width=g.record.width+dx/g.page.width;
   if(g.action==='rotate')r.angle=g.record.angle+(Math.atan2(e.clientY-g.cy,e.clientX-g.cx)-Math.atan2(g.y-g.cy,g.x-g.cx))*180/Math.PI;
   apply(g.item);
  },{passive:false});
  for(const type of ['pointerup','pointercancel'])ctx.on(window,type,()=>{if(gesture){gesture=null;changed();}});
  ctx.on(ctx.root,'pointerdown',e=>{if(editing&&!e.target.closest('.journal-dom-object,.pf-actions'))clear();});
  function capture(){return initialized?items.map(g=>({...g.record})):pending.map(r=>({...r}));}
  function restore(records){pending=records.map(r=>({...r}));if(initialized){items.forEach(g=>{g.record={...(records.find(r=>r.id===g.id)||defaults.find(r=>r.id===g.id))};apply(g);});}clear();}
  function sync(value){editing=value;const unlocked=GameProgress.hasMemory('ruisui-01');if(value||pending.length)initialize();items.forEach(g=>{g.box.hidden=!unlocked;g.box.classList.toggle('is-editing',editing);if(!editing)(g.box.classList.remove('is-selected'),g.box.style.zIndex=String(g.record.order));apply(g);});if(!editing)active=null;}
  const observer=new ResizeObserver(()=>items.forEach(apply));groups.forEach(g=>observer.observe(g.node.closest('.pf-page')));
  // 心得隨輸入增高；保留 textarea、原節點與其所有既有儲存事件。
  const note=ctx.id('travel-note');ctx.on(note,'input',()=>{note.style.height='auto';note.style.height=Math.max(120,note.scrollHeight)+'px';});
  ctx.cleanup(()=>observer.disconnect());
  return {hitStart(e){const item=items.slice().sort((a,b)=>b.record.order-a.record.order).find(g=>{const r=g.box.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});if(item){start(e,item);return true;}return false;},sync,capture,restore,clear,reset(){restore(defaults);},get selected(){return !!active;}};
 }};
})();
