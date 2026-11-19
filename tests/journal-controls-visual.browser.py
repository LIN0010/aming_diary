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
   tool(page,'compass').click();layer_ready(page)
   r=page.locator('.journal-stack-object[data-layer-id="aming-photo"]').bounding_box()
   x=r['x']+r['width']/2;y=r['y']+r['height']/2
   page.touchscreen.tap(x,y) if mobile else page.mouse.click(x,y)
   assert page.evaluate('canvases.some(c=>c.getActiveObject()?.journalId==="aming-photo")')
   sticker=page.evaluate('canvases.flatMap(c=>c.getObjects()).find(o=>o.journalType==="sticker").journalId')
   def transform(name,dx,dy):
    point=page.evaluate('(name)=>{const o=currentCanvas.getActiveObject();o.setCoords();return {x:o.oCoords[name].x,y:o.oCoords[name].y}}',name);kind=page.evaluate('currentCanvas.lowerCanvasEl.closest(".journal-memory-layer")?"memory":"decorations"');r=page.locator(f'.journal-{ "memory" if kind=="memory" else "decoration" }-layer .upper-canvas').bounding_box();drag(page,r['x']+point['x']/1200*r['width'],r['y']+point['y']/800*r['height'],dx,dy,mobile)
   for id in ['player-polaroid','aming-photo','memory-fragment',sticker]:
    page.locator('[data-layout="layers"]').click();page.locator(f'[data-layer-select="{id}"]').click();page.locator('[data-stack-action="bottom"]').click();page.locator('[data-layout="layers"]').click()
    page.evaluate('(id)=>window.currentCanvas=canvases.find(c=>c.getActiveObject()?.journalId===id)',id)
    page.wait_for_timeout(100)
    pixels=page.evaluate('()=>{const c=currentCanvas,o=c.getActiveObject(),kind=c.lowerCanvasEl.closest(".journal-memory-layer")?"memory":"decorations",v=document.querySelector(`[data-control-canvas="${kind}"]`),d=c.getRetinaScaling(),g=v.getContext("2d"),gold=(x,y)=>{const a=g.getImageData(Math.round(x*d)-3,Math.round(y*d)-3,7,7).data;return Array.from({length:a.length/4},(_,i)=>i*4).some(i=>a[i+3]>100&&a[i]>100&&a[i]>a[i+2]*1.3)};o.setCoords();const points=Object.entries(o.oCoords).map(([name,p])=>({name,visible:gold(p.x,p.y)}));const a=o.oCoords.tl,b=o.oCoords.tr;return {points,border:gold(a.x+(b.x-a.x)*.3,a.y+(b.y-a.y)*.3),visible:!v.hidden&&getComputedStyle(v).visibility==="visible",pointer:getComputedStyle(v).pointerEvents,clip:getComputedStyle(v).clipPath,scale:o.scaleX,angle:o.angle}}')
    assert pixels['visible'] and pixels['pointer']=='none' and pixels['clip']=='none',pixels
    assert len(pixels['points'])==9 and all(p['visible'] for p in pixels['points']),pixels
    assert pixels['border'],pixels
    page.screenshot(path=f'/workspace/work/native-controls-{w}-{id}.png')
    transform('tr',-12,10);assert abs(page.evaluate('currentCanvas.getActiveObject().scaleX')-pixels['scale'])>.001
    transform('mtr',14,9);assert abs(page.evaluate('currentCanvas.getActiveObject().angle')-pixels['angle'])>.1
    assert page.evaluate('testBook.getCurrentPageIndex()')==9
   page.locator('[data-book="edit"]').click();expect(page.locator('.journal-stack-controls').first).to_be_hidden();expect(page.locator('.journal-stack-controls').last).to_be_hidden()
   assert page.evaluate('engineCount')==1;assert not errors,errors;c.close();print('PASS visible native border + nine control points, bottom layer, scale/rotate, read cleanup',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
