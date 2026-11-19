"""瑞穗 Fabric 編輯、座標存讀檔、照片持久化與翻頁整合。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil,json
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
def ready(page,index=9):page.wait_for_function('(i)=>window.testBook&&testBook.getCurrentPageIndex()===i&&testBook.getState()==="read"&&!document.querySelector(".pf-book").hasAttribute("aria-busy")',arg=index)
def tool(page,action):
 if action in ['compass','journal'] and page.locator('.journal-sticker-picker').is_hidden():page.locator('[data-layout="stickers"]').click()
 return page.locator(f'[data-layout="{action}"]')
def control(page,name,dx,dy,mobile):
 point=page.evaluate('(name)=>{const o=testCanvas.getActiveObject();o.setCoords();return {x:o.oCoords[name].x,y:o.oCoords[name].y}}',name);r=page.locator('.upper-canvas').bounding_box()
 drag(page,r['x']+point['x']/page.evaluate('testCanvas.getWidth()')*r['width'],r['y']+point['y']/800*r['height'],dx,dy,mobile)

def layer_ready(page):page.wait_for_function('document.querySelector(".journal-decoration-layer").getAttribute("aria-busy")==="false"')
def drag(page,x,y,dx,dy,mobile):
 if mobile:
  c=page.context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(300)
  for n in range(1,16):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*n/15,'y':y+dy*n/15}]})
  c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
 else:page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=18);page.mouse.up()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1440,900),(852,393)]:
   mobile=w<1000;c=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,device_scale_factor=3 if mobile else 1);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   fb=(ROOT/'aming-game/vendor/fabric/fabric.min.js').read_text();page.route('**/fabric.min.js',lambda r:r.fulfill(body=fb+';window.canvases=[];const init=fabric.Canvas.prototype.initialize;fabric.Canvas.prototype.initialize=function(...args){const r=init.apply(this,args);canvases.push(this);return r;};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui()');page.locator('[data-book="edit"]').click();layer_ready(page)
   layer_ready(page)
   r=page.locator('.journal-stack-object[data-layer-id="aming-photo"]').bounding_box()
   x=r['x']+r['width']/2;y=r['y']+r['height']/2
   page.touchscreen.tap(x,y) if mobile else page.mouse.click(x,y)
   assert page.evaluate('canvases.some(c=>c.getActiveObject()?.journalId==="aming-photo")')
   def layers():
    if page.locator('[data-layout="layers"]').is_hidden():page.locator('.journal-tool-toggle').click()
    page.locator('[data-layout="layers"]').click()
   def transform(name,dx,dy):
    point=page.evaluate('(name)=>{const o=currentCanvas.getActiveObject();o.setCoords();return {x:o.oCoords[name].x,y:o.oCoords[name].y}}',name);kind=page.evaluate('currentCanvas.lowerCanvasEl.closest(".journal-memory-layer")?"memory":"decorations"');r=page.locator(f'.journal-{ "memory" if kind=="memory" else "decoration" }-layer .upper-canvas').bounding_box();drag(page,r['x']+point['x']/1200*r['width'],r['y']+point['y']/800*r['height'],dx,dy,mobile)
   def aligned():
    result=page.evaluate('()=>{const c=currentCanvas,o=c.getActiveObject(),e=document.querySelector(`[data-layer-id="${o.journalId}"]`),img=e.querySelector("img"),r=c.upperCanvasEl.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect(),style=getComputedStyle(e),m=new DOMMatrix(style.transform),origin=style.transformOrigin.split(" ").map(parseFloat),dw=parseFloat(style.width),dh=parseFloat(style.height),left=parseFloat(style.left),top=parseFloat(style.top),w=img.naturalWidth/2,h=img.naturalHeight/2,n=o.calcTransformMatrix();const errors=[[0,0],[w,0],[w,h],[0,h]].map(([x,y])=>{const a=new DOMPoint(x/w*dw-origin[0],y/h*dh-origin[1]).matrixTransform(m);a.x+=origin[0]+left;a.y+=origin[1]+top;const b=fabric.util.transformPoint(new fabric.Point(x-w/2,y-h/2),n);return Math.hypot(p.x+a.x-(r.x+b.x*r.width/c.getWidth()),p.y+a.y-(r.y+b.y*r.height/c.getHeight()))});return {errors,active:canvases.filter(c=>c.getActiveObject()).length,visible:[...document.querySelectorAll(".journal-stack-controls")].filter(e=>!e.hidden).length,origin:[o.originX,o.originY],scale:[o.scaleX,o.scaleY]}}')
    assert max(result['errors'])<.12 and result['active']==1 and result['visible']==1,result
    return result
   def compare_native_image(id):
    # Compare the browser's projected image with Fabric's native object rendering,
    # not with another copy of the projection geometry implementation.
    page.evaluate('()=>{const o=currentCanvas.getActiveObject(),c=currentCanvas,ref=document.createElement("canvas");ref.width=c.getWidth()*2;ref.height=c.getHeight()*2;const x=ref.getContext("2d");x.scale(2,2);o.render(x);window.referenceImage=document.createElement("img");referenceImage.src=ref.toDataURL();referenceImage.style.cssText="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:29000";referenceImage.id="native-test-reference";referenceImage.hidden=true;document.querySelector(".journal-spread-edit").append(referenceImage)}')
    style=page.add_style_tag(content='.pf-book {background:white!important;box-shadow:none!important;} .pf-stage,.pf-actions,.journal-save-dock,.journal-stack-controls,.journal-text-controls,.journal-photo-caption {visibility:hidden!important;} .journal-stack-object {visibility:hidden!important;} .journal-stack-object[data-layer-id="'+id+'"] {visibility:visible!important;}')
    actual=page.locator('.pf-book').screenshot()
    hide=page.add_style_tag(content='.journal-stack-object[data-layer-id="'+id+'"] {visibility:hidden!important;}')
    page.evaluate('referenceImage.hidden=false');expected=page.locator('.pf-book').screenshot();page.evaluate('referenceImage.remove()');hide.evaluate('(e)=>e.remove()');style.evaluate('(e)=>e.remove()')
    from PIL import Image,ImageChops,ImageStat
    from io import BytesIO
    a=Image.open(BytesIO(actual)).convert('RGB');b=Image.open(BytesIO(expected)).convert('RGB');diff=ImageChops.difference(a,b);stats=ImageStat.Stat(diff)
    assert max(stats.mean)<1.2,(id,stats.mean)
   for id in ['aming-photo','player-polaroid','memory-fragment']:
    layers();page.locator(f'[data-layer-select="{id}"]').click();page.locator('[data-stack-action="bottom"]').click();page.locator('[data-layout="layers"]').click()
    page.evaluate('(id)=>window.currentCanvas=canvases.find(c=>c.getActiveObject()?.journalId===id)',id)
    page.wait_for_timeout(100);aligned()
    # Direct selection through the actual photo frame (outside upload centre).
    point=page.evaluate('()=>{const o=currentCanvas.getActiveObject(),p=fabric.util.transformPoint(new fabric.Point(o.width*.46,0),o.calcTransformMatrix()),r=currentCanvas.upperCanvasEl.getBoundingClientRect();return {x:r.x+p.x/1200*r.width,y:r.y+p.y/800*r.height}}');page.evaluate('canvases.forEach(c=>{c.discardActiveObject();c.requestRenderAll()})');page.touchscreen.tap(point['x'],point['y']) if mobile else page.mouse.click(point['x'],point['y']);page.wait_for_timeout(70);aligned()
    pixels=page.evaluate('()=>{const c=currentCanvas,o=c.getActiveObject(),kind=c.lowerCanvasEl.closest(".journal-memory-layer")?"memory":"decorations",v=document.querySelector(`[data-control-canvas="${kind}"]`),d=c.getRetinaScaling(),g=v.getContext("2d"),gold=(x,y)=>{const a=g.getImageData(Math.round(x*d)-3,Math.round(y*d)-3,7,7).data;return Array.from({length:a.length/4},(_,i)=>i*4).some(i=>a[i+3]>100&&a[i]>100&&a[i]>a[i+2]*1.3)};o.setCoords();const points=Object.entries(o.oCoords).map(([name,p])=>({name,visible:gold(p.x,p.y)}));const a=o.oCoords.tl,b=o.oCoords.tr;return {points,border:gold(a.x+(b.x-a.x)*.3,a.y+(b.y-a.y)*.3),visible:!v.hidden&&getComputedStyle(v).visibility==="visible",pointer:getComputedStyle(v).pointerEvents,clip:getComputedStyle(v).clipPath,scale:o.scaleX,angle:o.angle}}')
    assert pixels['visible'] and pixels['pointer']=='none' and pixels['clip']=='none',pixels
    assert len(pixels['points'])==9 and all(p['visible'] for p in pixels['points']),pixels
    assert pixels['border'],pixels
    compare_native_image(id);page.screenshot(path=f'/workspace/work/aligned-controls-{w}-{id}-before.png')
    transform('tr',-12,10);aligned();assert abs(page.evaluate('currentCanvas.getActiveObject().scaleX')-pixels['scale'])>.001
    transform('mtr',14,9);aligned();assert abs(page.evaluate('currentCanvas.getActiveObject().angle')-pixels['angle'])>.1
    point=page.evaluate('()=>{const o=currentCanvas.getActiveObject(),p=fabric.util.transformPoint(new fabric.Point(o.width*.46,0),o.calcTransformMatrix()),r=currentCanvas.upperCanvasEl.getBoundingClientRect();return {x:r.x+p.x/1200*r.width,y:r.y+p.y/800*r.height}}');drag(page,point['x'],point['y'],-10,-8,mobile);aligned();compare_native_image(id);page.screenshot(path=f'/workspace/work/aligned-controls-{w}-{id}-after.png')
    print('PASS individual aligned controls',w,h,id,flush=True)
    assert page.evaluate('testBook.getCurrentPageIndex()')==9
   page.set_viewport_size({'width':932 if mobile else 1280,'height':430 if mobile else 800});page.wait_for_timeout(550)
   for id in ['aming-photo','player-polaroid','memory-fragment']:
    layers();page.locator(f'[data-layer-select="{id}"]').click();layers();page.evaluate('(id)=>window.currentCanvas=canvases.find(c=>c.getActiveObject()?.journalId===id)',id);aligned()
   page.locator('[data-book="edit"]').click();saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts"))');page.reload();ready(page);assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts"))')==saved
   page.locator('[data-book="edit"]').click();layer_ready(page)
   for id in ['aming-photo','player-polaroid','memory-fragment']:
    layers();page.locator(f'[data-layer-select="{id}"]').click();layers();page.evaluate('(id)=>window.currentCanvas=canvases.find(c=>c.getActiveObject()?.journalId===id)',id);aligned()
   page.locator('[data-book="edit"]').click();expect(page.locator('.journal-stack-controls').first).to_be_hidden();expect(page.locator('.journal-stack-controls').last).to_be_hidden()
   assert page.evaluate('engineCount')==1;assert not errors,errors;c.close();print('PASS native/projection geometry and pixel comparison, exclusive selection, move/scale/rotate, cleanup',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
