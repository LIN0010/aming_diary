"""正式沉浸式日記：原生雙向翻頁、目錄、鎖定、上傳、保存與可視尺寸。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil, os
class Q(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Q,directory=str(Path(__file__).resolve().parents[1]/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for width,height in ([(1280,844)] if os.environ.get("UI_DESKTOP") else [(1280,844),(844,390),(812,300)]):
   context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,is_mobile=width<1000,user_agent=('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' if width<1000 else None));page=context.new_page();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=(Path(__file__).resolve().parents[1]/'aming-game/vendor/page-flip/page-flip.browser.js').read_text()+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...args){super(...args);window.testBook=this;}};',content_type='application/javascript'));errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/diary.html',wait_until='domcontentloaded');page.wait_for_function('document.querySelectorAll(".stf__item").length===16');assert page.locator('.pf-controls,.pf-mode-switch,.diary-tabs').count()==0
   page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert page.locator('.bottom-nav').evaluate('(e)=>e.inert');page.locator('#ruisui-journal').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');expect(page.locator('#aming-journal .journal-page').first).not_to_be_visible();page.evaluate('GameProgress.completeRuisui()');expect(page.locator('#aming-journal .journal-page').first).to_be_visible();expect(page.locator('#travel-note-reading')).to_be_visible()
   page.locator('[data-book="edit"]').click();page.locator('#travel-note').fill('實體書保存測試');page.locator('[data-book="index"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='實體書保存測試'
   # 從紙張外緣拖曳，驗證套件原生滑鼠及觸控翻頁。
   r=page.locator('.pf-frame').bounding_box();x=r['x']+r['width']-3;y=r['y']+r['height']*.7
   if width<1000:
    c=context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for k in range(1,16):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-r['width']*.75*k/15,'y':y}]})
    c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
   else:
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x-r['width']*.75,y,steps=20);page.mouse.up()
   page.wait_for_timeout(900);assert page.locator('#ruisui-journal').evaluate('(e)=>getComputedStyle(e.closest(".pf-page")).display')=='none'
   # 反向拖曳回目錄，確認同一引擎的雙向操作。
   x=r['x']+3
   if width<1000:
    c=context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for k in range(1,16):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+r['width']*.75*k/15,'y':y}]})
    c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
   else:
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+r['width']*.75,y,steps=20);page.mouse.up()
   page.wait_for_timeout(900);assert page.evaluate('testBook.getCurrentPageIndex()')==1
   expect(page.locator('[data-book="index"]')).to_be_hidden();page.locator('#ruisui-journal').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');page.locator('#player-photo-input').set_input_files(str(Path(__file__).resolve().parents[1]/'aming-game/images/cow.png'));expect(page.locator('.player-photo')).to_have_class(__import__('re').compile('has-photo'));page.set_viewport_size({'width':width,'height':height-30});page.wait_for_timeout(500);assert page.locator('.pf-stage').evaluate('(e)=>e.clientWidth/e.clientHeight')>1.4
   page.screenshot(path=f'/workspace/work/physical-diary-{width}.png');page.locator('[data-book="close"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert not page.locator('.bottom-nav').evaluate('(e)=>e.inert');assert not errors,errors
   if width==1280:
    page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');page.evaluate('testBook.flipPrev()');page.wait_for_function('!document.querySelector("#diary-screen").classList.contains("pf-ui-hidden")');page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")')
    for destination in [3,5,7,9,11,13,15]:
     page.evaluate('testBook.flipNext()');page.wait_for_function('(n)=>testBook.getState()==="read"&&testBook.getCurrentPageIndex()===n',arg=destination)
    page.wait_for_function('!document.querySelector("#diary-screen").classList.contains("pf-ui-hidden")');page.locator('.pf-hard').last.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert page.evaluate('testBook.getCurrentPageIndex()')==13;page.locator('[data-book="close"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")')
   context.close();print('PASS physical book',width,height,flush=True)
  browser.close()
finally:server.shutdown()
