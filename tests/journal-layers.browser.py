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
   mobile=w<1000;c=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui()');page.locator('[data-book="edit"]').click();layer_ready(page)
   page.locator('[data-layout="layers"]').click();expect(page.locator('[data-layer-select]')).to_have_count(5)
   tool(page,'compass').click();layer_ready(page);expect(page.locator('[data-layer-select]')).to_have_count(6);page.locator('[data-stack-action="top"]').click();assert page.locator('[data-layer-select]').first.inner_text().startswith('指南針貼紙');tool(page,'undo').click();layer_ready(page);tool(page,'undo').click();layer_ready(page);expect(page.locator('[data-layer-select]')).to_have_count(5)
   page.locator('[data-layer-select="aming-story"]').click();page.locator('[data-stack-action="up"]').click();page.locator('[data-book="edit"]').click()
   # Seed a legacy-style layout with overlapping, real objects; preserve all content.
   page.evaluate('()=>{const k="aming-diary-journal-layouts",d=JSON.parse(localStorage.getItem(k)),s=d.stations.ruisui;delete s.layerOrder;s.objects.forEach(o=>Object.assign(o,{page:"right",x:.5,y:.35,angle:0,scale:.6}));Object.assign(s.memoryObject,{page:"right",x:.5,y:.35,angle:0,scale:1});s.domObjects.forEach(o=>Object.assign(o,{page:"right",x:.2,y:.2,width:.6,angle:0}));localStorage.setItem(k,JSON.stringify(d));}')
   page.reload();ready(page);page.locator('[data-book="edit"]').click();layer_ready(page);page.locator('[data-layout="layers"]').click();expect(page.locator('[data-layer-select]')).to_have_count(5)
   # Close panel before visual hit tests: it is a separate, deliberate UI overlay.
   def top_at_center():
    return page.evaluate('()=>{const p=document.querySelector("[data-dom-object=aming-story]").closest(".pf-book").getBoundingClientRect();return document.elementFromPoint(p.left+p.width*.75,p.top+p.height*.35)?.closest("[data-layer-id]")?.dataset.layerId}')
   page.locator('[data-layout="layers"]').click();initial=top_at_center();assert initial=='memory-fragment',initial
   page.locator('[data-layout="layers"]').click();page.locator('[data-layer-select="player-polaroid"]').click();page.locator('[data-layout="layers"]').click();assert top_at_center()==initial # selection never changes real order
   for id in ['player-polaroid','memory-fragment','aming-story','player-writing','aming-photo']:
    page.locator('[data-layout="layers"]').click();page.locator(f'[data-layer-select="{id}"]').click();page.locator('[data-stack-action="top"]').click();page.locator('[data-layout="layers"]').click();assert top_at_center()==id,(id,top_at_center())
   page.screenshot(path=f'/workspace/work/layers-overlap-{w}.png')
   page.locator('[data-layout="layers"]').click();page.locator('[data-stack-action="down"]').click();assert page.locator('[data-layer-select]').nth(1).get_attribute('data-layer-select')=='aming-photo'
   page.locator('[data-stack-action="bottom"]').click();assert page.locator('[data-layer-select]').last.get_attribute('data-layer-select')=='aming-photo'
   page.locator('[data-stack-action="up"]').click();assert page.locator('[data-layer-select]').nth(3).get_attribute('data-layer-select')=='aming-photo'
   page.locator('[data-layout="layers"]').click()
   # Save UI is outside the movable note, remains relative to right page / book.
   before=page.locator('#save-travel').bounding_box();book=page.locator('.pf-book').bounding_box();assert abs(before['x']+before['width']-(book['x']+book['width']-20))<2
   assert abs(before['y']+before['height']-(book['y']+book['height']-20))<2
   assert page.locator('.travel-entry #save-travel').count()==0
   page.locator('[data-layout="layers"]').click();page.locator('[data-layer-select="player-writing"]').click();page.locator('[data-stack-action="top"]').click();page.locator('[data-layout="layers"]').click()
   controls=page.locator('[data-dom-controls="player-writing"]');b=controls.locator('[data-dom-handle="rotate"]').bounding_box();drag(page,b['x']+b['width']/2,b['y']+b['height']/2,12,8,mobile)
   heading=page.locator('[data-dom-object="player-writing"] h2').bounding_box();drag(page,heading['x']+10,heading['y']+10,-book['width']*.5,0,mobile)
   page.locator('#travel-note').fill('圖層與固定按鈕保存測試');page.locator('#save-travel').click();assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='圖層與固定按鈕保存測試'
   after=page.locator('#save-travel').bounding_box();assert all(abs(before[k]-after[k])<1 for k in before),(before,after)
   page.locator('[data-book="edit"]').click();expect(page.locator('#save-travel')).to_be_hidden();saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert len(saved['layerOrder'])==5
   page.reload();ready(page);expect(page.locator('#save-travel')).to_be_hidden();assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui')==saved
   page.locator('[data-book="edit"]').click();layer_ready(page);page.locator('[data-layout="layers"]').click();assert page.locator('[data-layer-select]').all_text_contents()[0].startswith('我的旅行心得')
   page.locator('[data-layout="layers"]').click();tool(page,'reset').click();layer_ready(page);page.locator('[data-book="edit"]').click()
   assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='圖層與固定按鈕保存測試'
   reset=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui.layerOrder');assert reset==['player-polaroid','aming-photo','aming-story','player-writing','memory-fragment'],reset
   page.evaluate('GameProgress.reset()');expect(page.locator('#save-travel')).to_be_hidden();expect(page.locator('.journal-stack-object').first).to_be_hidden()
   assert page.evaluate('engineCount')==1;page.evaluate("location.hash='#/home'");page.wait_for_selector('#home-screen');assert page.locator('.journal-save-dock').count()==0;assert not errors,errors;c.close();print('PASS mixed-object visual stack, all ordering actions, no selection promotion, save dock, persistence/reset',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
