/* 真實 HTML 群組：不將故事或心得轉成 Canvas；同頁座標與裝飾存檔共用。 */
(() => {
 'use strict';
 window.JournalDomLayout={mount({ctx,spread,groups,checkpoint,changed,select,saved=[]}){
  let editing=false,initialized=false,active=null,gesture=null;
  const items=[],defaults=[];let rightPaper;
  if(!Array.isArray(saved))throw Error('invalid-dom-layout');
  let pending=saved;
  const allowed=new Set(groups.map(g=>g.id));
  if(pending.some(r=>!allowed.has(r.id)||(r.page&&!['left','right'].includes(r.page))||![r.x,r.y,r.width,r.angle,r.order].every(Number.isFinite)||r.width<=0||(r.height!==undefined&&(!Number.isFinite(r.height)||r.height<=0))))throw Error('invalid-dom-layout');
  function initialize(){
   if(initialized||!ctx.root.classList.contains('pf-reading')||!GameProgress.hasMemory('ruisui-01')||!groups.every(g=>g.node.getBoundingClientRect().width))return;
   const measurements=groups.map(g=>{const n=g.node,p=n.closest('.pf-page'),r=n.getBoundingClientRect(),b=p.getBoundingClientRect(),cs=getComputedStyle(n);const angle=cs.transform==='none'?0:Math.atan2(new DOMMatrix(cs.transform).b,new DOMMatrix(cs.transform).a)*180/Math.PI;return {...g,page:p,width:n.offsetWidth,height:n.offsetHeight,style:cs,record:{id:g.id,page:g.side,type:'html',x:(r.left+r.width/2-b.left-n.offsetWidth/2)/b.width,y:(r.top+r.height/2-b.top-n.offsetHeight/2)/b.height,width:n.offsetWidth/b.width,angle,order:g.id==='memory-fragment'?20:10+groups.indexOf(g)}};});
   // 先量測全部群組，再搬移節點，避免抽出收藏圖後改變故事的基準矩形。
   for(const g of measurements){
    const slot=document.createElement('div');slot.className='journal-dom-slot';slot.style.cssText=`width:${g.width}px;height:${g.height}px;order:${g.style.order};float:${g.style.cssFloat};margin:${g.style.margin};flex:${g.style.flex};visibility:hidden;pointer-events:none;`;
    g.node.before(slot);
    const box=document.createElement('section');box.className='journal-dom-object '+(g.text?'is-text':'is-picture');box.dataset.domObject=g.id;if(g.text)box.classList.add('has-text-controls');box.style.setProperty('--dom-photo-ratio',g.width/g.height);box.setAttribute('aria-label',g.name);box.tabIndex=-1;
    const content=document.createElement('div');content.className='journal-dom-content';content.append(g.node);box.append(content);g.page.append(box);
    const handles=document.createElement('div');handles.className='journal-dom-handles';handles.dataset.domControls=g.id;
    const controls=g.text?[['nw','左上調整'],['n','上方調整'],['ne','右上調整'],['w','左側調整寬度'],['e','右側調整寬度'],['sw','左下調整'],['s','下方調整'],['se','右下調整'],['rotate','旋轉']]:[['move','移動'],['resize','調整寬度與大小'],['rotate','旋轉']];
    for(const [action,label] of controls){const h=document.createElement('button');h.type='button';h.dataset.domHandle=action;h.setAttribute('aria-label',g.name+label);h.title=label;if(!g.text)h.textContent=action==='move'?'✥':action==='resize'?'↘':'↻';handles.append(h);}
    if(g.side==='right'){if(!rightPaper){const surface=document.createElement('div');surface.className='journal-dom-surface';rightPaper=document.createElement('div');rightPaper.className='journal-dom-paper';surface.append(rightPaper);g.page.append(surface);}rightPaper.append(box);}
    box.append(handles);const item={...g,box,content,slot,handles,record:{...g.record}};if(g.text){handles.classList.add('journal-text-controls');handles.hidden=true;spread.host.append(handles);ctx.on(handles,'pointerdown',e=>start(e,item));}items.push(item);spread.stack.register({id:g.id,name:g.name,base:g.record.order,record:()=>item.record,element:box,select:()=>choose(item)});defaults.push({...g.record});
    ctx.on(box,'pointerdown',e=>start(e,item));
    const keyControl=e=>{const action=e.target.dataset.domHandle;if(!editing||!action||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();checkpoint();choose(item);const delta=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;if(action==='rotate')item.record.angle+=delta*5;else if(action==='resize'||['nw','ne','w','e','sw','se'].includes(action))item.record.width+=delta*.02;else if(['n','s'].includes(action))item.record.height=Math.max(.05,(item.record.height||item.box.offsetHeight/item.page.clientHeight)+delta*.02);else item.record[e.key.includes('Left')||e.key.includes('Right')?'x':'y']+=delta*.02;apply(item);changed();};ctx.on(box,'keydown',keyControl);if(g.text)ctx.on(handles,'keydown',keyControl);
   }
   initialized=true;if(pending.length)restore(pending);else items.forEach(apply);
  }
  function place(item){const owner=item.record.page||'right';item.page=spread.pages[owner];item.side=owner;const parent=editing?spread.host:owner==='right'&&rightPaper?rightPaper:item.page;if(item.box.parentElement!==parent)parent.append(item.box);}
  function apply(item){
   if(gesture?.item===item&&gesture.action==='move')return;
   const {record:r,box,page}=item,w=page.clientWidth,h=page.clientHeight;if(!w||!h)return;
   r.width=Math.max(Math.min(item.text?160:48,w-16)/w,Math.min(1-16/w,r.width));r.angle=Math.max(-45,Math.min(45,r.angle));
   if(item.text){while(Math.abs(r.angle)>.1&&r.width*w*Math.cos(r.angle*Math.PI/180)+80*Math.abs(Math.sin(r.angle*Math.PI/180))>w-16)r.angle/=2;}
   const sin=Math.abs(Math.sin(r.angle*Math.PI/180)),cos=Math.cos(r.angle*Math.PI/180);
   if(!item.text){const ratio=item.width/item.height;r.width=Math.min(r.width,(w-16)/(cos+sin/ratio)/w,(h-16)/(sin+cos/ratio)/w);}
   box.dataset.journalPage=item.side;
   const origin=editing?spread.offset(item.side)/1200*spread.book.clientWidth:0;
   box.style.width=editing?r.width*w+'px':r.width*100+'%';box.style.zIndex=String(spread.stack.rank(item.id));
   const usable=h-20;
   const maxHeight=item.text?Math.min(Math.max(80,usable-r.y*h),(h-20-r.width*w*sin)/cos,sin>.001?(w-16-r.width*w*cos)/sin:h-20):h-20;
   box.style.setProperty('--dom-max-height',Math.max(80,maxHeight)+'px');
   if(item.text)item.content.style.minHeight=r.height?Math.min(r.height*h,Math.max(80,maxHeight))+'px':'';
   r.x=Math.max(8/w,Math.min(1-r.width-8/w,r.x));r.y=Math.max(8/h,Math.min(Math.max(8/h,(h-box.offsetHeight-8)/h),r.y));
   box.style.left=(editing?origin+r.x*w:r.x*w-page.clientLeft)+'px';box.style.top=(r.y*h-(editing?0:page.clientTop))+'px';box.style.transform=`rotate(${r.angle}deg)`;
   const bounds=box.getBoundingClientRect(),paper=page.getBoundingClientRect();
   r.x+=(Math.max(paper.left+8-bounds.left,Math.min(0,paper.right-8-bounds.right)))/w;r.y+=(Math.max(paper.top+8-bounds.top,Math.min(0,paper.bottom-8-bounds.bottom)))/h;
   box.style.left=(editing?origin+r.x*w:r.x*w-page.clientLeft)+'px';box.style.top=(r.y*h-(editing?0:page.clientTop))+'px';
   positionControls();
   if(rightPaper)rightPaper.style.height=Math.max(h,...items.filter(g=>g.side==='right').map(g=>g.record.y*h+g.box.offsetHeight+24))+'px';
  }
  function positionControls(){for(const g of items){if(!g.text)continue;g.handles.hidden=!editing||active!==g;if(g.handles.hidden)continue;const b=g.box.getBoundingClientRect(),p=spread.book.getBoundingClientRect();Object.assign(g.handles.style,{width:g.box.offsetWidth+'px',height:g.box.offsetHeight+'px',left:(b.left+b.width/2-g.box.offsetWidth/2-p.left)+'px',top:(b.top+b.height/2-g.box.offsetHeight/2-p.top)+'px',transform:`rotate(${g.record.angle}deg)`});}}
  function choose(item){active=item;items.forEach(g=>(g.box.classList.toggle('is-selected',g===item),g.box.style.zIndex=String(spread.stack.rank(g.id))));spread.stack.selected(item.id);positionControls();select();}
  function clear(){if(active&&spread.stack.active===active.id)spread.stack.selected(null);active=null;positionControls();items.forEach(g=>(g.box.classList.remove('is-selected'),g.box.style.zIndex=String(spread.stack.rank(g.id))));}
  function start(e,item){
   if(!editing||e.button>0)return;
   const control=e.target.closest('input,textarea,a,button:not([data-dom-handle])');
   if(control){choose(item);return;}
   e.preventDefault();e.stopPropagation();choose(item);checkpoint();
   const page=item.page.getBoundingClientRect(),box=item.box.getBoundingClientRect();
   gesture={item,action:e.target.dataset.domHandle||'move',x:e.clientX,y:e.clientY,record:{...item.record},width:item.box.offsetWidth,height:item.box.offsetHeight,page,cx:box.left+box.width/2,cy:box.top+box.height/2};
   if(gesture.action==='move'){
    const r=spread.book.getBoundingClientRect();gesture.parent=item.box.parentElement;
    gesture.left=box.left+box.width/2-item.box.offsetWidth/2-r.left;gesture.top=box.top+box.height/2-item.box.offsetHeight/2-r.top;
    const width=item.box.offsetWidth;if(item.box.parentElement!==spread.host)spread.host.append(item.box);item.box.style.width=width+'px';item.box.style.left=gesture.left+'px';item.box.style.top=gesture.top+'px';
   }
   item.box.setPointerCapture(e.pointerId);
  }
  ctx.on(window,'pointermove',e=>{
   if(!gesture)return;e.preventDefault();const g=gesture,r=g.item.record,dx=e.clientX-g.x,dy=e.clientY-g.y;
   if(g.action==='move'){g.item.box.style.left=g.left+dx+'px';g.item.box.style.top=g.top+dy+'px';positionControls();return;}
   if(g.item.text&&['nw','n','ne','w','e','sw','s','se'].includes(g.action)){
    // 在文字框自身座標中改寬度／留白高度，HTML 自行換行，絕不縮放字級。
    const a=g.record.angle*Math.PI/180,localX=dx*Math.cos(a)+dy*Math.sin(a),localY=-dx*Math.sin(a)+dy*Math.cos(a),west=g.action.includes('w'),east=g.action.includes('e'),north=g.action.includes('n'),south=g.action.includes('s');
    const width=Math.max(Math.min(160,g.page.width-16),Math.min(g.page.width-16,g.width+(west?-localX:east?localX:0)));
    r.width=width/g.page.width;
    const height=Math.max(80,g.height+(north?-localY:south?localY:0));
    if(north||south)r.height=height/g.page.height;
    r.x=g.record.x+(west?(g.width-width)/g.page.width:0);
    r.y=g.record.y+(north?(g.height-height)/g.page.height:0);
   }
   if(g.action==='resize')r.width=g.record.width+dx/g.page.width;
   if(g.action==='rotate')r.angle=g.record.angle+(Math.atan2(e.clientY-g.cy,e.clientX-g.cx)-Math.atan2(g.y-g.cy,g.x-g.cx))*180/Math.PI;
   apply(g.item);
  },{passive:false});
  for(const type of ['pointerup','pointercancel'])ctx.on(window,type,()=>{
   if(!gesture)return;const g=gesture;gesture=null;
   if(g.action==='move'){
    const box=g.item.box,r=spread.book.getBoundingClientRect(),b=box.getBoundingClientRect(),a=g.item.record.angle*Math.PI/180,cx=(b.left+b.width/2-r.left)/r.width*1200,cy=(b.top+b.height/2-r.top)/r.height*800,w=box.offsetWidth/r.width*1200,h=box.offsetHeight/r.height*800;
    const poly=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>({x:cx+x*Math.cos(a)-y*Math.sin(a),y:cy+x*Math.sin(a)+y*Math.cos(a)}));
    const owner=type==='pointercancel'?(g.record.page||g.item.side):spread.choose(poly,g.record.page||g.item.side);
    if(type==='pointercancel')g.item.record={...g.record};else{g.item.record.page=owner;g.item.record.x=(parseFloat(box.style.left)-spread.offset(owner)/1200*spread.book.clientWidth)/spread.pages[owner].clientWidth;g.item.record.y=parseFloat(box.style.top)/spread.pages[owner].clientHeight;}
    place(g.item);apply(g.item);
    // 移動後必須完整落在單頁內；超長 HTML 保持字級，以內部捲動閱讀。
    const paper=g.item.page.getBoundingClientRect(),bounds=box.getBoundingClientRect();g.item.record.y+=Math.max(paper.top+8-bounds.top,Math.min(0,paper.bottom-8-bounds.bottom))/g.item.page.clientHeight;g.item.record.y=Math.max(8/g.item.page.clientHeight,g.item.record.y);box.style.top=g.item.record.y*g.item.page.clientHeight+'px';
   }
   positionControls();spread.stack.refresh();changed();
  });
  ctx.on(ctx.root,'pointerdown',e=>{if(editing&&!e.target.closest('.journal-dom-object,.journal-text-controls,.pf-actions,.journal-layer-panel'))clear();});
  function capture(){return initialized?items.map(g=>({...g.record})):pending.map(r=>({...r}));}
  function restore(records){pending=records.map(r=>({...r}));if(initialized){items.forEach(g=>{g.record={...(records.find(r=>r.id===g.id)||defaults.find(r=>r.id===g.id))};place(g);apply(g);});}clear();}
  function sync(value){editing=value;const unlocked=GameProgress.hasMemory('ruisui-01');if(value||pending.length)initialize();items.forEach(g=>{place(g);g.box.hidden=!unlocked;g.box.classList.toggle('is-editing',editing);if(!editing)(g.box.classList.remove('is-selected'),g.box.style.zIndex=String(spread.stack.rank(g.id)));apply(g);});if(!editing)active=null;positionControls();}
  ctx.on(ctx.root,'scroll',positionControls,{capture:true});
  const observer=new ResizeObserver(()=>items.forEach(apply));groups.forEach(g=>observer.observe(g.node.closest('.pf-page')));
  // 心得隨輸入增高；保留 textarea、原節點與其所有既有儲存事件。
  const note=ctx.id('travel-note');ctx.on(note,'input',()=>{note.style.height='auto';note.style.height=Math.max(120,note.scrollHeight)+'px';items.forEach(apply);});
  ctx.cleanup(()=>{observer.disconnect();items.forEach(g=>spread.stack.remove(g.id));});
  return {hitStart(e){const item=items.slice().sort((a,b)=>b.record.order-a.record.order).find(g=>{const r=g.box.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});if(item){start(e,item);return true;}return false;},sync,capture,restore,clear,reset(){restore(defaults);},get selected(){return !!active;},get dragging(){return !!gesture;}};
 }};
})();
