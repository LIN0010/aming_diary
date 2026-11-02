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
   page=browser.new_page(viewport={'width':width,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/diary.html');page.wait_for_function('document.querySelectorAll(".stf__item").length===16')
   assert page.locator('.db-cover-hinge,.db-leaf').count()==0
   expect(page.locator('.pf-hard').first).to_be_visible();page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');expect(page.locator('#ruisui-journal')).to_be_visible()
   page.screenshot(path=f'/workspace/work/pageflip-toc-{width}.png');page.locator('#ruisui-journal').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');expect(page.locator('#station-diary')).to_be_visible()
   expect(page.locator('#aming-journal .journal-page')).not_to_be_visible();page.locator('#player-tab').click();page.locator('#travel-note').fill('StPageFlip心得測試');page.locator('#save-travel').click();assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='StPageFlip心得測試'
   page.locator('#player-photo-input').set_input_files({'name':'photo.svg','mimeType':'image/svg+xml','buffer':b'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'});expect(page.locator('.player-photo')).to_have_class(__import__('re').compile('has-photo'))
   page.evaluate('GameProgress.completeRuisui()');page.locator('#aming-tab').click();expect(page.locator('#aming-journal .journal-page')).to_be_visible();page.locator('#memory-count').click();expect(page.locator('#memory-drawer')).to_have_class(__import__('re').compile('show'));page.locator('#close-memory').click();page.wait_for_timeout(450)
   page.screenshot(path=f'/workspace/work/pageflip-content-{width}.png');page.locator('[data-book="next"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');expect(page.locator('#station-diary')).not_to_be_visible();page.locator('[data-book="previous"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');page.locator('#player-tab').click();expect(page.locator('#travel-note')).to_have_value('StPageFlip心得測試')
   page.locator('[data-book="index"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');expect(page.locator('#ruisui-journal')).to_be_visible();page.locator('[data-book="close"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');expect(page.locator('.pf-hard').first).to_be_visible()
   page.goto(f'http://127.0.0.1:{server.server_port}/diary.html?station=ruisui&tab=player');page.wait_for_function('document.querySelectorAll(".stf__item").length===16');expect(page.locator('#station-diary')).to_be_visible();page.locator('#player-tab').click();expect(page.locator('#travel-note')).to_have_value('StPageFlip心得測試')
   assert not errors,errors
   page.close();print('PASS HTML diary integration',width,flush=True)
  browser.close()
finally:server.shutdown()
