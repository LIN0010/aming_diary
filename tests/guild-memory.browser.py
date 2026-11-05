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
def finish(page):
 while page.locator('.gl-memory-message').count()<6:page.locator('.gl-memory-continue-hint').click()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1280,800),(844,390),(812,300)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/group');page.wait_for_function('window.GuildStore');assert page.evaluate("GuildStore.join('20060119').ok")
   page.reload();page.wait_for_function('GuildStore.current()');open_panel(page,'puzzle')
   for pid,total in [('spring',12),('limited',20)]:
    page.locator(f'[data-puzzle="{pid}"]').click();expect(page.locator('[data-gl="reward"]')).to_have_count(0);expect(page.locator('.gl-memory-art')).to_have_count(0)
    assert not page.evaluate('(id)=>Boolean(GuildStore.current().puzzles[id].storyUnlocked)',pid)
    missing=page.evaluate('(id)=>{const p=GuildConfig.puzzles.find(p=>p.id===id);return Array.from({length:p.rows*p.cols},(_,i)=>i).filter(i=>!GuildStore.current().puzzles[id].owned.includes(i));}',pid)
    for n in missing:page.locator(f'[data-piece="{n}"]').click()
    expect(page.locator('.gl-memory-continue-hint')).to_be_visible();expect(page.locator('.gl-memory-message')).to_have_count(1)
    assert page.evaluate('(id)=>GuildStore.current().puzzles[id].storyUnlocked',pid)
    page.locator('.gl-memory-art').click();page.locator('.gl-memory-message').click();expect(page.locator('.gl-memory-message')).to_have_count(1)
    page.evaluate("window.firstBubble=document.querySelector('.gl-memory-message')")
    assert page.locator('.gl-memory-message').evaluate('(e)=>getComputedStyle(e).animationDuration')=='0.22s'
    assert page.locator('.gl-memory-chat-list').evaluate('(e)=>getComputedStyle(e).display')=='flex'
    before=page.locator('.gl-memory-art').bounding_box();chat_before=page.locator('.gl-memory-chat-viewport').bounding_box()
    for n in range(2,7):
     if n%2:page.locator('.gl-memory-interaction').focus();page.keyboard.press('Space' if n==3 else 'Enter')
     else:
      if mobile:page.locator('.gl-memory-continue-hint').tap()
      else:page.locator('.gl-memory-continue-hint').click()
     expect(page.locator('.gl-memory-message')).to_have_count(n)
     assert page.evaluate("window.firstBubble===document.querySelector('.gl-memory-message')")
    expected=page.evaluate('(id)=>GuildConfig.puzzles.find(p=>p.id===id).dialogue.map(l=>l.text)',pid)
    assert page.locator('.gl-memory-message p').all_text_contents()==expected
    expect(page.locator('.gl-memory-message--mother')).to_have_count(0 if pid=='spring' else 3)
    expect(page.locator('.gl-memory-message--aming')).to_have_count(6 if pid=='spring' else 3)
    expect(page.locator('.gl-memory-actions [role="status"]')).to_have_text('回憶已找回')
    assert page.locator('.gl-memory-art').bounding_box()==before
    assert page.locator('.gl-memory-chat-viewport').bounding_box()==chat_before
    page.wait_for_function('(()=>{const e=document.querySelector(".gl-memory-chat-viewport");return Math.abs(e.scrollHeight-e.clientHeight-e.scrollTop)<2})()')
    assert page.locator('#gl-dialog').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight&&e.scrollHeight<=e.clientHeight+1&&e.scrollWidth<=e.clientWidth+1}')
    assert page.locator('.gl-memory-message').evaluate_all('es=>es.every(e=>getComputedStyle(e).backgroundColor!=="rgba(0, 0, 0, 0)"&&e.getBoundingClientRect().width<=e.parentElement.clientWidth*.85)')
    align=page.locator('.gl-memory-message').evaluate_all('es=>es.map(e=>({name:e.className,align:getComputedStyle(e).alignSelf,color:getComputedStyle(e).backgroundColor}))')
    assert all(x['align']==('flex-end' if '--aming' in x['name'] else 'flex-start') for x in align),align
    # 手動拖曳後的 click 不可誤推進；wheel 後也保留閱讀位置。
    page.screenshot(path=f'/workspace/work/guild-story-{pid}-{w}.png')
    page.locator('[data-gl="replay-memory"]').click();expect(page.locator('.gl-memory-message')).to_have_count(1)
    expect(page.locator('.gl-memory-actions button')).to_have_count(0)
    r=page.locator('.gl-memory-chat-viewport').bounding_box();page.mouse.move(r['x']+3,r['y']+r['height']-4);page.mouse.down();page.mouse.move(r['x']+3,r['y']+20,steps=8);page.mouse.up();expect(page.locator('.gl-memory-message')).to_have_count(1)
    click_blank(page);expect(page.locator('.gl-memory-message')).to_have_count(2)
    for _ in range(4):page.locator('.gl-memory-continue-hint').click()
    expect(page.locator('.gl-memory-actions button')).to_have_count(2)
    page.locator('#gl-dialog [data-gl="puzzle"]').click();expect(page.locator('.gl-piece.is-owned')).to_have_count(total)
    page.locator('[data-gl="reward"]').click();expect(page.locator('.gl-memory-continue-hint')).to_be_visible();finish(page);page.locator('#gl-dialog [data-gl="puzzle"]').click()
   snapshot=page.evaluate('GuildStore.current()');page.reload();page.wait_for_function('GuildStore.current()');assert page.evaluate('GuildStore.current()')==snapshot
   open_panel(page,'puzzle')
   for pid in ['spring','limited']:
    page.locator(f'[data-puzzle="{pid}"]').click();page.locator('[data-gl="reward"]').click();expect(page.locator('.gl-memory-continue-hint')).to_be_visible();finish(page);page.locator('#gl-dialog [data-gl="puzzle"]').click()
   assert not errors,errors
   print('PASS fixed player / bubbles / blank & keyboard / internal scroll / replay / saved unlock',w,h,flush=True);context.close()
  # 模擬元件 CSS 載入失敗：應留在拼圖並提示，不可顯示未套樣式的 CG／文字。
  context=browser.new_context(viewport={'width':1280,'height':800});page=context.new_page();page.route('**/guild-memory.css*',lambda r:r.abort())
  page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/group');page.wait_for_function('window.GuildStore');page.evaluate("GuildStore.join('20060119')")
  page.evaluate("()=>{for(let n=0;n<12;n++)if(!GuildStore.current().puzzles.spring.owned.includes(n))GuildStore.exchange('spring',n)}")
  open_panel(page,'puzzle');page.locator('[data-gl="reward"]').click();expect(page.locator('#gl-notice')).to_contain_text('樣式無法載入');expect(page.locator('.gl-memory-player')).to_have_count(0);expect(page.locator('#gl-dialog')).to_have_attribute('data-panel','puzzle')
  print('PASS stylesheet failure keeps safe puzzle UI');context.close()
  browser.close()
finally:server.shutdown()
