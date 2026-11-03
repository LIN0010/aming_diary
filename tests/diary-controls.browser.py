"""目錄書籤隨原生實際頁碼同步；闔書膠囊維持可點擊，含手機觸控模擬。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')))
Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
def ready(page):
 page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")')
def bookmark(page,visible):
 expect(page.locator('.pf-index-tab')).to_be_visible() if visible else expect(page.locator('.pf-index-tab')).to_be_hidden()
def close_hit(page):
 close=page.locator('[data-book="close"]');expect(close).to_have_text('闔上日記')
 r=close.bounding_box();frame=page.locator('.pf-frame').bounding_box()
 assert r['y']>=0 and r['x']>=0 and r['x']+r['width']<=page.viewport_size['width'] and r['y']+r['height']<=frame['y']+1,(r,frame)
 assert close.evaluate('(e)=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
 assert close.evaluate('(e)=>getComputedStyle(e).borderRadius')=='999px'
 assert close.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgba(255, 250, 240, 0.82)'
def drag(page,forward,mobile):
 r=page.locator('.pf-stage').bounding_box();x=r['x']+(r['width']-3 if forward else 3);y=r['y']+r['height']*.8
 old=page.locator('.pf-index-tab').get_attribute('hidden');dx=(-1 if forward else 1)*r['width']*.75
 if mobile:
  c=page.context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(300)
  for step in range(1,13):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*step/12,'y':y}]})
 else:
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y,steps=18)
 assert page.locator('.pf-index-tab').get_attribute('hidden')==old,'Bookmark changed during drag'
 if mobile:c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
 else:page.mouse.up()
 page.wait_for_function('(i)=>testBook.getState()==="read"&&testBook.getCurrentPageIndex()===i',arg=3 if forward else 1)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text()
  for width,height in [(1280,844),(844,390),(812,300)]:
   mobile=width<1000;context=browser.new_context(viewport={'width':width,'height':height},has_touch=mobile,is_mobile=mobile,**({'user_agent':UA} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   page.goto(BASE+'game.html#/diary',wait_until='domcontentloaded');page.wait_for_function('window.testBook&&document.querySelectorAll(".stf__item").length===16')
   bookmark(page,False)
   page.evaluate('''()=>{window.bookmarkChanges=[];new MutationObserver(()=>bookmarkChanges.push({state:testBook.getState(),page:testBook.getCurrentPageIndex(),hidden:document.querySelector('.pf-index-tab').hidden})).observe(document.querySelector('.pf-index-tab'),{attributes:true,attributeFilter:['hidden']});}''')
   page.locator('.pf-hard').first.click();ready(page);bookmark(page,False);close_hit(page)
   drag(page,True,mobile);bookmark(page,True)
   drag(page,False,mobile);bookmark(page,False)
   page.locator('#ruisui-journal').click();ready(page);bookmark(page,True)
   page.locator('#travel-note').fill('書籤狀態測試心得');page.locator('.pf-index-tab').click();ready(page);bookmark(page,False);assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='書籤狀態測試心得'
   # 原生 API 正、反向跨頁與最後封底，狀態同步不依賴控制鈕。
   for dest in [3,5,7,9,11,13,15]:
    page.evaluate('testBook.flipNext()');page.wait_for_function('(i)=>testBook.getState()==="read"&&testBook.getCurrentPageIndex()===i',arg=dest);bookmark(page,dest<15)
   page.wait_for_function('!document.querySelector("#diary-screen").classList.contains("pf-ui-hidden")');bookmark(page,False)
   page.locator('.pf-hard').last.click();ready(page);bookmark(page,True)
   page.set_viewport_size({'width':width,'height':height-24});page.wait_for_timeout(500);close_hit(page)
   page.screenshot(path=f'/workspace/work/diary-controls-{width}.png')
   page.locator('[data-book="close"]').click();ready(page);bookmark(page,False);assert not page.locator('.bottom-nav').evaluate('(e)=>e.inert')
   assert page.evaluate('engineCount')==1
   assert page.evaluate('bookmarkChanges.every(c=>c.state==="read"&&c.hidden===(c.page<3||c.page>14))'),page.evaluate('bookmarkChanges')
   assert not errors,errors
   context.close();print('PASS diary controls',width,height,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
