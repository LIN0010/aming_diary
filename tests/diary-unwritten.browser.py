"""目錄與雙頁共用記憶解鎖，探索開放不代表取得記憶。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
def ready(page):page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")')
def locked(page):
 entry=page.locator('#ruisui-journal');expect(entry).to_be_enabled();assert entry.evaluate('(e)=>e.classList.contains("memory-pending")&&!e.classList.contains("unlocked")&&!e.classList.contains("new")');expect(entry.locator('.journal-new')).to_be_hidden();assert entry.locator('strong').evaluate('(e)=>getComputedStyle(e).color')=='rgb(162, 149, 135)'
 expect(page.locator('.pf-photo-column')).to_be_hidden();expect(page.locator('.pf-text-column')).to_be_hidden()
 pages=page.locator('.pf-page.--simple:visible');expect(pages.locator('.pf-undiscovered-lock')).to_have_count(2)
 for item in pages.all():
  assert item.inner_text().strip()==''
  assert item.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(245, 236, 219)'
  g=item.evaluate('(e)=>{const r=e.getBoundingClientRect(),l=e.querySelector("svg").getBoundingClientRect();return [Math.abs(r.x+r.width/2-l.x-l.width/2),Math.abs(r.y+r.height/2-l.y-l.height/2)]}')
  assert max(g)<1,g
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1280,844),(844,390),(812,300)]:
   context=browser.new_context(viewport={'width':w,'height':h},has_touch=w<1000,is_mobile=w<1000);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(BASE+'game.html#/diary',wait_until='domcontentloaded');page.wait_for_function('document.querySelectorAll(".stf__item").length===16');page.evaluate('GameProgress.visitRuisui();GameProgress.saveNote("ruisui","原有心得不可清除")');page.locator('.pf-hard').first.click();ready(page);expect(page.locator('#ruisui-journal')).to_be_enabled();expect(page.locator('#ruisui-journal .journal-new')).to_be_hidden();page.locator('#ruisui-journal').click();ready(page);locked(page);page.screenshot(path=f'/workspace/work/memory-locked-{w}.png')
   page.reload(wait_until='domcontentloaded');page.wait_for_function('document.querySelector(".pf-station")&&!document.querySelector(".pf-book").hasAttribute("aria-busy")');locked(page);assert page.evaluate('GameProgress.snapshot().collectedMemories')==[]
   page.evaluate('GameProgress.completeRuisui()');expect(page.locator('.pf-photo-column')).to_be_visible();expect(page.locator('.pf-text-column')).to_be_visible();assert page.locator('#ruisui-journal').evaluate('(e)=>e.classList.contains("unlocked")&&!e.classList.contains("memory-pending")');assert not page.locator('#ruisui-journal .journal-new').evaluate('(e)=>e.hidden');expect(page.locator('#travel-note')).to_have_value('原有心得不可清除');assert page.locator('.pf-page.--simple:visible .pf-undiscovered-page:visible').count()==0
   expect(page.locator('.photo-card img')).to_be_visible();expect(page.locator('.memory-fragment-image')).to_be_visible();expect(page.locator('.diary-entry')).to_contain_text('我好像來過這裡。');page.screenshot(path=f'/workspace/work/memory-unlocked-{w}.png')
   page.locator('.pf-index-tab').click();ready(page);expect(page.locator('#ruisui-journal .journal-new')).to_be_visible();page.locator('#ruisui-journal').click();ready(page);page.reload(wait_until='domcontentloaded');page.wait_for_function('document.querySelector(".pf-station")&&!document.querySelector(".pf-book").hasAttribute("aria-busy")');expect(page.locator('.pf-photo-column')).to_be_visible();expect(page.locator('#travel-note')).to_have_value('原有心得不可清除');assert page.evaluate('GameProgress.snapshot().collectedMemories')==['ruisui-01'];assert not errors,errors;context.close();print('PASS memory unlock sync',w,h,flush=True)
  browser.close()
finally:server.shutdown()
