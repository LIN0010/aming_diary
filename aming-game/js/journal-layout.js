/* 瑞穗個人裝飾層：HTML 書頁保留；Fabric 只處理玩家照片與貼紙。 */
(() => {
 'use strict';
 const KEY='aming-diary-journal-layouts', W=600, H=800;
 const ASSETS=Object.freeze({compass:'images/guild-compass.png',journal:'images/guild-journal.png'});
 const clone=x=>JSON.parse(JSON.stringify(x));
 window.JournalLayout={mount({ctx,page,label,input,preview,canEdit,report}){
  let canvas,editing=false,dead=false,busy=0,photo=null,records=null,history=[],dirty=false,protectedSave=false,sequence=0;
  const layer=document.createElement('div');layer.className='journal-decoration-layer';layer.hidden=true;
  const snapshot=document.createElement('img');snapshot.className='journal-decoration-preview';snapshot.alt='我的旅行照片與手帳裝飾';snapshot.draggable=false;layer.append(snapshot);
  const element=document.createElement('canvas');element.setAttribute('aria-label','個人旅行照片與貼紙編輯區');layer.append(element);page.append(layer);
  const tools=document.createElement('div');tools.className='journal-layout-tools';tools.hidden=true;tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','手帳裝飾編輯');
  tools.innerHTML='<button type="button" data-layout="select">選取／拖曳</button><button type="button" data-layout="photo">選擇照片</button><button type="button" data-layout="compass">指南針貼紙</button><button type="button" data-layout="journal">手帳貼紙</button><button type="button" data-layout="rotate" aria-label="順時針旋轉十五度">旋轉 ↻</button><button type="button" data-layout="smaller">縮小 −</button><button type="button" data-layout="larger">放大 ＋</button><button type="button" data-layout="delete">刪除裝飾</button><button type="button" data-layout="undo">復原上一步</button><button type="button" data-layout="reset">恢復預設排版</button>';
  page.append(tools);
  try{
   const raw=localStorage.getItem(KEY);
   if(raw){const data=JSON.parse(raw);if(data.version!==1||!data.stations)throw Error('unsupported');
    const saved=data.stations.ruisui;
    if(saved){
     if(!Array.isArray(saved.objects)||saved.objects.length>30||saved.stationId!=='ruisui'||saved.photo&&!/^data:image\/(jpeg|png|webp);base64,/.test(saved.photo))throw Error('invalid');
     for(const o of saved.objects)if(!o.id||!['photo','sticker'].includes(o.type)||o.type==='sticker'&&!ASSETS[o.source]||![o.x,o.y,o.scale,o.angle,o.order].every(Number.isFinite)||o.scale<=0)throw Error('invalid');
     records=saved.objects;photo=saved.photo||null;
    }
   }
  }catch(_){protectedSave=true;report('無法讀取手帳排版，原存檔已保留。');}
  function defaultRecords(){
   const r=label.getBoundingClientRect(),p=page.getBoundingClientRect();
   return [{id:'player-polaroid',type:'photo',source:'player-photo',x:p.width?(r.left+r.width/2-p.left)/p.width:.65,y:p.height?(r.top+r.height/2-p.top)/p.height:.78,scale:label.offsetWidth/(page.clientWidth||1)*W/240,angle:3,order:0}];
  }
  // 官方預設值只由原 HTML 位置產生；不以玩家的儲存值回寫。
  let defaults;
  function capture(){return canvas?canvas.getObjects().map((o,order)=>({id:o.journalId,type:o.journalType,source:o.journalSource,x:o.left/W,y:o.top/H,scale:o.scaleX,angle:o.angle,order})):clone(records||defaults||[]);}
  function checkpoint(){history.push(clone(capture()));if(history.length>30)history.shift();}
  function changed(){records=capture();dirty=true;updateTools();}
  function updateTools(){
   const selected=canvas?.getActiveObject();
   for(const name of ['rotate','smaller','larger'])tools.querySelector(`[data-layout="${name}"]`).disabled=!!busy||!selected;
   tools.querySelector('[data-layout="delete"]').disabled=!!busy||!selected||selected.journalType!=='sticker';
   tools.querySelector('[data-layout="undo"]').disabled=!!busy||!history.length;
   for(const name of ['reset','compass','journal','photo'])tools.querySelector(`[data-layout="${name}"]`).disabled=!!busy;
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
   if(record.type==='photo'){
    const paper=new fabric.Rect({left:-120,top:-90,width:240,height:180,fill:'#fffcf3',stroke:'#d6c8af',strokeWidth:1});
    const parts=[paper];
    if(photo){const img=await image(photo);img.scale(Math.min(220/img.width,140/img.height));img.set({left:0,top:-10,originX:'center',originY:'center'});parts.push(img);}
    else parts.push(new fabric.Text('加入旅行照片',{fontSize:18,fill:'#806d55',left:0,top:-10,originX:'center',originY:'center'}));
    parts.push(new fabric.Rect({left:-35,top:-97,width:70,height:18,angle:-4,fill:'rgba(201,183,153,.65)'}));
    result=new fabric.Group(parts,{originX:'center',originY:'center'});
   }else{result=await image(ASSETS[record.source]);result.scaleToWidth(90);result=new fabric.Group([result],{originX:'center',originY:'center'});}
   result.set({left:record.x*W,top:record.y*H,scaleX:record.scale,scaleY:record.scale,angle:record.angle,cornerColor:'#b99358',borderColor:'#987847',cornerSize:14,transparentCorners:false,lockScalingFlip:true});
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
  function resize(){if(!canvas||!page.clientWidth)return;canvas.setDimensions({width:page.clientWidth+'px',height:page.clientHeight+'px'},{cssOnly:true});canvas.getObjects().forEach(o=>{o.set({cornerSize:Math.max(14,14*W/page.clientWidth),touchCornerSize:Math.max(24,24*W/page.clientWidth)});o.setCoords();});canvas.calcOffset();}
  function ensure(){
   if(canvas)return;
   if(!records){defaults=defaultRecords();records=clone(defaults);}
   canvas=new fabric.Canvas(element,{width:W,height:H,selection:false,preserveObjectStacking:true,allowTouchScrolling:false,enableRetinaScaling:true});
   canvas.on('before:transform',checkpoint);
   for(const name of ['object:moving','object:scaling','object:rotating'])canvas.on(name,e=>bound(e.target));
   canvas.on('object:modified',changed);
   for(const name of ['selection:created','selection:updated','selection:cleared'])canvas.on(name,updateTools);
   layer.hidden=false;label.classList.add('journal-photo-replaced');resize();draw(records);
  }
  function sync(){
   const unlocked=GameProgress.hasMemory('ruisui-01');
   if(!unlocked){layer.hidden=true;tools.hidden=true;return;}
   if((editing||records||photo)&&page.clientWidth&&page.clientHeight)ensure();
   if(canvas){layer.hidden=false;layer.classList.toggle('is-editing',editing);canvas.selection=false;canvas.skipTargetFind=!editing;resize();canvas.requestRenderAll();}
   tools.hidden=!editing;updateTools();
  }
  function save(){
   if(busy){report('照片與裝飾準備中，請稍候。');return false;}
   if(!dirty)return true;
   if(protectedSave){report('原手帳存檔尚無法讀取，請保留本頁。');return false;}
   try{const raw=localStorage.getItem(KEY),data=raw?JSON.parse(raw):{version:1,stations:{}};
    if(data.version!==1||!data.stations)throw Error('unsupported');
    data.stations.ruisui={stationId:'ruisui',photo,objects:capture()};localStorage.setItem(KEY,JSON.stringify(data));dirty=false;report('');return true;
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
   if(action==='select'){canvas.isDrawingMode=false;layer.querySelector('.upper-canvas').focus();return;}
   if(action==='undo'){const previous=history.pop();if(previous){dirty=true;await draw(previous);}return;}
   if(action==='reset'){checkpoint();dirty=true;await draw(clone(defaults));return;}
   if(ASSETS[action]){
    if(canvas.getObjects().length>=21){report('這一頁最多放置 20 張個人貼紙。');return;}
    checkpoint();const next=capture();next.push({id:crypto.randomUUID(),type:'sticker',source:action,x:.4,y:.55,scale:1,angle:-8,order:next.length});dirty=true;await draw(next);canvas.setActiveObject(canvas.getObjects().at(-1));canvas.requestRenderAll();updateTools();return;
   }
   if(!selected)return;checkpoint();
   if(action==='delete'&&selected.journalType==='sticker'){canvas.remove(selected);canvas.discardActiveObject();}
   if(action==='rotate')selected.rotate(selected.angle+15);
   if(action==='smaller'||action==='larger')selected.scale(selected.scaleX*(action==='larger'?1.12:1/1.12));
   bound(selected);changed();canvas.requestRenderAll();
  });
  // 只在編輯層終止冒泡，不把整張 HTML 書頁停用。
  for(const type of ['mousedown','touchstart']){ctx.on(layer,type,e=>{if(editing)e.stopPropagation();});ctx.on(tools,type,e=>e.stopPropagation());}
  const observer=new ResizeObserver(()=>{if(!canvas&&(records||photo||editing))sync();else resize();});observer.observe(page);
  ctx.cleanup(()=>{dead=true;sequence++;observer.disconnect();canvas?.dispose();layer.remove();tools.remove();});
  return {setMode(value){if(editing!==value){if(value)defaults=defaultRecords();editing=value;canvas?.discardActiveObject();if(!editing)publish();}sync();},save,upload,get dirty(){return dirty;},get busy(){return !!busy;}};
 }};
})();
