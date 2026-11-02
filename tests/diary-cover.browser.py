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
  for width in [1280,390]:
   page=browser.new_page(viewport={'width':width,'height':844});page.goto(f'http://127.0.0.1:{server.server_port}/diary.html');page.locator('.db-cover').click()
   for angle in [0,45,90,135,180]:
    page.locator('.db-cover-hinge').evaluate('(e,angle)=>{const a=e.getAnimations()[0];a.pause();a.effect.updateTiming({easing:"linear"});a.currentTime=angle/180*700;}',angle)
    assert page.locator('.diary-book').get_attribute('aria-busy')=='true'
    expect(page.locator('.db-leaf')).to_have_count(0)
    assert page.locator('.db-cover').evaluate('(e)=>getComputedStyle(e).backfaceVisibility')=='hidden'
    assert page.locator('.db-cover-back').evaluate('(e)=>getComputedStyle(e).backfaceVisibility')=='hidden'
    assert page.locator('.diary-book').evaluate('(e)=>getComputedStyle(e).filter')=='none'
    assert page.locator('.db-cover-hinge').evaluate('(e)=>getComputedStyle(e).transformStyle')=='preserve-3d'
    page.screenshot(path=f'/workspace/work/cover-{width}-{angle}.png')
   page.locator('.db-cover-hinge').evaluate('(e)=>e.getAnimations()[0].finish()');page.wait_for_function('!document.querySelector(".diary-book").hasAttribute("aria-busy")')
   expect(page.locator('#diary-index')).to_be_visible();page.locator('[data-book="close"]').click();page.wait_for_function('!document.querySelector(".diary-book").hasAttribute("aria-busy")');expect(page.locator('.db-cover')).to_be_visible()
   page.close();print('PASS five angles and reverse',width)
  browser.close()
finally:server.shutdown()
