/* 瑞穗個人裝飾層：HTML 書頁保留；Fabric 只處理玩家照片與貼紙。 */
(() => {
 'use strict';
 const KEY='aming-diary-journal-layouts', W=600, H=800;
 const PHOTO_UPLOAD={width:.64,height:.60};
 const ASSETS=Object.freeze({compass:'images/guild-compass.png',journal:'images/guild-journal.png',tape:null});
 const clone=x=>JSON.parse(JSON.stringify(x));
 const paths={done:'m5 12 4 4L20 5',close:'M9 6 3 12l6 6M3 12h13a5 5 0 0 0 5-5',edit:'m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5',photo:'M3 5h18v16H3ZM7 5l2-3h6l2 3M8 13a4 4 0 1 0 8 0 4 4 0 1 0-8 0',sticker:'M3 3h18v12l-6 6H3ZM15 21v-6h6M7 8h2m5 0h2M8 12q4 4 8 0',delete:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',undo:'M9 4 3 10l6 6M3 10h11a7 7 0 0 1 7 7',reset:'M3 11a9 9 0 1 1 2 7M3 3v8h8',more:'m8 4 8 8-8 8'};
 function button(node,label,icon){if(node.getAttribute('aria-label')===label&&node.querySelector('svg'))return;node.title=label;node.setAttribute('aria-label',label);node.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[icon]||paths.edit}"/></svg><span class="journal-tool-name"></span>`;node.querySelector('span').textContent=label;}
 window.JournalLayout={button,mount({ctx,page,toolbar,label,input,preview,canEdit,report,groups}){
  let canvas,editing=false,dead=false,busy=0,photo=null,records=null,history=[],dirty=false,protectedSave=false,sequence=0;
  let domEditor;
  const layer=document.createElement('div');layer.className='journal-decoration-layer';layer.hidden=true;
  const snapshot=document.createElement('img');snapshot.className='journal-decoration-preview';snapshot.alt='我的旅行照片與手帳裝飾';snapshot.draggable=false;layer.append(snapshot);
  const element=document.createElement('canvas');element.setAttribute('aria-label','個人旅行照片與貼紙編輯區');layer.append(element);page.append(layer);
  const caption=document.createElement('p');caption.className='journal-photo-caption';caption.textContent=ctx.query('#player-journal .page-date').textContent.trim();caption.hidden=true;page.append(caption);
  function captionSync(){const o=canvas?.getObjects().find(o=>o.journalType==='photo');if(!o)return;const a=o.angle*Math.PI/180,dy=75*o.scaleX;caption.hidden=layer.hidden;caption.style.left=(o.left-Math.sin(a)*dy)/W*100+'%';caption.style.top=(o.top+Math.cos(a)*dy)/H*100+'%';caption.style.width=210*o.scaleX/W*100+'%';caption.style.transform=`translate(-50%,-50%) rotate(${o.angle}deg)`;}
  const tools=document.createElement('div');tools.className='journal-layout-tools';tools.hidden=true;tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','手帳裝飾編輯');
  tools.id='journal-edit-tools';
  for(const [action,name,icon] of [['photo','新增旅行照片','photo'],['stickers','新增貼紙','sticker'],['delete','刪除選取的個人裝飾','delete'],['undo','復原上一步','undo'],['reset','恢復官方預設排版','reset']]){const item=document.createElement('button');item.type='button';item.dataset.layout=action;button(item,name,icon);tools.append(item);}
  const picker=document.createElement('div');picker.className='journal-sticker-picker';picker.id='journal-sticker-picker';picker.hidden=true;picker.setAttribute('role','group');picker.setAttribute('aria-label','選擇貼紙');
  for(const [id,name] of [['compass','指南針貼紙'],['journal','手帳貼紙'],['tape','紙膠帶']]){const item=document.createElement('button');item.type='button';item.dataset.layout=id;item.title=name;item.setAttribute('aria-label',name);const img=document.createElement('img');if(id==='tape'){item.className='journal-tape-swatch';}else img.src=ASSETS[id];img.alt='';img.width=28;img.height=28;if(id!=='tape')item.append(img);picker.append(item);}
  tools.querySelector('[data-layout="stickers"]').after(picker);
  const stickerToggle=tools.querySelector('[data-layout="stickers"]');stickerToggle.setAttribute('aria-controls',picker.id);stickerToggle.setAttribute('aria-expanded','false');
  toolbar.append(tools);
  ctx.on(tools,'keydown',e=>{if(e.key==='Escape'){picker.hidden=true;stickerToggle.setAttribute('aria-expanded','false');stickerToggle.focus();}});
  const officialPhoto=groups.find(g=>g.id==='aming-photo').node;
  let legacyPhoto;
  let domRecords=[];
  try{
   const raw=localStorage.getItem(KEY);
   if(raw){const data=JSON.parse(raw);if(data.version!==1||!data.stations)throw Error('unsupported');
    const saved=data.stations.ruisui;
    if(saved){
     if(!Array.isArray(saved.objects)||saved.objects.length>30||saved.stationId!=='ruisui'||saved.photo&&!/^data:image\/(jpeg|png|webp);base64,/.test(saved.photo))throw Error('invalid');
     for(const o of saved.objects)if(!o.id||!['photo','sticker','official-photo'].includes(o.type)||o.type==='sticker'&&!Object.hasOwn(ASSETS,o.source)||![o.x,o.y,o.scale,o.angle,o.order].every(Number.isFinite)||o.scale<=0)throw Error('invalid');
     records=saved.objects;photo=saved.photo||null;
     domRecords=saved.domObjects||[];
    }
   }
  }catch(_){protectedSave=true;report('無法讀取手帳排版，原存檔已保留。');}
  legacyPhoto=domRecords.find(r=>r.id==='aming-photo');domRecords=domRecords.filter(r=>r.id!=='aming-photo');
  try{domEditor=JournalDomLayout.mount({ctx,groups:groups.filter(g=>g.id!=='aming-photo'),saved:domRecords,checkpoint,changed:()=>{dirty=true;canvas?.discardActiveObject();updateTools();},select:()=>{canvas?.discardActiveObject();updateTools();}});}catch(_){protectedSave=true;report('無法讀取 HTML 排版，原存檔已保留。');}
  ctx.on(ctx.root,'pointerdown',e=>{if(editing&&canvas?.getActiveObject()&&!e.target.closest('.pf-actions')&&!canvas.findTarget(e)&&domEditor?.hitStart(e))e.stopImmediatePropagation();},{capture:true});
  function defaultRecords(){
   const r=label.getBoundingClientRect(),p=page.getBoundingClientRect();
   return [{id:'player-polaroid',type:'photo',source:'player-photo',x:p.width?(r.left+r.width/2-p.left)/p.width:.65,y:p.height?(r.top+r.height/2-p.top)/p.height:.78,scale:label.offsetWidth/(page.clientWidth||1)*W/240,angle:3,order:0},officialDefault()];
  }
  function officialDefault(){const r=officialPhoto.getBoundingClientRect(),p=page.getBoundingClientRect();return {id:'aming-photo',type:'official-photo',source:'aming-photo',x:(r.left+r.width/2-p.left)/p.width,y:(r.top+r.height/2-p.top)/p.height,scale:officialPhoto.offsetWidth/p.width*W/240,angle:-2,aspect:officialPhoto.offsetWidth/officialPhoto.offsetHeight,order:1};}
  // 官方預設值只由原 HTML 位置產生；不以玩家的儲存值回寫。
  let defaults;
  function capture(){return canvas?canvas.getObjects().map((o,order)=>({id:o.journalId,type:o.journalType,source:o.journalSource,x:o.left/W,y:o.top/H,scale:o.scaleX,angle:o.angle,order,...(o.journalType==='official-photo'?{aspect:o.journalAspect}:{})})):clone(records||defaults||[]);}
  function checkpoint(){history.push({fabric:clone(capture()),dom:domEditor?.capture()||[]});if(history.length>30)history.shift();}
  function changed(){records=capture();dirty=true;updateTools();}
  function updateTools(){
   const selected=canvas?.getActiveObject();
   tools.querySelector('[data-layout="delete"]').disabled=!!busy||domEditor?.selected||!selected||selected.journalType!=='sticker';
   tools.querySelector('[data-layout="undo"]').disabled=!!busy||!history.length;
   for(const name of ['reset','compass','journal','tape','photo','stickers'])tools.querySelector(`[data-layout="${name}"]`).disabled=!!busy;
   layer.setAttribute('aria-busy',String(!!busy));
  }
  function bound(o){
   o.set({scaleX:Math.max(.12,Math.min(2.5,o.scaleX)),scaleY:Math.max(.12,Math.min(2.5,o.scaleX))});o.setCoords();
   let b=o.getBoundingRect(true,true),factor=Math.min(1,(W-16)/b.width,(H-16)/b.height);
   if(factor<1){o.scale(o.scaleX*factor);o.setCoords();b=o.getBoundingRect(true,true);}
   o.set({left:o.left+Math.max(8-b.left,Math.min(0,W-8-b.left-b.width)),top:o.top+Math.max(8-b.top,Math.min(0,H-8-b.top-b.height))});o.setCoords();
  }
  function image(src){return new Promise((resolve,reject)=>fabric.Image.fromURL(src,value=>value?.width?resolve(value):reject(Error('圖片載入失敗'))));}
  async function object(record){
   let result;
   if(record.type==='official-photo'){
    const aspect=Number.isFinite(record.aspect)&&record.aspect>.2&&record.aspect<4?record.aspect:1;
    const h=240/aspect,img=await image(officialPhoto.querySelector('img').src);img.scale(Math.min(220/img.width,(h-38)/img.height));img.set({left:0,top:-9,originX:'center',originY:'center'});
    result=new fabric.Group([new fabric.Rect({left:-120,top:-h/2,width:240,height:h,fill:'#fffcf3'}),img,new fabric.Text(officialPhoto.querySelector('span').textContent.trim(),{fontSize:12,fill:'#806d55',left:0,top:h/2-16,originX:'center',originY:'center'}),new fabric.Rect({left:-35,top:-h/2-7,width:70,height:16,fill:'rgba(201,183,153,.65)'})],{originX:'center',originY:'center'});result.journalAspect=aspect;
   }else if(record.type==='photo'){
    const paper=new fabric.Rect({left:-120,top:-90,width:240,height:180,fill:'#fffcf3',stroke:'#d6c8af',strokeWidth:1});
    const parts=[paper];
    if(photo){const img=await image(photo);img.scale(Math.min(220/img.width,140/img.height));img.set({left:0,top:-10,originX:'center',originY:'center'});parts.push(img);}
    else parts.push(new fabric.Text('加入旅行照片',{fontSize:18,fill:'#806d55',left:0,top:-10,originX:'center',originY:'center'}));
    parts.push(new fabric.Rect({left:-35,top:-97,width:70,height:18,angle:-4,fill:'rgba(201,183,153,.65)'}));
    result=new fabric.Group(parts,{originX:'center',originY:'center'});
   }else if(record.source==='tape'){result=new fabric.Rect({width:100,height:26,fill:'rgba(201,183,153,.65)',originX:'center',originY:'center'});}
   else{result=await image(ASSETS[record.source]);result.scaleToWidth(90);result=new fabric.Group([result],{originX:'center',originY:'center'});}
   result.set({left:record.x*W,top:record.y*H,scaleX:record.scale,scaleY:record.scale,angle:record.angle,cornerColor:'#b99358',borderColor:'#987847',cornerSize:14,transparentCorners:false,lockScalingFlip:true});
   if(record.type==='photo'&&!photo){
    // 與 photoCenter 共用範圍，僅在既有群組內加入底色，不改變群組外框或尺寸。
    const area=new fabric.Rect({left:0,top:0,originX:'center',originY:'center',width:result.width*PHOTO_UPLOAD.width,height:result.height*PHOTO_UPLOAD.height,fill:'#E1D5BD',stroke:'rgba(105,89,72,.4)',strokeWidth:1,strokeDashArray:[4,3]});
    result.insertAt(area,1);result.getObjects().find(o=>o.type==='text').set({left:0,top:0});
   }
   result.journalId=record.id;result.journalType=record.type;result.journalSource=record.source;bound(result);return result;
  }
  async function draw(next){
   const token=++sequence;busy++;updateTools();
   try{const objects=await Promise.all(next.slice().sort((a,b)=>a.order-b.order).map(object));
    if(dead||token!==sequence)return;
    canvas.clear();objects.forEach(o=>canvas.add(o));records=capture();resize();canvas.requestRenderAll();if(!editing)publish();
   }catch(_){report('裝飾圖片載入失敗，請重試。');}
   finally{busy--;if(!dead)updateTools();}
  }
  // StPageFlip 複製 HTML 時不複製 canvas bitmap；閱讀投影用可複製的透明 img。
  function publish(){if(canvas)snapshot.src=canvas.toDataURL({format:'png',enableRetinaScaling:false});}
  function resize(){if(!canvas||!page.clientWidth)return;canvas.setDimensions({width:page.clientWidth+'px',height:page.clientHeight+'px'},{cssOnly:true});canvas.getObjects().forEach(o=>{o.set({cornerSize:Math.max(14,14*W/page.clientWidth),touchCornerSize:Math.max(24,24*W/page.clientWidth)});o.setCoords();});canvas.calcOffset();captionSync();}
  function ensure(){
   if(canvas)return;
   if(!records){defaults=defaultRecords();records=clone(defaults);}
   else if(!records.some(r=>r.type==='official-photo')){const initial=officialDefault();if(legacyPhoto){initial.x=legacyPhoto.x+legacyPhoto.width/2;initial.y=legacyPhoto.y+legacyPhoto.width*.75/initial.aspect/2;initial.scale=legacyPhoto.width*W/240;initial.angle=legacyPhoto.angle;}records.push(initial);}
   officialPhoto.style.visibility='hidden';
   canvas=new fabric.Canvas(element,{width:W,height:H,selection:false,preserveObjectStacking:true,allowTouchScrolling:false,enableRetinaScaling:true});
   let photoPress=null;
   const point=e=>{const p=e.changedTouches?.[0]||e;return {x:p.clientX,y:p.clientY};};
   const photoCenter=e=>{
    const o=e.target;if(o?.journalType!=='photo'||o.__corner)return false;
    const p=fabric.util.transformPoint(e.absolutePointer||canvas.getPointer(e.e),fabric.util.invertTransform(o.calcTransformMatrix()));
    return Math.abs(p.x)<o.width*PHOTO_UPLOAD.width/2&&Math.abs(p.y)<o.height*PHOTO_UPLOAD.height/2;
   };
   canvas.on('mouse:down',e=>{photoPress=editing&&canEdit()&&!busy&&photoCenter(e)?{target:e.target,...point(e.e),moved:false}:null;});
   canvas.on('mouse:up',e=>{
    const press=photoPress;photoPress=null;if(!press||!editing||!canEdit()||busy||press.moved||e.target!==press.target||!photoCenter(e))return;
    const p=point(e.e);if(Math.hypot(p.x-press.x,p.y-press.y)>6)return;
    // 同一個既有 input／upload 管線；檔案選擇器由真實點擊事件同步開啟。
    input.click();
   });
   canvas.on('mouse:move',e=>{if(photoPress){const p=point(e.e);if(Math.hypot(p.x-photoPress.x,p.y-photoPress.y)>6)photoPress.moved=true;}if(editing&&photoCenter(e))canvas.setCursor('pointer');canvas.upperCanvasEl.title=editing&&photoCenter(e)?(photo?'更換照片':'加入旅行照片'):'';});
   canvas.on('before:transform',checkpoint);
   for(const name of ['object:moving','object:scaling','object:rotating'])canvas.on(name,e=>{if(photoPress)photoPress.moved=true;bound(e.target);captionSync();});
   canvas.on('object:modified',changed);
   for(const name of ['selection:created','selection:updated','selection:cleared'])canvas.on(name,()=>{if(canvas.getActiveObject())domEditor?.clear();ctx.root.classList.toggle('journal-fabric-selected',!!canvas.getActiveObject());updateTools();});
   layer.hidden=false;label.classList.add('journal-photo-replaced');ctx.query('#player-journal .page-date').style.visibility='hidden';resize();draw(records);
  }
  function sync(){
   const unlocked=GameProgress.hasMemory('ruisui-01');
   domEditor?.sync(editing&&unlocked);
   if(!unlocked){caption.hidden=true;layer.hidden=true;tools.hidden=true;return;}
   if((editing||records||photo)&&page.clientWidth&&page.clientHeight)ensure();
   if(canvas){layer.hidden=false;layer.classList.toggle('is-editing',editing);canvas.selection=false;canvas.skipTargetFind=!editing;resize();canvas.requestRenderAll();}
   tools.hidden=!editing;if(!editing){picker.hidden=true;stickerToggle.setAttribute('aria-expanded','false');}updateTools();
  }
  function save(){
   if(busy){report('照片與裝飾準備中，請稍候。');return false;}
   if(!dirty)return true;
   if(protectedSave){report('原手帳存檔尚無法讀取，請保留本頁。');return false;}
   try{const raw=localStorage.getItem(KEY),data=raw?JSON.parse(raw):{version:1,stations:{}};
    if(data.version!==1||!data.stations)throw Error('unsupported');
    data.stations.ruisui={stationId:'ruisui',photo,objects:capture(),domObjects:domEditor?.capture()||[]};localStorage.setItem(KEY,JSON.stringify(data));dirty=false;report('');return true;
   }catch(_){report('手帳排版尚未儲存，請保留本頁並重試。');return false;}
  }
  async function upload(file){
   if(!editing||!canEdit()||!file){input.value='';return;}
   if(!file.type.startsWith('image/')||file.size>20*1024*1024){report('請選擇 20 MB 以內的圖片。');return;}
   busy++;updateTools();
   let url;
   try{
    url=URL.createObjectURL(file);const img=new Image();img.src=url;await img.decode();
    if(dead||!editing||!canEdit())return;
    const scale=Math.min(1,1200/img.naturalWidth,1200/img.naturalHeight),buffer=document.createElement('canvas');buffer.width=Math.max(1,Math.round(img.naturalWidth*scale));buffer.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const context=buffer.getContext('2d');context.fillStyle='#fffaf0';context.fillRect(0,0,buffer.width,buffer.height);context.drawImage(img,0,0,buffer.width,buffer.height);
    photo=buffer.toDataURL('image/jpeg',.82);preview.src=photo;label.classList.add('has-photo');dirty=true;
    await draw(capture());
   }catch(_){report('無法讀取這張照片，請改用 JPEG、PNG 或 WebP。');}
   finally{if(url)URL.revokeObjectURL(url);busy--;if(!dead)updateTools();input.value='';}
  }
  ctx.on(tools,'click',async event=>{
   const button=event.target.closest('[data-layout]');if(!button||!editing||busy)return;
   const action=button.dataset.layout,selected=canvas.getActiveObject();
   if(action==='photo'){input.click();return;}
   if(action==='stickers'){picker.hidden=!picker.hidden;stickerToggle.setAttribute('aria-expanded',String(!picker.hidden));return;}
   if(action==='undo'){const previous=history.pop();if(previous){dirty=true;domEditor?.restore(previous.dom);await draw(previous.fabric);}return;}
   if(action==='reset'){if(!window.confirm('恢復官方預設排版？照片、旅行心得與遊戲進度會保留。'))return;checkpoint();dirty=true;domEditor?.reset();await draw(clone(defaults));return;}
   if(Object.hasOwn(ASSETS,action)){
    picker.hidden=true;stickerToggle.setAttribute('aria-expanded','false');
    if(canvas.getObjects().length>=21){report('這一頁最多放置 20 張個人貼紙。');return;}
    checkpoint();const next=capture();next.push({id:crypto.randomUUID(),type:'sticker',source:action,x:.4,y:.55,scale:1,angle:-8,order:next.length});dirty=true;await draw(next);canvas.setActiveObject(canvas.getObjects().at(-1));canvas.requestRenderAll();updateTools();return;
   }
   if(!selected)return;checkpoint();
   if(action==='delete'&&selected.journalType==='sticker'){canvas.remove(selected);canvas.discardActiveObject();}
   bound(selected);changed();canvas.requestRenderAll();
  });
  // 只在編輯層終止冒泡，不把整張 HTML 書頁停用。
  for(const type of ['mousedown','touchstart']){ctx.on(layer,type,e=>{if(editing)e.stopPropagation();});ctx.on(tools,type,e=>e.stopPropagation());}
  const observer=new ResizeObserver(()=>{if(!canvas&&(records||photo||editing))sync();else resize();});observer.observe(page);
  ctx.cleanup(()=>{dead=true;sequence++;observer.disconnect();canvas?.dispose();layer.remove();caption.remove();tools.remove();});
  return {setMode(value){if(editing!==value){if(value)defaults=defaultRecords();editing=value;canvas?.discardActiveObject();if(!editing)publish();}sync();},save,upload,get dirty(){return dirty;},get busy(){return !!busy;}};
 }};
})();
