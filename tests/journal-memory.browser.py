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
 drag(page,r['x']+point['x']/600*r['width'],r['y']+point['y']/800*r['height'],dx,dy,mobile)

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
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   fb=(ROOT/'aming-game/vendor/fabric/fabric.min.js').read_text();page.route('**/fabric.min.js',lambda r:r.fulfill(body=fb+';window.canvases=[];const init=fabric.Canvas.prototype.initialize;fabric.Canvas.prototype.initialize=function(...args){const r=init.apply(this,args);canvases.push(this);return r;};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui()');story=page.locator('.diary-entry p').all_text_contents()
   page.locator('[data-book="edit"]').click();page.wait_for_function('canvases.some(c=>c.lowerCanvasEl.closest(".journal-memory-layer"))');page.wait_for_function('!document.querySelector(".journal-memory-layer").hidden')
   page.evaluate('window.testCanvas=canvases.find(c=>c.lowerCanvasEl.closest(".journal-memory-layer"))')
   expect(page.locator('[data-dom-object="memory-fragment"]')).to_have_count(0)
   def transform(name,dx,dy):
    q=page.evaluate('(n)=>{const o=testCanvas.getActiveObject();o.setCoords();return {x:o.oCoords[n].x,y:o.oCoords[n].y}}',name);r=page.locator('.journal-memory-layer .upper-canvas').bounding_box();drag(page,r['x']+q['x']/600*r['width'],r['y']+q['y']/800*r['height'],dx,dy,mobile)
   r=page.locator('.journal-memory-layer .upper-canvas').bounding_box();o=page.evaluate('({x:testCanvas.getObjects()[0].left/600,y:testCanvas.getObjects()[0].top/800,angle:testCanvas.getObjects()[0].angle,scale:testCanvas.getObjects()[0].scaleX})')
   drag(page,r['x']+o['x']*r['width'],r['y']+o['y']*r['height'],-20,-10,mobile);assert page.evaluate('!!testCanvas.getActiveObject()')
   transform('mtr',15,12);transform('tr',-12,8)
   assert page.evaluate('testBook.getCurrentPageIndex()')==9
   page.locator('#travel-note').fill('碎片原生控制後仍可輸入');page.locator('[data-book="edit"]').click();expect(page.locator('#travel-note')).to_be_hidden()
   saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert saved['memoryObject']['page']=='right' and saved['memoryObject']['angle']!=o['angle'] and abs(saved['memoryObject']['scale']-o['scale'])>.01
   assert page.locator('.diary-entry p').all_text_contents()==story
   page.locator('.journal-memory-hit').click();expect(page.locator('#memory-drawer')).to_have_class(__import__('re').compile('show'));page.locator('#close-memory').click();expect(page.locator('#memory-overlay')).to_be_hidden()
   page.wait_for_function("location.hash.includes('station=ruisui')");page.reload();ready(page);expect(page.locator('.journal-memory-hit')).to_be_visible();assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui')==saved
   page.screenshot(path=f'/workspace/work/memory-native-{w}.png')
   assert page.evaluate('engineCount')==1;assert not errors,errors
   context.close();print('PASS native memory group, mouse/touch transform, notes, collection click, persistence',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
