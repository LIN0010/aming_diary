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
   c=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<1000,has_touch=w<1000);page=c.new_page();page.on('dialog',lambda d:d.accept());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui()')
   original=page.locator('.diary-entry p').all_text_contents()
   first=page.locator('.diary-entry p').first.bounding_box();title=page.locator('.diary-entry h2').bounding_box();assert 0<=first['y']-title['y']-title['height']<45
   def check():
    expect(page.locator('.journal-dom-object')).to_have_count(2)
    assert page.locator('.diary-entry').count()==1 and page.locator('.travel-entry').count()==1
    assert page.locator('.diary-entry p').all_text_contents()==original
    expect(page.locator('.diary-entry .memory-fragment')).to_have_count(0)
    geometry=page.evaluate('(()=>{const s=document.querySelector(".diary-entry"),n=document.querySelector(".travel-entry"),r=e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom}};return {title:r(s.querySelector("h2")),first:r(s.querySelector("p")),last:r([...s.querySelectorAll("p")].at(-1)),note:r(n)}})()')
    assert 0<=geometry['first']['top']-geometry['title']['bottom']<45,geometry
    assert geometry['last']['bottom']<=geometry['note']['top'],geometry
   page.locator('[data-book="edit"]').click();layer_ready(page);page.locator('.diary-entry h2').click();check()
   page.locator('#travel-note').fill('保存玩家的完整心得');page.locator('[data-book="edit"]').click();check()
   page.screenshot(path=f'/workspace/work/text-fixed-{w}.png')
   page.wait_for_function("location.hash.includes('station=ruisui')");page.reload();ready(page);check()
   saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts"))');
   # 舊存檔沒有 memoryObject，但有自訂 HTML 位置：保留坐標，讀取時也移出來源節點。
   page.evaluate('()=>{const k="aming-diary-journal-layouts",d=JSON.parse(localStorage.getItem(k));delete d.stations.ruisui.memoryObject;d.stations.ruisui.domObjects.forEach(o=>o.x+=.01);localStorage.setItem(k,JSON.stringify(d));}')
   legacy=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts"))');page.reload();ready(page);check();assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts"))')==legacy
   page.locator('[data-book="edit"]').click();layer_ready(page)
   box=page.locator('[data-dom-object="aming-story"]');box.locator('h2').click();handle=box.locator('[data-dom-handle="resize"]');b=handle.bounding_box();drag(page,b['x']+14,b['y']+14,-12,0,w<1000)
   page.locator('[data-book="edit"]').click();assert page.locator('.diary-entry p').all_text_contents()==original
   page.locator('[data-book="edit"]').click();tool(page,'reset').click();layer_ready(page);page.locator('[data-book="edit"]').click();check();assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='保存玩家的完整心得'
   page.locator('.pf-index-tab').click();ready(page,1);page.locator('#ruisui-journal').click();ready(page);check();assert page.evaluate('engineCount')==1;assert not errors,errors
   c.close();print('PASS contiguous HTML story, separate notes, old save preserved, resize/reset, reload/turns',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
