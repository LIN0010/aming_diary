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
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1280,800),(844,390)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/group');page.wait_for_function('window.GuildStore');page.evaluate("GuildStore.join('20060119')")
   page.reload();page.wait_for_function('GuildStore.current()');before=page.evaluate('localStorage.getItem(GuildConfig.storageKey)')
   expected={post['id']:post for post in page.evaluate('GuildConfig.travelWall.posts')}
   orders=[]
   for rng in [0,.99]:
    page.evaluate('(value)=>{window.originalRandom??=Math.random;Math.random=()=>value}',rng);open_panel(page,'wall');expect(page.locator('.gl-post')).to_have_count(4)
    order=page.locator('.gl-post').evaluate_all('es=>es.map(e=>e.dataset.postId)');assert len(set(order))==4;orders.append(order)
    for card in page.locator('.gl-post').all():
     card.scroll_into_view_if_needed();fixed=expected[card.get_attribute('data-post-id')];expect(card.locator('h3')).to_have_text(fixed['title']);expect(card.locator('p')).to_have_text(fixed['content']);expect(card.locator('.gl-post-photo')).to_have_attribute('src',fixed['image'])
     assert card.locator('.gl-post-photo').evaluate('async e=>{await e.decode();return e.naturalWidth>0&&getComputedStyle(e).objectFit==="contain"}')
     author=page.evaluate('(id)=>GuildConfig.members.find(m=>m.id===id).name',fixed['author']);expect(card.locator('header')).to_contain_text(author)
    page.screenshot(path=f'/workspace/work/travel-wall-{w}-{rng}.png');close(page)
   assert orders[0]!=orders[1];assert page.evaluate('localStorage.getItem(GuildConfig.storageKey)')==before
   page.evaluate('Math.random=originalRandom');page.reload();page.wait_for_function('GuildStore.current()');open_panel(page,'wall');expect(page.locator('.gl-post')).to_have_count(4);assert len(set(page.locator('.gl-post').evaluate_all('es=>es.map(e=>e.dataset.postId)')))==4
   assert not errors,errors
   print('PASS four PNGs, matching titles/authors/content, shuffled unique cards, save unchanged',w,h,flush=True);context.close()
  browser.close()
finally:server.shutdown()
