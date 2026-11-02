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
   page=browser.new_page(viewport={'width':width,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/diary.html')
   expect(page.locator('.db-cover')).to_be_visible();book_width=page.locator('.diary-book').evaluate('(e)=>e.offsetWidth');font=page.locator('.db-cover').evaluate('(e)=>getComputedStyle(e).fontSize');page.locator('.db-cover').click();page.locator('.db-cover-hinge').evaluate('(e)=>{const a=e.getAnimations()[0];a.pause();a.currentTime=175;}');assert page.locator('.diary-book').evaluate('(e)=>e.offsetWidth')==book_width;assert page.locator('.db-cover').evaluate('(e)=>getComputedStyle(e).fontSize')==font;expect(page.locator('.db-leaf')).to_have_count(0);assert page.locator('.db-cover-hinge').evaluate('(e)=>getComputedStyle(e).transformOrigin').startswith('0px');page.screenshot(path=f'/workspace/work/cover-opening-{width}.png');page.locator('.db-cover-hinge').evaluate('(e)=>e.getAnimations()[0].finish()');page.wait_for_function('!document.querySelector(".diary-book").hasAttribute("aria-busy")');expect(page.locator('#diary-index')).to_be_visible()
   assert page.locator('#diary-index .station-journal[disabled]').count()==5
   page.locator('#ruisui-journal').click();expect(page.locator('.db-leaf')).to_be_visible();page.wait_for_function('!document.querySelector(".diary-book").hasAttribute("aria-busy")');expect(page.locator('#station-diary')).to_be_visible()
   expect(page.locator('#aming-journal .journal-page').first).not_to_be_visible();page.locator('#player-tab').click();page.locator('#travel-note').fill('翻頁書本測試');page.locator('#save-travel').click();assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='翻頁書本測試'
   page.locator('[data-book="next"]').click();page.wait_for_function('!document.querySelector(".diary-book").hasAttribute("aria-busy")');expect(page.locator('.db-locked')).to_be_visible();expect(page.locator('#station-diary')).not_to_be_visible()
   page.locator('[data-book="previous"]').click();page.wait_for_function('!document.querySelector(".diary-book").hasAttribute("aria-busy")');expect(page.locator('#travel-note')).to_have_value('翻頁書本測試')
   page.screenshot(path=f'/workspace/work/book-{width}.png');page.locator('[data-book="index"]').click();page.wait_for_function('!document.querySelector(".diary-book").hasAttribute("aria-busy")');expect(page.locator('#diary-index')).to_be_visible()
   page.locator('[data-book="close"]').click();page.wait_for_function('!document.querySelector(".diary-book").hasAttribute("aria-busy")');expect(page.locator('.db-cover')).to_be_visible();assert not errors,errors
   page.close();print('PASS book',width)
  browser.close()
finally:server.shutdown()
