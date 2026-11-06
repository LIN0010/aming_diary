/* 右頁回憶碎片：真正 Fabric 群組，沿用原收藏節點的點擊事件。 */
(() => {
 'use strict';const W=600,H=800;
 window.JournalMemory={mount({ctx,node,saved,legacy,beforeChange,onChange,onSelect,report}){
  const page=node.closest('.pf-page'),layer=document.createElement('div');layer.className='journal-memory-layer';layer.hidden=true;
  const image=document.createElement('img');image.className='journal-memory-preview';image.alt='瑞穗回憶碎片';image.draggable=false;
  const el=document.createElement('canvas'),hit=document.createElement('button');hit.type='button';hit.className='journal-memory-hit';hit.setAttribute('aria-label',node.getAttribute('aria-label')||'查看瑞穗回憶碎片');hit.title='查看瑞穗回憶碎片';hit.hidden=true;
  layer.append(image,el,hit);page.append(layer);
  let canvas,group,record=saved||null,defaults,editing=false,busy=false,dead=false;
  if(record&&(!['x','y','scale','angle'].every(k=>Number.isFinite(record[k]))||record.scale<=0||record.page!=='right'))throw Error('invalid-memory-layout');
  function capture(){return group?{id:'memory-fragment',type:'memory',source:'ruisui-memory-01',page:'right',x:group.left/W,y:group.top/H,scale:group.scaleX,angle:group.angle,order:20}:record?{...record}:null;}
  function constrain(){
   group.scale(Math.max(.25,Math.min(3,group.scaleX)));group.setCoords();let b=group.getBoundingRect(true,true);const fit=Math.min(1,(W-16)/b.width,(H-16)/b.height);if(fit<1){group.scale(group.scaleX*fit);group.setCoords();b=group.getBoundingRect(true,true);}
   group.set({left:group.left+Math.max(8-b.left,Math.min(0,W-8-b.left-b.width)),top:group.top+Math.max(8-b.top,Math.min(0,H-8-b.top-b.height))});group.setCoords();record=capture();
  }
  function placement(){if(!group||!page.clientWidth)return;const b=group.getBoundingRect(true,true);const pad=canvas.getActiveObject()?65:2;canvas.upperCanvasEl.style.clipPath=`polygon(${(b.left-pad)/W*100}% ${(b.top-pad)/H*100}%,${(b.left+b.width+pad)/W*100}% ${(b.top-pad)/H*100}%,${(b.left+b.width+pad)/W*100}% ${(b.top+b.height+pad)/H*100}%,${(b.left-pad)/W*100}% ${(b.top+b.height+pad)/H*100}%)`;Object.assign(hit.style,{left:b.left/W*100+'%',top:b.top/H*100+'%',width:b.width/W*100+'%',height:b.height/H*100+'%'});}
  function resize(){if(!canvas||!page.clientWidth)return;canvas.setDimensions({width:page.clientWidth+'px',height:page.clientHeight+'px'},{cssOnly:true});group?.set({cornerSize:Math.max(14,14*W/page.clientWidth),touchCornerSize:Math.max(24,24*W/page.clientWidth)});group?.setCoords();canvas.calcOffset();placement();}
  function publish(){if(canvas)image.src=canvas.toDataURL({format:'png',enableRetinaScaling:false});}
  function apply(next){if(!next)return;record={...next};if(group){group.set({left:record.x*W,top:record.y*H,scaleX:record.scale,scaleY:record.scale,angle:record.angle});constrain();canvas.requestRenderAll();placement();if(!editing)publish();}}
  function initialize(){
   if(canvas||busy||!ctx.root.classList.contains('pf-reading')||!node.getBoundingClientRect().width)return;
   const n=node.getBoundingClientRect(),p=page.getBoundingClientRect(),width=node.offsetWidth/p.width*W;
   defaults={id:'memory-fragment',type:'memory',source:'ruisui-memory-01',page:'right',x:(n.left+n.width/2-p.left)/p.width,y:(n.top+n.height/2-p.top)/p.height,scale:width/120,angle:-3,order:20};
   if(!record){record={...defaults};if(legacy){record.x=legacy.x+legacy.width/2;record.y=legacy.y+legacy.width*.75*(node.offsetHeight/node.offsetWidth)/2;record.scale=legacy.width*W/120;record.angle=legacy.angle;}}
   busy=true;fabric.Image.fromURL(node.querySelector('img').src,img=>{
    if(dead)return;if(!img?.width){busy=false;report('回憶碎片圖片載入失敗，請重試。');return;}
    img.scaleToWidth(120);img.set({left:0,top:0,originX:'center',originY:'top'});
    const small=node.querySelector('small'),strong=node.querySelector('strong'),fontScale=120/node.offsetWidth;
    const labels=[new fabric.Text(small.textContent.trim(),{fontSize:parseFloat(getComputedStyle(small).fontSize)*fontScale,fill:'#71877a',originX:'center',left:0,top:img.getScaledHeight()+5}),new fabric.Text(strong.textContent.trim(),{fontSize:parseFloat(getComputedStyle(strong).fontSize)*fontScale,fill:'#71877a',originX:'center',left:0,top:img.getScaledHeight()+19})];
    group=new fabric.Group([img,new fabric.Text(node.querySelector('.memory-fragment-info > span').textContent.trim(),{fontSize:15*fontScale,fill:'#71877a',left:-58,top:img.getScaledHeight()+7}),...labels],{originX:'center',originY:'center',cornerColor:'#b99358',borderColor:'#987847',cornerSize:14,transparentCorners:false,lockScalingFlip:true});
    canvas=new fabric.Canvas(el,{width:W,height:H,selection:false,preserveObjectStacking:true,enableRetinaScaling:true});canvas.add(group);
    canvas.on('before:transform',beforeChange);for(const name of ['object:moving','object:scaling','object:rotating'])canvas.on(name,()=>{constrain();placement();});canvas.on('object:modified',()=>{record=capture();onChange();});
    canvas.on('selection:created',()=>{onSelect();placement();});canvas.on('selection:updated',()=>{onSelect();placement();});canvas.on('selection:cleared',placement);
    node.style.visibility='hidden';busy=false;apply(record);sync(editing);
   });
  }
  function sync(value){editing=value;const unlocked=GameProgress.hasMemory('ruisui-01');if(unlocked&&(editing||record))initialize();layer.hidden=!unlocked||!canvas;if(canvas){layer.classList.toggle('is-editing',editing);canvas.skipTargetFind=!editing;if(!editing){canvas.discardActiveObject();publish();}resize();hit.hidden=editing||!unlocked;}}
  ctx.on(ctx.root,'pointerdown',e=>{if(editing&&!e.target.closest('.journal-memory-layer,.pf-actions')){canvas?.discardActiveObject();canvas?.requestRenderAll();}});
  ctx.on(hit,'click',()=>{if(!editing&&GameProgress.hasMemory('ruisui-01'))node.click();});
  for(const type of ['mousedown','touchstart'])ctx.on(layer,type,e=>{if(editing)e.stopPropagation();});
  const observer=new ResizeObserver(resize);observer.observe(page);
  ctx.cleanup(()=>{dead=true;observer.disconnect();canvas?.dispose();layer.remove();});
  return {sync,capture,restore:apply,reset(){apply(defaults);},clear(){canvas?.discardActiveObject();canvas?.requestRenderAll();},get selected(){return !!canvas?.getActiveObject();},get busy(){return busy;}};
 }};
})();
