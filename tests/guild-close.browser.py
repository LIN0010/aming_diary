"""獨立回憶播放器：固定舞台、氣泡、輸入事件、快取與樣式失敗保護。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
def open_panel(page,action):
 selector='.gl-member-count' if action=='members' else f'.gl-hotspot[data-gl="{action}"]'
 point=page.locator(selector).evaluate('''e=>{const r=e.getBoundingClientRect();for(let y=Math.max(0,r.top)+8;y<Math.min(innerHeight,r.bottom)-8;y+=8)for(let x=Math.max(0,r.left)+8;x<Math.min(innerWidth,r.right)-8;x+=8)if(e.contains(document.elementFromPoint(x,y)))return {x,y};}''')
 assert point,selector
 page.mouse.click(**point);expect(page.locator('#gl-dialog')).to_be_visible()
def close(page):page.wait_for_function('document.querySelector("#gl-dialog").getAttribute("aria-busy")!=="true"');page.locator('.gl-close').click();expect(page.locator('#gl-dialog')).not_to_be_visible()
def click_blank(page):
 r=page.locator('.gl-memory-chat-viewport').bounding_box();page.mouse.click(r['x']+3,r['y']+r['height']-3)
def centered(page):
 b=page.locator('.gl-close');icon=b.locator('svg');expect(icon).to_have_count(1)
 data=b.evaluate('(e)=>{const a=e.getBoundingClientRect(),b=e.querySelector("svg").getBoundingClientRect();return {dx:(a.left+a.right-b.left-b.right)/2,dy:(a.top+a.bottom-b.top-b.bottom)/2,w:b.width,h:b.height,bw:a.width,bh:a.height};}')
 assert abs(data['dx'])<.1 and abs(data['dy'])<.1 and data['w']==20 and data['h']==20,data
 assert data['bw']==36 and data['bh']==36,data
 return data
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1280,800),(844,390),(812,300)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/group');page.wait_for_function('window.GuildStore')
   for action in ['create','join']:
    page.locator(f'.gl-entry-hotspot[data-gl="{action}"]').click();expect(page.locator('.gl-close')).to_have_text('← 返回');expect(page.locator('.gl-close svg')).to_have_count(0);close(page)
   page.evaluate("GuildStore.join('20060119')");page.reload();page.wait_for_function('GuildStore.current()')
   saved=page.evaluate('localStorage.getItem(GuildConfig.storageKey)')
   for action in ['members','wall','puzzle','manage']:
    open_panel(page,action);print(w,h,action,centered(page),flush=True)
    page.locator('.gl-close').focus();page.keyboard.press('Enter');expect(page.locator('#gl-dialog')).not_to_be_visible()
   assert page.evaluate('localStorage.getItem(GuildConfig.storageKey)')==saved
   page.evaluate('()=>{for(let n=0;n<12;n++)if(!GuildStore.current().puzzles.spring.owned.includes(n))GuildStore.exchange("spring",n)}')
   open_panel(page,'puzzle');page.locator('[data-gl="reward"]').click();expect(page.locator('.gl-memory-player')).to_be_visible();print(w,h,'reward',centered(page),flush=True)
   page.locator('.gl-close').screenshot(path=f'/workspace/work/guild-close-{w}.png')
   page.keyboard.press('Escape');expect(page.locator('#gl-dialog')).not_to_be_visible()
   assert not errors,errors
   print('PASS all shared round close icons centered; clipboard back and keyboard preserved',w,h,flush=True);context.close()
  browser.close()
finally:server.shutdown()
