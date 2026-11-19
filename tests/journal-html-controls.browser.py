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
  for w,h,target in [(1440,900,'aming-story'),(852,393,'aming-story'),(1440,900,'player-writing'),(852,393,'player-writing')]:
   mobile=w<1000;c=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui()');story=page.locator('.diary-entry p').all_text_contents()
   page.locator('[data-book="edit"]').click();layer_ready(page)
   box=page.locator(f'[data-dom-object="{target}"]');box.locator('h2').click()
   if target=='player-writing':page.locator('#travel-note').fill('我的旅行心得，保留 HTML 文字與換行。\n第二行也要儲存。')
   expect(page.locator('[data-dom-controls="aming-story"] [data-dom-handle]')).to_have_count(9)
   expect(page.locator('[data-dom-controls="player-writing"] [data-dom-handle]')).to_have_count(9)
   before=box.bounding_box();font=box.locator('p' if target=='aming-story' else 'textarea').first.evaluate('(e)=>getComputedStyle(e).fontSize')
   def handle_drag(name,dx,dy):
    b=page.locator(f'[data-dom-controls="{target}"] [data-dom-handle="{name}"]').bounding_box();drag(page,b['x']+b['width']/2,b['y']+b['height']/2,dx,dy,mobile)
   handle_drag('e',-45,0);after=box.bounding_box();assert after['width']<before['width']-10
   assert box.locator('p' if target=='aming-story' else 'textarea').first.evaluate('(e)=>getComputedStyle(e).fontSize')==font
   assert box.locator('.journal-dom-content').evaluate('(e)=>e.scrollHeight>=e.clientHeight')
   handle_drag('s',0,30);assert box.locator('.journal-dom-content').evaluate('(e)=>e.scrollHeight>=e.clientHeight')
   handle_drag('rotate',15,10);assert 'rotate(0deg)' not in box.get_attribute('style')
   assert page.evaluate('testBook.getCurrentPageIndex()')==9
   page.screenshot(path=f'/workspace/work/html-controls-{target}-{w}.png')
   # Drag HTML itself across the spine, no move-button prerequisite.
   heading=box.locator('h2').bounding_box();frame=page.locator('.pf-frame').bounding_box();drag(page,heading['x']+heading['width']/2,heading['y']+heading['height']/2,-frame['width']*.5,0,mobile)
   assert box.get_attribute('data-journal-page')=='left'
   b=box.bounding_box();paper=page.locator('.pf-rui-column').first.locator('xpath=ancestor::*[contains(@class,"pf-page")]').bounding_box();assert b['x']>=paper['x']-1 and b['x']+b['width']<=paper['x']+paper['width']+1
   page.locator('[data-book="edit"]').click();expect(page.locator('[data-dom-controls="aming-story"]')).to_be_hidden()
   saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert next(o for o in saved['domObjects'] if o['id']==target)['page']=='left'
   page.reload();ready(page);expect(page.locator('.journal-dom-object')).to_have_count(2);assert page.locator('.diary-entry p').all_text_contents()==story
   assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui')==saved
   frame=page.locator('.pf-frame').bounding_box();drag(page,frame['x']+frame['width']-4,frame['y']+frame['height']*.45,-frame['width']*.7,0,mobile);ready(page,11);page.evaluate('testBook.flipPrev()');ready(page)
   page.locator('[data-book="edit"]').click();layer_ready(page);tool(page,'reset').click();layer_ready(page);page.locator('[data-book="edit"]').click()
   assert page.locator('.diary-entry p').all_text_contents()==story
   if target=='player-writing':assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='我的旅行心得，保留 HTML 文字與換行。\n第二行也要儲存。'
   assert page.evaluate('engineCount')==1;assert not errors,errors;c.close();print('PASS HTML story controls, reflow, rotation, cross-page snap, save/reload/reset, native flips',w,h,target,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
