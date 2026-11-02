"""入口預載交接：即使SPA啟動script延遲，也已顯示原始主頁而非空容器。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil
class Q(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=ThreadingHTTPServer(('127.0.0.1',0),partial(Q,directory=str(Path(__file__).resolve().parents[1]/'aming-game')));Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox']);page=b.new_page();held=[];count=[0]
  def app(route):
   count[0]+=1
   if count[0]>1:held.append(route)
   else:route.continue_()
  page.route('**/js/app.js',app);page.goto(f'http://127.0.0.1:{s.server_port}/index.html');page.locator('#start-btn').click();page.wait_for_url('**/game.html#/home',wait_until='commit',timeout=60000)
  expect(page.locator('#home-screen')).to_be_visible(timeout=15000);assert page.evaluate('!!JourneyEntryPreview');assert page.locator('#home-screen').evaluate('(e)=>getComputedStyle(e).opacity')=='1'
  expect(page.locator('.travel-transition')).not_to_be_visible();assert page.evaluate('!TravelTransition.active');assert held
  # 首次顯示時已具備背景，而啟動程式仍被刻意攔住。
  assert 'images/home-bg.jpg' in page.locator('.home-background').evaluate('(e)=>getComputedStyle(e).backgroundImage')
  for route in list(held):route.continue_()
  page.unroute('**/js/app.js')
  page.wait_for_function('!document.querySelector("#scene-host").hasAttribute("aria-busy")');assert page.evaluate('!TravelTransition.active');expect(page.locator('#home-screen')).to_be_visible()
  assert page.evaluate('JourneyEntryPreview') is None
  page.reload();expect(page.locator('#home-screen')).to_be_visible();page.wait_for_function('!document.querySelector("#scene-host").hasAttribute("aria-busy")');assert page.evaluate('!TravelTransition.active')
  page.locator('[data-destination="explore"]').click();expect(page.locator('.travel-transition')).to_be_visible();page.wait_for_function('!TravelTransition.active');expect(page.locator('#explore-screen')).to_be_visible()
  print('PASS: slow app bootstrap still shows original home; initial/reload no travel wait; bottom navigation still animates')
  b.close()
finally:s.shutdown()
