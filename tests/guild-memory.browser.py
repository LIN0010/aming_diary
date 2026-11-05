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
  for w,h in [(1280,800),(844,390),(812,300)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/group');page.wait_for_function('window.GuildStore');assert page.evaluate("GuildStore.join('20060119').ok")
   page.reload();page.wait_for_function('GuildStore.current()');open_panel(page,'puzzle')
   for pid,total in [('spring',12),('limited',20)]:
    page.locator(f'[data-puzzle="{pid}"]').click();expect(page.locator('[data-gl="reward"]')).to_have_count(0);expect(page.locator('.gl-memory-cg')).to_have_count(0)
    assert not page.evaluate('(id)=>Boolean(GuildStore.current().puzzles[id].storyUnlocked)',pid)
    missing=page.evaluate('(id)=>{const p=GuildConfig.puzzles.find(p=>p.id===id);return Array.from({length:p.rows*p.cols},(_,i)=>i).filter(i=>!GuildStore.current().puzzles[id].owned.includes(i));}',pid)
    for n in missing:page.locator(f'[data-piece="{n}"]').click()
    expect(page.locator('[data-gl="watch-memory"]')).to_be_visible();expect(page.locator('.gl-memory-bubble')).to_have_count(0)
    assert page.evaluate('(id)=>GuildStore.current().puzzles[id].storyUnlocked',pid)
    page.locator('[data-gl="watch-memory"]').click();expect(page.locator('.gl-memory-bubble')).to_have_count(1)
    page.evaluate("window.firstBubble=document.querySelector('.gl-memory-bubble')")
    before=page.locator('.gl-memory-cg').bounding_box()
    for n in range(2,7):
     page.locator('[data-gl="next-memory"]').click();expect(page.locator('.gl-memory-bubble')).to_have_count(n)
     assert page.evaluate("window.firstBubble===document.querySelector('.gl-memory-bubble')")
    expected=page.evaluate('(id)=>GuildConfig.puzzles.find(p=>p.id===id).dialogue.map(l=>l.text)',pid)
    assert page.locator('.gl-memory-bubble p').all_text_contents()==expected
    expect(page.locator('.is-mother')).to_have_count(0 if pid=='spring' else 3)
    expect(page.locator('.is-aming')).to_have_count(6 if pid=='spring' else 3)
    expect(page.locator('.gl-memory-controls [role="status"]')).to_have_text('回憶已找回')
    assert page.locator('.gl-memory-cg').bounding_box()==before
    assert page.locator('.gl-memory-messages').evaluate('(e)=>Math.abs(e.scrollHeight-e.clientHeight-e.scrollTop)<2')
    assert page.locator('#gl-dialog').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight&&e.scrollHeight<=e.clientHeight+1}')
    page.screenshot(path=f'/workspace/work/guild-story-{pid}-{w}.png')
    page.locator('[data-gl="replay-memory"]').click();expect(page.locator('.gl-memory-bubble')).to_have_count(1)
    page.locator('[data-gl="skip-memory"]').click();page.locator('[data-gl="next-memory"]').click();assert page.locator('.gl-memory-bubble').last.evaluate('(e)=>getComputedStyle(e).animationName')=='none'
    page.locator('[data-gl="all-memory"]').click();expect(page.locator('.gl-memory-bubble')).to_have_count(6)
    page.locator('#gl-dialog [data-gl="puzzle"]').click();expect(page.locator('.gl-piece.is-owned')).to_have_count(total)
    page.locator('[data-gl="reward"]').click();expect(page.locator('[data-gl="watch-memory"]')).to_be_visible();page.locator('#gl-dialog [data-gl="puzzle"]').click()
   snapshot=page.evaluate('GuildStore.current()');page.reload();page.wait_for_function('GuildStore.current()');assert page.evaluate('GuildStore.current()')==snapshot
   open_panel(page,'puzzle')
   for pid in ['spring','limited']:
    page.locator(f'[data-puzzle="{pid}"]').click();page.locator('[data-gl="reward"]').click();expect(page.locator('[data-gl="watch-memory"]')).to_be_visible();page.locator('#gl-dialog [data-gl="puzzle"]').click()
   assert not errors,errors
   print('PASS chapter dialogue, CG bounds, scrolling, replay/skip, gated unlock persistence',w,h,flush=True);context.close()
  browser.close()
finally:server.shutdown()
