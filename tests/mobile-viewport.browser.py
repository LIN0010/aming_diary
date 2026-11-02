"""全畫面換場、最低時間、連點、歷史、錯誤復原與首屏載入。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil,time
class Q(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=ThreadingHTTPServer(('127.0.0.1',0),partial(Q,directory=str(Path(__file__).resolve().parents[1]/'aming-game')));Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for standalone in [False,True]:
   context=b.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')
   context.add_init_script('Object.defineProperty(navigator,"standalone",{value:'+str(standalone).lower()+'})');page=context.new_page();page.goto(f'http://127.0.0.1:{s.server_port}/game.html#/home');expect(page.locator('#home-screen')).to_be_visible(timeout=60000)
   for name in ['explore','diary','event','group','home']:
    link=page.locator(f'[data-destination="{name}"]');r=link.bounding_box();assert r['y']>=0 and r['y']+r['height']<=390
    assert link.evaluate('(e)=>e.contains(document.elementFromPoint(e.getBoundingClientRect().x+e.offsetWidth/2,e.getBoundingClientRect().y+e.offsetHeight/2))')
    link.click();page.wait_for_function('!TravelTransition.active');assert page.evaluate('GameNavigation.route(location.href).name')==name
    assert abs(page.locator('#scene-host').bounding_box()['height']-page.evaluate('visualViewport.height'))<2
   page.set_viewport_size({'width':390,'height':844});expect(page.locator('.orientation-prompt')).to_be_visible();assert page.locator('.orientation-prompt').evaluate('(e)=>e.open');page.screenshot(path=f'/workspace/work/portrait-{standalone}.png')
   page.set_viewport_size({'width':844,'height':390});expect(page.locator('.orientation-prompt')).not_to_be_visible();page.locator('[data-destination="explore"]').click();page.wait_for_function('!TravelTransition.active');context.close();print('PASS mobile emulation standalone=',standalone,flush=True)
  page=b.new_page(viewport={'width':390,'height':844});page.goto(f'http://127.0.0.1:{s.server_port}/index.html');expect(page.locator('.orientation-prompt')).not_to_be_visible();page.close()
  b.close()
finally:s.shutdown()
