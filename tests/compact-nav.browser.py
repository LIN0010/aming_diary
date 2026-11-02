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
  context=browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')
  page=context.new_page();page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/home');expect(page.locator('#home-screen')).to_be_visible(timeout=60000)
  toggle=page.locator('.nav-toggle');expect(toggle).to_be_visible();expect(toggle).to_have_attribute('aria-expanded','false');expect(toggle).to_contain_text('首頁');assert page.locator('.nav-options').evaluate('(e)=>e.inert')
  for name,label in [('explore','探索'),('diary','日記'),('event','活動'),('group','旅團'),('home','首頁')]:
   toggle.click();expect(toggle).to_have_attribute('aria-expanded','true');link=page.locator(f'[data-destination="{name}"]');expect(link).to_be_visible();link.click();page.wait_for_function('!TravelTransition.active');expect(toggle).to_have_attribute('aria-expanded','false');expect(toggle).to_contain_text(label);assert page.evaluate('GameNavigation.route(location.href).name')==name
  toggle.click();page.set_viewport_size({'width':844,'height':360});expect(toggle).to_have_attribute('aria-expanded','true');page.set_viewport_size({'width':844,'height':390});expect(toggle).to_have_attribute('aria-expanded','true');toggle.click()
  toggle.focus();page.keyboard.press('ArrowDown');expect(toggle).to_have_attribute('aria-expanded','true');expect(page.locator('[data-destination="home"]')).to_be_focused();page.keyboard.press('End');assert page.evaluate('document.activeElement.dataset.destination')=='group';page.keyboard.press('Escape');expect(toggle).to_have_attribute('aria-expanded','false');expect(toggle).to_be_focused()
  toggle.click();page.locator('#home-screen').click(position={'x':10,'y':10});expect(toggle).to_have_attribute('aria-expanded','false')
  r=toggle.bounding_box();assert r['height']>=44 and r['y']+r['height']<=390
  page.screenshot(path='/workspace/work/compact-nav.png');toggle.click();page.locator('.bottom-nav').evaluate('(e)=>Promise.all([...e.getAnimations(),...e.querySelector(".nav-options").getAnimations()].map(a=>a.finished.catch(()=>{})))');page.screenshot(path='/workspace/work/expanded-nav.png');page.locator('[data-destination="diary"]').click();page.wait_for_function('!TravelTransition.active');page.locator('.pf-mode-switch input').check();page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert page.locator('.bottom-nav').evaluate('(e)=>e.inert&&getComputedStyle(e).opacity==="0"');page.locator('[data-book="close"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert not page.locator('.bottom-nav').evaluate('(e)=>e.inert');expect(toggle).to_be_visible();context.close()
  for width in [1280,390]:
   page=browser.new_page(viewport={'width':width,'height':844});page.goto(f'http://127.0.0.1:{server.server_port}/home.html');expect(page.locator('.nav-toggle')).not_to_be_visible();expect(page.locator('.nav-options a')).to_have_count(5);assert page.locator('.bottom-nav').evaluate('(e)=>getComputedStyle(e).display')=='grid';page.close()
  print('PASS compact SPA routes, disclosure, keyboard, outside click, reading mode and desktop')
  browser.close()
finally:server.shutdown()
