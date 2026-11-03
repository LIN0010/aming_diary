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
  for width,height in [(1280,844),(844,390)]:
   context=browser.new_context(viewport={'width':width,'height':height});page=context.new_page();count=[];bundle=(Path(__file__).resolve().parents[1]/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.bookCount=(window.bookCount||0)+1;}};',content_type='application/javascript'))
   for query,present in [('',False),('?debug=0',False),('?debug=1',True)]:
    page.goto(f'http://127.0.0.1:{server.server_port}/diary.html'+query,wait_until='domcontentloaded');page.wait_for_function('document.querySelectorAll(".stf__item").length===16');assert page.locator('.pf-debug-toggle').count()==int(present)
    if not present:continue
    page.locator('.pf-debug-toggle').click();expect(page.locator('.pf-border-panel output')).to_have_text('0.35');page.locator('#pf-border-range').evaluate('(e)=>{e.value="0.61";e.dispatchEvent(new Event("input",{bubbles:true}));}');expect(page.locator('.pf-border-panel output')).to_have_text('0.61');assert page.locator('.pf-page').first.evaluate('(e)=>getComputedStyle(e).borderTopColor')=='rgba(55, 42, 30, 0.61)'
    page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert 'debug=1' in page.url;page.locator('.pf-debug-toggle').click();panel=page.locator('.pf-border-panel').bounding_box();frame=page.locator('.pf-frame').bounding_box();assert panel['y']+panel['height']<=frame['y'];assert page.evaluate('bookCount')==1;page.screenshot(path=f'/workspace/work/border-panel-{width}.png');page.locator('#pf-border-range').focus();page.keyboard.press('Escape');expect(page.locator('.pf-border-panel')).not_to_be_visible();page.locator('[data-book="close"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")')
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?debug=1',wait_until='domcontentloaded');expect(page.locator('.pf-debug-toggle')).to_be_visible(timeout=60000);page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');page.locator('#ruisui-journal').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert 'debug=1' in page.url
   assert page.evaluate('GameNavigation.route(new URL("game#/diary?debug=1",location.href)).url')=='diary.html?debug=1'
   context.close();print('PASS debug panel',width,flush=True)
  browser.close()
finally:server.shutdown()
