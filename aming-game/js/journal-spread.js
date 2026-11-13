/* 共用跨頁座標／旋轉多邊形面積判定。編輯暫存層在書本內、StPageFlip 頁面外。 */
(() => {
 'use strict';const W=600,H=800;
 function area(points){return Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p.x*q.y-q.x*p.y;},0))/2;}
 function clip(poly,axis,value,greater){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],inside=p=>greater?p[axis]>=value:p[axis]<=value,aa=inside(a),bb=inside(b);if(aa)out.push(a);if(aa!==bb){const t=(value-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return out;}
 function overlap(poly,left){let p=poly;for(const [axis,v,g] of [['x',left,true],['x',left+W,false],['y',0,true],['y',H,false]]){if(!p.length)return 0;p=clip(p,axis,v,g);}return area(p);}
 function choose(poly,origin){const l=overlap(poly,0),r=overlap(poly,W);return Math.abs(l-r)<1e-7?origin:l>r?'left':'right';}
 window.JournalSpread={choose,overlap,mount({ctx,left,right}){
  const book=ctx.query('.pf-book'),host=document.createElement('div');host.className='journal-spread-edit';book.append(host);
  const pages={left,right};const offset=p=>p==='right'?W:0;
  function fit(object,owner){object.setCoords();let b=object.getBoundingRect(true,true);const f=Math.min(1,(W-16)/b.width,(H-16)/b.height);if(f<1){object.scale(object.scaleX*f);object.setCoords();b=object.getBoundingRect(true,true);}const x=offset(owner);object.set({left:object.left+Math.max(x+8-b.left,Math.min(0,x+W-8-b.left-b.width)),top:object.top+Math.max(8-b.top,Math.min(0,H-8-b.top-b.height))});object.journalPage=owner;object.setCoords();}
  function snap(object){const owner=choose(object.getCoords(true,true),object.journalPage||'left');fit(object,owner);return owner;}
  function resize(canvas){canvas.setDimensions({width:book.clientWidth+'px',height:book.clientHeight+'px'},{cssOnly:true});canvas.calcOffset();}
  function clipCanvas(canvas){const sx=book.clientWidth/(W*2),sy=book.clientHeight/H;let path='';for(const o of canvas.getObjects()){const b=o.getBoundingRect(true,true),pad=canvas.getActiveObject()===o?65:2,x=(b.left-pad)*sx,y=(b.top-pad)*sy,r=(b.left+b.width+pad)*sx,d=(b.top+b.height+pad)*sy;path+=`M ${x} ${y} H ${r} V ${d} H ${x} Z `;}canvas.upperCanvasEl.style.clipPath=`path('${path}')`;}
  ctx.cleanup(()=>host.remove());return {host,pages,offset,fit,snap,resize,clipCanvas,book,choose};
 }};
})();
