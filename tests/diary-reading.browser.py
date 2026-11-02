"""旅團名冊選取、真實進度、獨立捲動與響應式檢查。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil
class Q(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Q,directory=str(Path(__file__).resolve().parents[1]/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for width,height in [(1280,844),(844,390)]:
   page=browser.new_page(viewport={'width':width,'height':height});bundle=(Path(__file__).resolve().parents[1]/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.engineCount=(window.engineCount||0)+1;}update(){if(this.getState()!=="read")window.resizeDuringFlip=true;return super.update();}};',content_type='application/javascript'));errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/diary.html');page.wait_for_function('document.querySelectorAll(".stf__item").length===16');original=page.locator('.pf-book').bounding_box();page.locator('.pf-mode-switch input').check()
   page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert page.locator('#diary-screen').evaluate('(e)=>e.classList.contains("pf-reading")');box=page.locator('.pf-book').bounding_box();assert box['height']>original['height'];assert abs(box['width']/width-.9)<.02
   assert page.locator('.bottom-nav').evaluate('(e)=>e.inert&&getComputedStyle(e).opacity==="0"')
   page.locator('#ruisui-journal').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');expect(page.locator('#aming-journal .journal-page').first).not_to_be_visible();expect(page.locator('#travel-note')).to_be_visible();expect(page.locator('.diary-tabs')).not_to_be_visible()
   page.locator('#player-photo-input').set_input_files({'name':'test.svg','mimeType':'image/svg+xml','buffer':b'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'});expect(page.locator('.player-photo')).to_have_class(__import__('re').compile('has-photo'))
   page.locator('#travel-note').fill('沉浸閱讀心得');page.locator('#save-travel').click();assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='沉浸閱讀心得'
   page.evaluate('GameProgress.completeRuisui()');expect(page.locator('#aming-journal .journal-page').first).to_be_visible();assert page.locator('#aming-journal .journal-page').count()==2;assert page.locator('#player-journal .journal-page').count()==2
   assert page.locator('#diary-screen').evaluate('(e)=>e.scrollLeft')==0
   assert page.locator('.pf-book').bounding_box()['x']>=0
   page.screenshot(path=f'/workspace/work/immersive-{width}.png');page.locator('[data-book="close"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert not page.locator('#diary-screen').evaluate('(e)=>e.classList.contains("pf-reading")');assert not page.locator('.bottom-nav').evaluate('(e)=>e.inert');assert abs(page.locator('.pf-book').bounding_box()['height']-original['height'])<2
   page.locator('.pf-mode-switch input').uncheck();page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert not page.locator('#diary-screen').evaluate('(e)=>e.classList.contains("pf-reading")');page.locator('#ruisui-journal').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');expect(page.locator('#player-tab')).to_be_visible();page.locator('#player-tab').click();expect(page.locator('#travel-note')).to_have_value('沉浸閱讀心得');assert page.evaluate('engineCount')==1;assert not page.evaluate('window.resizeDuringFlip===true');assert not errors,errors;page.close();print('PASS immersive/classic comparison',width,height,flush=True)
  browser.close()
finally:server.shutdown()
