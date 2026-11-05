"""玩家新團／20060119 既有團的 UI、資料隔離與重入測試。"""
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
  for w,h in [(1280,900),(844,390)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}))
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/group')
   page.locator('[data-gl="create"]').click();page.locator('[name="name"]').fill('從零出發');page.locator('#gl-create-form button').click()
   expect(page.locator('#gl-dialog')).not_to_be_visible();expect(page.locator('.gl-member-count')).to_have_text('1/6 位旅人');expect(page.locator('.gl-avatars img')).to_have_count(1)
   expect(page.locator('.gl-avatars img')).to_have_attribute('src','images/guild-player-avatar.webp')
   own=page.evaluate('GuildStore.current()');open_panel(page,'puzzle');expect(page.locator('#gl-puzzle-progress')).to_have_text('0/12 片回憶');expect(page.locator('.gl-piece.is-owned')).to_have_count(0)
   page.locator('[data-puzzle="limited"]').click();expect(page.locator('#gl-puzzle-progress')).to_have_text('0/20 片回憶');expect(page.locator('.gl-piece.is-owned')).to_have_count(0);close(page)
   open_panel(page,'wall');expect(page.locator('.gl-post')).to_have_count(0);expect(page.locator('.gl-wall-empty')).to_contain_text('第一段回憶');close(page)
   open_panel(page,'manage');expect(page.locator('.gl-application-row')).to_have_count(2);expect(page.locator('#gl-invite-code')).to_have_text(own['code']);page.locator('[data-approve="true"]').first.click();expect(page.locator('.gl-application-row')).to_have_count(1);close(page)
   expect(page.locator('.gl-member-count')).to_have_text('2/6 位旅人')
   page.evaluate("GameProgress.completeRuisui();GameProgress.saveNote('ruisui','個人心得保留')")
   open_panel(page,'wall');page.locator('#gl-share-form textarea').fill('我們自己的第一篇');page.locator('#gl-share-form button').click();expect(page.locator('.gl-post')).to_have_count(1);close(page)
   open_panel(page,'puzzle');page.locator('[data-puzzle="spring"]').click();page.locator('[data-gl="draw"]').click();expect(page.locator('.gl-draw-result')).to_contain_text('獲得新的');expect(page.locator('.gl-piece.is-owned')).to_have_count(1);close(page)
   before=page.evaluate('GuildStore.current()');page.reload();expect(page.locator('.gl-member-count')).to_have_text('2/6 位旅人');assert page.evaluate('GuildStore.current()')==before
   open_panel(page,'manage');page.once('dialog',lambda d:d.accept());page.locator('[data-gl="leave"]').click();expect(page.locator('[data-gl="join"]')).to_be_visible()
   preserved=page.evaluate('(id)=>GuildStore.snapshot().guilds.find(g=>g.id===id)',own['id'])
   page.locator('[data-gl="join"]').click();page.locator('[data-join-mode="code"]').click();page.locator('[name="code"]').fill('20060119');page.locator('#gl-join-form button:not([type="button"])').click();expect(page.locator('#gl-dialog')).not_to_be_visible()
   expect(page.locator('.gl-member-count')).to_have_text('3/6 位旅人');open_panel(page,'members');expect(page.locator('.gl-member')).to_have_count(3);expect(page.locator('#gl-member-you .gl-label')).to_have_count(0);expect(page.locator('#gl-member-demo-light .gl-label')).to_have_text('團長');close(page)
   open_panel(page,'wall');expect(page.locator('.gl-post')).to_have_count(2);expect(page.locator('.gl-post-photo')).to_have_count(2)
   assert page.locator('.gl-post-photo').evaluate_all('async es=>{await Promise.all(es.map(e=>e.decode()));return es.every(e=>e.naturalWidth>0)}');close(page)
   open_panel(page,'manage');expect(page.locator('#gl-invite-code')).to_have_text('20060119');expect(page.locator('[data-gl="test-application"]')).to_have_count(0);expect(page.locator('.gl-applications')).to_have_count(0);close(page)
   open_panel(page,'puzzle')
   for pid,count in [('spring',7),('limited',10)]:
    page.locator(f'[data-puzzle="{pid}"]').click();expect(page.locator('.gl-piece.is-owned')).to_have_count(count);assert 'puzzle-' in page.locator('.gl-piece.is-owned').first.get_attribute('style')
   page.locator('[data-piece="10"]').click();expect(page.locator('.gl-piece.is-owned')).to_have_count(11);close(page)
   updated=page.evaluate('GuildStore.current()')
   page.evaluate("location.hash='#/home'");expect(page.locator('#home-screen')).to_be_visible(timeout=20000);page.evaluate("location.hash='#/group'");expect(page.locator('.gl-member-count')).to_have_text('3/6 位旅人',timeout=20000)
   page.reload();expect(page.locator('.gl-member-count')).to_have_text('3/6 位旅人');assert page.evaluate('GuildStore.current()')==updated
   assert page.evaluate('(id)=>GuildStore.snapshot().guilds.find(g=>g.id===id)',own['id'])==preserved
   assert page.evaluate("GameProgress.snapshot().notes.ruisui")=='個人心得保留'
   page.screenshot(path=f'/workspace/work/guild-init-invited-{w}.png')
   assert not errors,errors
   print('PASS create zero / approve / share & draw / invited three / progress isolation / reload',w,h,flush=True);context.close()
  browser.close()
finally:server.shutdown()
