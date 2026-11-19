/* 共用跨頁座標／旋轉多邊形面積判定。編輯暫存層在書本內、StPageFlip 頁面外。 */
(() => {
 'use strict';const W=600,H=800;
 function area(points){return Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p.x*q.y-q.x*p.y;},0))/2;}
 function clip(poly,axis,value,greater){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],inside=p=>greater?p[axis]>=value:p[axis]<=value,aa=inside(a),bb=inside(b);if(aa)out.push(a);if(aa!==bb){const t=(value-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return out;}
 function overlap(poly,left){let p=poly;for(const [axis,v,g] of [['x',left,true],['x',left+W,false],['y',0,true],['y',H,false]]){if(!p.length)return 0;p=clip(p,axis,v,g);}return area(p);}
 function choose(poly,origin){const l=overlap(poly,0),r=overlap(poly,W);return Math.abs(l-r)<1e-7?origin:l>r?'left':'right';}
 // Shared visual stack. Fabric keeps its native transform/gesture engine; each object
 // has a separate DOM projection so HTML can sit between two objects of one canvas.
 function createStack(ctx,book,host,pages){
  const entries=new Map(),controlViews=new Map();let order=[],editing=false,available=true,selected=null,notify=()=>{};
  // Fabric renders selection UI on the hidden lower canvas, not on upper-canvas.
  // Paint only its native controls into a non-interactive, unclipped visual layer;
  // upper-canvas keeps the existing clipped hit regions and native gesture handling.
  function controlsFor(canvas){
   if(controlViews.has(canvas))return;
   const view=document.createElement('canvas');view.className='journal-stack-controls';view.setAttribute('aria-hidden','true');view.dataset.controlCanvas=canvas.lowerCanvasEl.closest('.journal-memory-layer')?'memory':'decorations';host.append(view);
   const paint=()=>{
    const ratio=canvas.getRetinaScaling(),width=Math.round(canvas.getWidth()*ratio),height=Math.round(canvas.getHeight()*ratio);
    if(view.width!==width)view.width=width;if(view.height!==height)view.height=height;
    const context=view.getContext('2d');context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,width,height);
    view.hidden=!editing||!available||!canvas.getActiveObject();
    if(!view.hidden){context.setTransform(ratio,0,0,ratio,0,0);canvas.drawControls(context);}
   };
   controlViews.set(canvas,paint);canvas.on('after:render',paint);paint();
   ctx.cleanup(()=>{canvas.off('after:render',paint);controlViews.delete(canvas);view.remove();});
  }
  function ids(){return [...order.filter(id=>entries.has(id)),...[...entries.keys()].filter(id=>!order.includes(id)).sort((a,b)=>(entries.get(a).base||0)-(entries.get(b).base||0))];}
  function rank(id){return 10+ids().indexOf(id)*2;}
  function refresh(){
   for(const e of entries.values()){
    e.element.dataset.layerId=e.id;e.element.style.zIndex=String(rank(e.id));
    if(e.fabric){
     const o=e.object,owner=o.journalPage||'left',parent=editing?host:pages[owner];
     if(e.element.parentElement!==parent)parent.append(e.element);
     // The cached raster includes Fabric's rounded export bounds. Map its local
     // centre with the SAME object matrix as native controls (including origin,
     // scale, rotation and skew); never squeeze it into object.width/height.
     const m=o.calcTransformMatrix(),sx=parent.getBoundingClientRect().width/(editing?1200:600),sy=parent.getBoundingClientRect().height/800;
     const x=m[4]-(editing?0:(owner==='right'?600:0))-m[0]*e.bitmapWidth/2-m[2]*e.bitmapHeight/2,y=m[5]-m[1]*e.bitmapWidth/2-m[3]*e.bitmapHeight/2;
     Object.assign(e.element.style,{left:'0px',top:'0px',width:e.bitmapWidth+'px',height:e.bitmapHeight+'px',transformOrigin:'0 0',transform:`matrix(${m[0]*sx},${m[1]*sy},${m[2]*sx},${m[3]*sy},${x*sx},${y*sy})`});
     e.element.classList.toggle('is-editing',editing);e.element.hidden=!available;
    }
   }
   const canvases=new Set([...entries.values()].filter(e=>e.fabric).map(e=>e.canvas));for(const canvas of canvases){canvas.getObjects().slice().sort((a,b)=>rank(a.journalId)-rank(b.journalId)).forEach((o,i)=>canvas.moveTo(o,i));}
   const caption=book.querySelector('.journal-photo-caption');if(caption)caption.style.zIndex=String(rank('player-polaroid'));for(const paint of controlViews.values())paint();notify();
  }
  function register(e){const old=entries.get(e.id);if(old?.element!==e.element)old?.dispose?.();entries.set(e.id,e);refresh();return e;}
  function remove(id){entries.get(id)?.dispose?.();entries.delete(id);if(selected===id)selected=null;refresh();}
  function pick(id){const e=entries.get(id);if(!e)return;selected=id;e.select();refresh();}
  function fabricObject(canvas,o,name,record,activate,provided){
   const id=o.journalId||'memory-fragment',element=provided||document.createElement('div');element.classList.add('journal-stack-object');element.setAttribute('aria-label',name);
   const bitmap=o.toCanvasElement({withoutTransform:true,multiplier:2,enableRetinaScaling:false});
   const img=document.createElement('img');img.alt=name;img.draggable=false;img.src=bitmap.toDataURL('image/png');element.replaceChildren(img);
   const e={id,name,base:record().order,record,element,fabric:true,object:o,bitmapWidth:bitmap.width/2,bitmapHeight:bitmap.height/2,canvas,select(){activate();canvas.setActiveObject(o);canvas.requestRenderAll();},dispose(){element.remove();}};
   register(e);const listen=(type,fn,options)=>element.addEventListener(type,fn,options);
   // Forward one native start event. Fabric retains its own document move/up
   // listeners, controls, photo-centre click logic and touch coordinate mapping.
   for(const type of ['mousedown','touchstart'])listen(type,event=>{
    if(!editing)return;event.preventDefault();event.stopPropagation();pick(id);
    const forwarded=type==='mousedown'?new MouseEvent(type,{bubbles:true,cancelable:true,clientX:event.clientX,clientY:event.clientY,button:event.button,buttons:event.buttons}):new TouchEvent(type,{bubbles:true,cancelable:true,touches:event.touches,targetTouches:event.targetTouches,changedTouches:event.changedTouches});
    canvas.upperCanvasEl.dispatchEvent(forwarded);
   },{passive:false});
   listen('mousemove',event=>{if(editing){canvas.upperCanvasEl.dispatchEvent(new MouseEvent('mousemove',{bubbles:false,clientX:event.clientX,clientY:event.clientY}));element.style.cursor=canvas.upperCanvasEl.style.cursor||'move';}});
   listen('click',()=>{if(!editing&&id==='memory-fragment')activate(true);});
   canvas.lowerCanvasEl.classList.add('journal-stack-bitmap');controlsFor(canvas);return e;
  }
  return {register,remove,refresh,rank,fabricObject,pick,
   selected(id){selected=id;notify();},
   list(){return ids().map(id=>{const e=entries.get(id);return {id,name:e.name,page:e.record()?.page||'left',selected:id===selected};});},
   move(action){const list=ids(),i=list.indexOf(selected);if(i<0)return false;const target=action==='top'?list.length-1:action==='bottom'?0:action==='up'?Math.min(i+1,list.length-1):Math.max(0,i-1);list.splice(i,1);list.splice(target,0,selected);order=list;refresh();return true;},
   capture(){return ids();},restore(value){order=Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'))]:[];refresh();},
   setMode(value,visible=true){editing=value;available=visible;host.classList.toggle('has-journal-stack',editing);refresh();},
   onUpdate(fn){notify=fn;},get editing(){return editing;},get active(){return selected;},
   clip(canvas){const o=canvas.getActiveObject(),sx=book.getBoundingClientRect().width/1200,sy=book.getBoundingClientRect().height/800;let path='';if(o){o.setCoords();for(const p of Object.values(o.oCoords)){const pad=15;const x=p.x*sx,y=p.y*sy;path+=`M ${x-pad} ${y-pad} h ${pad*2} v ${pad*2} h ${-pad*2} Z `;}}canvas.upperCanvasEl.style.clipPath=path?`path('${path}')`:'inset(100%)';}
  };
 }
 window.JournalSpread={choose,overlap,mount({ctx,left,right}){
  const book=ctx.query('.pf-book'),host=document.createElement('div');host.className='journal-spread-edit';book.append(host);
  const pages={left,right},stack=createStack(ctx,book,host,pages);const offset=p=>p==='right'?W:0;
  function fit(object,owner){object.setCoords();let b=object.getBoundingRect(true,true);const bottom=owner==='right'&&stack.editing?H-Math.min(80,pages.right.clientHeight*.25)/(pages.right.clientHeight||H)*H:H;const f=Math.min(1,(W-16)/b.width,(bottom-16)/b.height);if(f<1){object.scale(object.scaleX*f);object.setCoords();b=object.getBoundingRect(true,true);}const x=offset(owner);object.set({left:object.left+Math.max(x+8-b.left,Math.min(0,x+W-8-b.left-b.width)),top:object.top+Math.max(8-b.top,Math.min(0,bottom-8-b.top-b.height))});object.journalPage=owner;object.setCoords();}
  function snap(object){const owner=choose(object.getCoords(true,true),object.journalPage||'left');fit(object,owner);return owner;}
  function resize(canvas){canvas.setDimensions({width:book.getBoundingClientRect().width+'px',height:book.getBoundingClientRect().height+'px'},{cssOnly:true});canvas.calcOffset();}
  function clipCanvas(canvas){if(canvas.lowerCanvasEl.classList.contains('journal-stack-bitmap')){stack.clip(canvas);stack.refresh();return;}const sx=book.clientWidth/(W*2),sy=book.clientHeight/H;let path='';for(const o of canvas.getObjects()){const b=o.getBoundingRect(true,true),pad=canvas.getActiveObject()===o?65:2,x=(b.left-pad)*sx,y=(b.top-pad)*sy,r=(b.left+b.width+pad)*sx,d=(b.top+b.height+pad)*sy;path+=`M ${x} ${y} H ${r} V ${d} H ${x} Z `;}canvas.upperCanvasEl.style.clipPath=`path('${path}')`;}
  ctx.cleanup(()=>host.remove());return {host,pages,offset,fit,snap,resize,clipCanvas,book,choose,stack};
 }};
})();
