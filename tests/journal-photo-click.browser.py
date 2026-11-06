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
 point=page.evaluate('(name)=>{const o=testCanvas.getActiveObject();o.setCoords();return {x:o.oCoords[name].x,y:o.oCoords[name].y}}',name);r=page.locator('.journal-decoration-layer .upper-canvas').bounding_box()
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
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=context.new_page();opened=[];page.on('filechooser',lambda f:opened.append(f))
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;}};',content_type='application/javascript'))
   fb=(ROOT/'aming-game/vendor/fabric/fabric.min.js').read_text();page.route('**/fabric.min.js',lambda r:r.fulfill(body=fb+';const init=fabric.Canvas.prototype.initialize;fabric.Canvas.prototype.initialize=function(...args){if(args[0].closest(".journal-decoration-layer"))window.testCanvas=this;return init.apply(this,args)};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui()')
   def click_at(x,y):page.touchscreen.tap(x,y) if mobile else page.mouse.click(x,y)
   def photo_point(frame=False,reading=False):
    o=page.evaluate('(()=>{const o=testCanvas.getObjects()[0];const p=fabric.util.transformPoint(new fabric.Point('+('105' if frame else '0')+',0),o.calcTransformMatrix());return {x:p.x/600,y:p.y/800}})()');r=page.locator('.journal-decoration-layer' if reading else '.journal-decoration-layer .upper-canvas').bounding_box();return r['x']+o['x']*r['width'],r['y']+o['y']*r['height']
   page.locator('[data-book="edit"]').click();layer_ready(page)
   empty=page.evaluate('(()=>{const o=testCanvas.getObjects()[0],r=o.getObjects().find(c=>c.fill==="#E1D5BD");return {width:o.width,height:o.height,rx:r.width/o.width,ry:r.height/o.height}})()');assert abs(empty['rx']-.64)<.0001 and abs(empty['ry']-.60)<.0001
   if not mobile:
    page.mouse.move(*photo_point());assert page.locator('.journal-decoration-layer .upper-canvas').evaluate('(e)=>getComputedStyle(e).cursor')=='pointer'
   page.screenshot(path=f'/workspace/work/photo-upload-area-{w}.png')
   click_at(*photo_point(True));page.wait_for_timeout(100);assert not opened
   with page.expect_file_chooser() as selected:click_at(*photo_point())
   selected.value.set_files(str(ROOT/'aming-game/images/cow.png'));layer_ready(page);page.wait_for_function('document.querySelector("#player-photo-preview").src.startsWith("data:image/jpeg")');first=page.locator('#player-photo-preview').get_attribute('src')
   loaded=page.evaluate('(()=>{const o=testCanvas.getObjects()[0];return {width:o.width,height:o.height,grey:o.getObjects().some(c=>c.fill==="#E1D5BD")}})()');assert not loaded['grey'] and loaded['width']==empty['width'] and loaded['height']==empty['height']
   x,y=photo_point();drag(page,x,y,18,-12,mobile);page.wait_for_timeout(100);assert len(opened)==1
   transform=page.evaluate('(()=>{const o=testCanvas.getObjects()[0];return [o.left,o.top,o.angle,o.scaleX]})()')
   with page.expect_file_chooser() as selected:click_at(*photo_point())
   selected.value.set_files(str(ROOT/'aming-game/images/aming.png'));layer_ready(page);page.wait_for_function('(old)=>document.querySelector("#player-photo-preview").src!==old',arg=first)
   assert page.evaluate('(()=>{const o=testCanvas.getObjects()[0];return [o.left,o.top,o.angle,o.scaleX]})()')==transform
   with page.expect_file_chooser() as selected:tool(page,'photo').click()
   selected.value.set_files(str(ROOT/'aming-game/images/cow.png'));layer_ready(page)
   page.locator('[data-book="edit"]').click();expect(page.locator('#travel-note')).to_be_hidden();click_at(*photo_point(reading=True));page.wait_for_timeout(100);assert len(opened)==3
   saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert saved['photo'].startswith('data:image/jpeg')
   page.wait_for_function("location.hash.includes('station=ruisui')");page.reload();ready(page);assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui')==saved
   context.close();print('PASS photo center upload/replace, frame selection, drag suppression, read guard, persistence',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
