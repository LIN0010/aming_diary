from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1280,900),(1280,720),(1024,600),(844,390),(812,300),(667,375)]:
   ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<1000,has_touch=w<1000,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if w<1000 else {}));page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/group');page.wait_for_function('window.GuildStore')
   assert page.evaluate("GuildStore.join('20060119').ok")
   page.reload();page.wait_for_function('GuildStore.current()')
   page.locator('.gl-hotspot[data-gl="puzzle"]').click()
   for pid in ['spring','limited']:
    page.locator(f'[data-puzzle="{pid}"]').click()
    owned=page.evaluate('(id)=>GuildStore.current().puzzles[id].owned',pid)
    assert owned==page.evaluate('(id)=>GuildConfig.invitedGuild.pieces[id]',pid)
    expect(page.locator('.gl-piece.is-owned')).to_have_count(len(owned))
    dims=page.locator('#gl-dialog').evaluate('(e)=>{const r=e.getBoundingClientRect(),b=e.querySelector(".gl-puzzle-board").getBoundingClientRect(),n=e.querySelector(".gl-puzzle-notes");return {x:r.x,y:r.y,w:r.width,h:r.height,bx:b.x,by:b.y,bw:b.width,bh:b.height,notes:[n.scrollHeight,n.clientHeight],outer:[e.scrollHeight,e.clientHeight]}}')
    assert dims['y']>=0 and dims['y']+dims['h']<=h+1,dims
    assert dims['by']>=dims['y'] and dims['by']+dims['bh']<=dims['y']+dims['h'],dims
    print(w,h,pid,dims,flush=True)
    if w>=1000:
     size=page.locator('#gl-dialog').evaluate('(e)=>[e.scrollHeight,e.clientHeight]');assert size[0]<=size[1]+1,(w,h,pid,size)
    page.screenshot(path=f'/workspace/work/puzzle-compact-{pid}-{w}-{h}.png')
   saved=page.evaluate('GuildStore.current().puzzles');page.reload();page.wait_for_function('GuildStore.current()');assert page.evaluate('GuildStore.current().puzzles')==saved
   assert not errors,errors
   print('PASS scattered pieces, count, reload, desktop fit',w,h,flush=True)
   ctx.close()
  browser.close()
finally:server.shutdown()
