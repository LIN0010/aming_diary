"""瑞穗照片／文字分頁：原節點、鎖定、照片比例、獨立捲動、心得保存。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
import shutil,re
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
def ready(page):page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")')
def picture(page,selector):
 page.wait_for_function('(s)=>{const e=document.querySelector(s);return e.complete&&e.naturalWidth>0}',arg=selector)
 assert page.locator(selector).evaluate('(e)=>e.width>0&&e.height>0&&getComputedStyle(e).objectFit==="contain"')
def scroll(page,selector,mobile):
 el=page.locator(selector);el.evaluate('(e)=>e.scrollTop=0');r=el.bounding_box();x=r['x']+r['width']*.5;y=r['y']+r['height']*.7
 if mobile:
  c=page.context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  for k in range(1,10):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-r['height']*.55*k/9}]})
  c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
 else:page.mouse.move(x,y);page.mouse.wheel(0,450)
 page.wait_for_timeout(250)
 assert el.evaluate('(e)=>e.scrollHeight<=e.clientHeight+1||e.scrollTop>0'),selector
 assert page.evaluate('testBook.getCurrentPageIndex()')==9
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox']);bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text()
  for width,height in [(1280,844),(844,390),(812,300),(812,276)]:
   mobile=width<1000;context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,**({'user_agent':UA} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   page.goto(BASE+'game.html#/diary?station=ruisui',wait_until='domcontentloaded');page.wait_for_function('window.testBook&&testBook.getCurrentPageIndex()===9');ready(page)
   expect(page.locator('.pf-photo-column #aming-journal .journal-page')).to_be_hidden();expect(page.locator('.pf-text-column .pf-aming-right .journal-page')).to_be_hidden()
   expect(page.locator('.pf-photo-column')).to_be_hidden();expect(page.locator('.pf-text-column')).to_be_hidden()
   page.evaluate('GameProgress.completeRuisui()')
   expect(page.locator('.pf-photo-column #aming-journal .journal-page')).to_be_visible();expect(page.locator('.pf-text-column .pf-aming-right .journal-page')).to_be_visible()
   assert page.locator('.pf-photo-column .diary-entry,.pf-photo-column #travel-note,.pf-text-column .photo-card,.pf-text-column .player-photo').count()==0
   assert [''.join(t.split()) for t in page.locator('.pf-text-column .diary-entry p').all_text_contents()]==['…','我好像來過這裡。','看到那隻乳牛的時候，突然想起了一點什麼。']
   expect(page.locator('.pf-text-column .travel-entry h2')).to_have_text('我的旅行心得');assert page.locator('.pf-text-column .memory-fragment-image').get_attribute('src')=='images/ruisui-memory-01.png'
   picture(page,'.photo-card img')
   assert page.locator('.pf-text-column .journal-page').first.evaluate('(e)=>getComputedStyle(e).borderTopWidth')=='0px'
   if mobile:
    assert page.locator('.diary-entry p').first.bounding_box()['y']<page.locator('.memory-fragment').bounding_box()['y']
   assert page.locator('.memory-fragment').bounding_box()['width']<=105
   # 拍立得非等寬、左右錯位，旋轉後仍在單頁可視範圍，兩框不相交。
   geometry=page.evaluate("""()=>{const selectors=['.pf-photo-column','.photo-card','.player-photo'];return selectors.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})}""")
   col,main,player=geometry
   assert main['width']>player['width']*1.2 and main['x']<player['x'],geometry
   assert main['bottom']<=player['y']+1,geometry
   for card in (main,player):
    assert card['x']>=col['x']-1 and card['right']<=col['right']+1 and card['y']>=col['y']-1 and card['bottom']<=col['bottom']+1,geometry
   page.screenshot(path=f'/workspace/work/collage-empty-{width}.png')
   page.locator('.player-photo').scroll_into_view_if_needed()
   page.locator('[data-book="edit"]').click()
   with page.expect_file_chooser() as chooser:page.locator('[data-layout="photo"]').click()
   chooser.value.set_files({'name':'portrait.svg','mimeType':'image/svg+xml','buffer':b'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="320"><rect width="160" height="320" fill="#d5c7aa"/></svg>'})
   expect(page.locator('.player-photo')).to_have_class(re.compile('has-photo'));page.wait_for_function('document.querySelector(".journal-decoration-layer").getAttribute("aria-busy")=="false"');picture(page,'#player-photo-preview')
   portrait_frame=page.locator('.player-photo').bounding_box()
   assert abs(portrait_frame['width']-player['width'])<1 and abs(portrait_frame['height']-player['height'])<1
   scroll(page,'.pf-photo-column',mobile);scroll(page,'.pf-text-column',mobile)
   page.locator('.memory-fragment-info').scroll_into_view_if_needed();r=page.locator('.memory-fragment-info').bounding_box();col=page.locator('.pf-text-column').bounding_box();assert r['y']>=col['y'] and r['y']+r['height']<=col['y']+col['height']+1
   page.locator('#travel-note').fill('照片左頁、故事右頁的心得');page.locator('[data-book="edit"]').click();assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='照片左頁、故事右頁的心得'
   page.locator('[data-book="edit"]').click();page.locator('#player-photo-input').set_input_files({'name':'landscape.svg','mimeType':'image/svg+xml','buffer':b'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><rect width="320" height="120" fill="#b7c2b0"/></svg>'});page.wait_for_function('document.querySelector(".journal-decoration-layer").getAttribute("aria-busy")=="false"');picture(page,'#player-photo-preview');page.locator('[data-book="edit"]').click()
   # 閱讀模式仍可垂直捲動故事，不能因恢復水平翻頁而失去閱讀操作。
   scroll(page,'.pf-text-column',mobile)
   for selector in ['.pf-photo-column','.pf-text-column']:page.locator(selector).evaluate('(e)=>e.scrollTop=0')
   page.screenshot(path=f'/workspace/work/collage-photo-{width}.png')
   assert page.locator('#diary-screen').evaluate('(e)=>e.scrollTop===0&&e.scrollLeft===0&&e.scrollHeight===e.clientHeight')
   # 紙張外緣仍由原生引擎處理；欄位捲動不奪走邊緣翻頁。
   for forward,destination in [(True,11),(False,9)]:
    r=page.locator('.pf-stage').bounding_box();x=r['x']+(r['width']-3 if forward else 3);y=r['y']+r['height']*.2;dx=(-1 if forward else 1)*r['width']*.75
    if mobile:
     c=context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(300)
     for k in range(1,13):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*k/12,'y':y}]})
     c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
    else:page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y,steps=18);page.mouse.up()
    page.wait_for_function('(i)=>testBook.getState()==="read"&&testBook.getCurrentPageIndex()===i',arg=destination)
   page.locator('.pf-index-tab').click();ready(page);page.locator('#ruisui-journal').click();ready(page);expect(page.locator('.journal-decoration-preview')).to_be_visible();expect(page.locator('#travel-note')).to_have_value('照片左頁、故事右頁的心得');assert page.evaluate('engineCount')==1
   assert page.locator('.pf-undiscovered-lock svg').count()==12
   page.reload(wait_until='domcontentloaded');page.wait_for_function('window.testBook&&testBook.getCurrentPageIndex()===9');ready(page);expect(page.locator('#travel-note')).to_have_value('照片左頁、故事右頁的心得');assert not errors,errors
   context.close();print('PASS photo/text spread',width,height,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
