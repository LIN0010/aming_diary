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
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui()')
   story=page.locator('.diary-entry p').all_text_contents();page.locator('[data-book="edit"]').click();layer_ready(page)
   expect(page.locator('.journal-dom-object')).to_have_count(2)
   for id in ['aming-story','player-writing']:
    box=page.locator(f'[data-dom-object="{id}"]');box.scroll_into_view_if_needed();r=box.bounding_box()
    # 點擊群組本身即選取，之後使用專用控制點，避免對 textarea 輸入起拖。
    target=box.locator('.diary-entry h2' if id=='aming-story' else '.travel-entry small' if id=='player-writing' else 'img').first.bounding_box();x=target['x']+target['width']/2;y=target['y']+target['height']/2
    page.touchscreen.tap(x,y) if mobile else page.mouse.click(x,y)
    expect(box).to_have_class(__import__('re').compile('is-selected'))
    handle=box.locator('[data-dom-handle="move"]');b=handle.bounding_box();drag(page,b['x']+14,b['y']+14,12,8,mobile)
    handle=box.locator('[data-dom-handle="resize"]');b=handle.bounding_box();drag(page,b['x']+14,b['y']+14,-18,0,mobile)
    handle=box.locator('[data-dom-handle="rotate"]');b=handle.bounding_box();drag(page,b['x']+14,b['y']+14,-10,12,mobile)
    assert page.evaluate('testBook.getCurrentPageIndex()')==9
    if id=='aming-story':
     for _ in range(3):tool(page,'undo').click();layer_ready(page) # 各群組獨立測試，避免刻意變形後遮住下一組。
   # HTML 文字仍完整、不可編輯阿明的故事，心得仍可編輯和儲存。
   assert page.locator('.diary-entry p').all_text_contents()==story
   assert '我好像來過這裡' in page.locator('.diary-entry').inner_text()
   assert page.locator('.diary-entry [contenteditable]').count()==0
   page.locator('#travel-note').fill('自由排版心得\n第二行保留');page.locator('[data-book="edit"]').click();expect(page.locator('#travel-note')).to_be_hidden()
   saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert len(saved['domObjects'])==2
   assert all(all(isinstance(o[k],(int,float)) for k in ['x','y','width','angle','order']) for o in saved['domObjects'])
   expect(page.locator('.journal-dom-handles').first).to_be_hidden()
   page.locator('.journal-memory-hit').click();expect(page.locator('#memory-drawer')).to_have_class(__import__('re').compile('show'));page.locator('#close-memory').click();expect(page.locator('#memory-overlay')).to_be_hidden()
   # 自訂群組在閱讀模式仍能起拖翻頁。
   page.screenshot(path=f'/workspace/work/dom-before-drag-{w}.png');page.locator('.diary-entry p').last.scroll_into_view_if_needed();r=page.locator('.diary-entry p').last.bounding_box();s=page.locator('.pf-stage').bounding_box();drag(page,r['x']+r['width']*.6,r['y']+r['height']/2,-s['width']*.6,0,mobile);ready(page,11);page.evaluate('testBook.flipPrev()');ready(page)
   page.wait_for_function("location.hash.includes('station=ruisui')");page.reload();ready(page);expect(page.locator('.journal-dom-object')).to_have_count(2);expect(page.locator('#travel-note-reading')).to_have_text('自由排版心得\n第二行保留')
   restored=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert restored==saved
   page.screenshot(path=f'/workspace/work/dom-read-{w}.png')
   page.locator('[data-book="edit"]').click();layer_ready(page);tool(page,'reset').click();layer_ready(page);page.locator('[data-book="edit"]').click()
   assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='自由排版心得\n第二行保留'
   assert page.evaluate('engineCount')==1
   page.evaluate('GameProgress.reset()');expect(page.locator('.journal-dom-object').first).to_be_hidden()
   page.set_viewport_size({'width':932 if mobile else 1200,'height':430 if mobile else 760});page.wait_for_timeout(500)
   assert not errors,errors;context.close();print('PASS HTML groups, pointer transforms, memory click, notes, read drag, reload, reset',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
