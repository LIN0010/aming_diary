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
  page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')
  bundle=(Path(__file__).resolve().parents[1]/'aming-game/vendor/page-flip/page-flip.browser.js').read_text()
  page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...args){super(...args);window.measuredEngine=this;window.engineCount=(window.engineCount||0)+1;}}; ',content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/diary.html');page.wait_for_function('window.measuredEngine&&document.querySelectorAll(".stf__item").length===16')
  def measure(label):
   print(label,page.evaluate("()=>({settings:{width:measuredEngine.getSettings().width,height:measuredEngine.getSettings().height},boxes:Object.fromEntries(['#diary-screen','.pf-book','.pf-frame','.pf-stage','.stf__wrapper','.stf__block','.stf__item'].map(s=>{const e=s==='.stf__item'?[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().width>0):document.querySelector(s),r=e.getBoundingClientRect();return [s,{w:Math.round(r.width),h:Math.round(r.height),clientW:e.clientWidth,clientH:e.clientHeight}]}))})"),flush=True)
  measure('portrait-init');page.set_viewport_size({'width':844,'height':390});expect(page.locator('.orientation-prompt')).not_to_be_visible();page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');page.locator('#ruisui-journal').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');page.locator('#player-tab').click();page.locator('#travel-note').fill('旋轉保存測試');page.locator('#save-travel').click();page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(500);measure('rotated-landscape')
  for width,height in [(390,844),(844,320),(844,390)]:
   page.set_viewport_size({'width':width,'height':height});page.wait_for_function('Math.abs(measuredEngine.getSettings().width*2-document.querySelector(".pf-frame").clientWidth)<2&&Math.abs(measuredEngine.getSettings().height-document.querySelector(".pf-frame").clientHeight)<2')
   page.wait_for_function('Math.abs(measuredEngine.getPage(measuredEngine.getCurrentPageIndex()).getElement().getBoundingClientRect().width-document.querySelector(".pf-frame").clientWidth/2)<2')
   assert page.evaluate('engineCount')==1;assert page.evaluate('measuredEngine.getCurrentPageIndex()')==9;expect(page.locator('#travel-note')).to_have_value('旋轉保存測試')
  page.screenshot(path='/workspace/work/diary-rotated.png');page.locator('[data-book="next"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert page.evaluate('measuredEngine.getCurrentPageIndex()')==11
  page.reload();page.wait_for_function('window.measuredEngine&&document.querySelectorAll(".stf__item").length===16');measure('landscape-fresh');page.close();browser.close()
finally:server.shutdown()
