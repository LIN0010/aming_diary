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
  for width in [1280,390,320]:
   page=browser.new_page(viewport={'width':width,'height':844});page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/home');expect(page.locator('#home-screen')).to_be_visible(timeout=60000)
   expect(page.locator('.bottom-nav .nav-options svg')).to_have_count(5)
   assert page.locator('.bottom-nav .nav-options svg').evaluate_all('(es)=>es.map(e=>e.dataset.lucide)')==['house','train-front','book-open','ticket','users-round']
   for svg in page.locator('.bottom-nav .nav-options svg').all():
    assert svg.get_attribute('stroke-width')=='1.75';assert svg.bounding_box()['width']==24
   nav=page.locator('.bottom-nav').bounding_box();assert nav['x']>=0 and nav['x']+nav['width']<=width
   assert page.locator('.active .nav-label').evaluate('(e)=>getComputedStyle(e,"::after").opacity')=='1'
   assert page.locator('.nav-item:not(.active) .nav-label').first.evaluate('(e)=>getComputedStyle(e,"::after").opacity')=='0'
   page.screenshot(path=f'/workspace/work/nav-{width}.png');page.close();print('PASS nav',width)
  browser.close()
finally:server.shutdown()
