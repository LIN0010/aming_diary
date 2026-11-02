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
  for width in [1280,390]:
   page=b.new_page(viewport={'width':width,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{s.server_port}/game.html#/home');expect(page.locator('#home-screen')).to_be_visible(timeout=60000)
   expect(page.locator('.travel-transition')).not_to_be_visible()
   page.locator('[data-destination="home"]').click();expect(page.locator('.travel-transition')).not_to_be_visible()
   for name in ['explore','diary','event','group','home']:
    started=time.monotonic();page.locator(f'[data-destination="{name}"]').click();expect(page.locator('.travel-transition')).to_be_visible()
    box=page.locator('.travel-transition').bounding_box();assert box['x']==0 and box['y']==0 and box['width']==width and box['height']>=844
    if name=='explore':
     page.wait_for_timeout(600);page.screenshot(path=f'/workspace/work/travel-{width}.png')
    # 過場中模擬第二次導覽事件，不得把路由改到另一頁。
    page.locator('[data-destination="home"]').dispatch_event('click')
    page.wait_for_function('!TravelTransition.active',timeout=30000);assert time.monotonic()-started>=1.85;assert page.evaluate('GameNavigation.route(location.href).name')==name
   page.go_back();expect(page.locator('.travel-transition')).to_be_visible();page.wait_for_function('!TravelTransition.active');assert page.url.endswith('#/group')
   page.go_forward();page.wait_for_function('!TravelTransition.active');expect(page.locator('#home-screen')).to_be_visible()
   page.route('**/diary.html',lambda route:route.abort())
   page.locator('[data-destination="diary"]').click();page.wait_for_function('!TravelTransition.active');expect(page.locator('#scene-retry')).to_be_visible();page.locator('#scene-cancel').click();expect(page.locator('#home-screen')).to_be_visible()
   page.unroute('**/diary.html');page.locator('[data-destination="diary"]').click();page.wait_for_function('!TravelTransition.active');expect(page.locator('#diary-screen')).to_be_visible()
   page.locator('[data-destination="event"]').click();expect(page.locator('.travel-transition')).to_be_visible();page.go_back();page.wait_for_function('!TravelTransition.active&&!document.querySelector("#scene-host").inert');page.wait_for_timeout(100);assert page.evaluate('GameNavigation.route(location.href).name')=='home'
   assert not errors,errors
   print('PASS travel',width,flush=True);page.close()
  b.close()
finally:s.shutdown()
