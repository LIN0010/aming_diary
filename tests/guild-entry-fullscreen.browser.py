"""旅團入口滿版與五個 SPA 場景外層尺寸；手機為 Chromium 觸控模擬。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil,os
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
def rect(page,selector):return page.locator(selector).bounding_box()
def validate_entry(page,w,h):
 image=rect(page,'.gl-room-bg');root=rect(page,'#group-screen');print('entry',w,h,'root',root,'background',image,flush=True)
 if os.getenv('BASELINE'):return
 assert image['x']<=0 and image['y']<=0 and image['x']+image['width']>=w-1 and image['y']+image['height']>=h-1,image
 assert page.locator('#group-screen').evaluate('(e)=>getComputedStyle(e,"::before").content')=='none' or w>=1000
 assert page.locator('.gl-room').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
 for t in page.evaluate('GuildConfig.entrance.hotspots'):
  item=page.locator(f'.gl-entry-hotspot[data-gl="{t["id"]}"]');r=item.bounding_box()
  assert abs(r['x']-(image['x']+t['x']*image['width']))<1 and abs(r['y']-(image['y']+t['y']*image['height']))<1
  assert r['x']>=0 and r['x']+r['width']<=w and r['height']>=44
  assert item.evaluate('(e)=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(852,393),(932,430),(1440,900)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/group');expect(page.locator('.gl-entry-hotspot')).to_have_count(2);validate_entry(page,w,h)
   if os.getenv('BASELINE'):context.close();continue
   page.screenshot(path=f'/workspace/work/guild-full-entry-{w}.png')
   for action in ['create','join']:
    target=page.locator(f'.gl-entry-hotspot[data-gl="{action}"]');target.tap() if mobile else target.click();expect(page.locator('#gl-dialog')).to_be_visible();page.locator('.gl-close').click();expect(page.locator('#gl-dialog')).not_to_be_visible()
   for scene in ['home','explore','diary','event','group']:
    if mobile:page.locator('.nav-toggle').tap()
    link=page.locator(f'[data-destination="{scene}"]');link.tap() if mobile else link.click();expect(page.locator(f'#{scene}-screen')).to_be_visible(timeout=20000);page.wait_for_function('!TravelTransition.active')
    r=rect(page,f'#{scene}-screen');assert abs(r['width']-w)<1 and abs(r['height']-h)<1,(scene,r,w,h)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   if mobile:
    page.set_viewport_size({'width':w,'height':h-50});page.wait_for_function('(h)=>document.querySelector("#group-screen").clientHeight===h',arg=h-50);validate_entry(page,w,h-50)
    page.set_viewport_size({'width':w,'height':h});page.wait_for_function('(h)=>document.querySelector("#group-screen").clientHeight===h',arg=h);validate_entry(page,w,h)
   assert not errors,errors
   print('PASS fullscreen entry / aligned hotspots / five scenes / viewport resize',w,h,flush=True);context.close()
  browser.close()
finally:server.shutdown()
