"""未開放跨頁：原紙色、小鎖頭、文字避開書脊、既有鎖定條件及原生觸控。"""
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
def idle(page,index):
 page.wait_for_function('(i)=>testBook.getState()==="read"&&testBook.getCurrentPageIndex()===i',arg=index)
def drag(page,mobile,forward):
 r=page.locator('.pf-stage').bounding_box();x=r['x']+(r['width']-3 if forward else 3);y=r['y']+r['height']*.8;dx=(-1 if forward else 1)*r['width']*.75
 if mobile:
  c=page.context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(300)
  for k in range(1,13):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*k/12,'y':y}]})
  c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
 else:
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y,steps=18);page.mouse.up()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text()
  for width,height in [(1280,844),(844,390),(812,300)]:
   mobile=width<1000;context=browser.new_context(viewport={'width':width,'height':height},has_touch=mobile,is_mobile=mobile,**({'user_agent':UA} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;}};',content_type='application/javascript'))
   page.goto(BASE+'game.html#/diary',wait_until='domcontentloaded');page.wait_for_function('window.testBook&&document.querySelectorAll(".stf__item").length===16');page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")')
   assert page.locator('.pf-undiscovered-lock svg').count()==10
   assert page.locator('.pf-undiscovered-mask').count()==0
   # 先檢查板橋原型，再檢查共用元件的其他四組跨頁。
   for index,label in [(3,'板橋'),(5,'福隆'),(7,'台南'),(9,None),(11,'未知的下一站'),(13,'未知的下一站')]:
    page.evaluate('testBook.flipNext()');idle(page,index)
    pages=page.locator('.pf-page.--simple:visible')
    if label is None:
     assert pages.locator('.pf-undiscovered-page').count()==0;continue
    expect(pages.locator('.pf-undiscovered-lock')).to_have_count(2)
    expect(pages.locator('.pf-undiscovered-title')).to_have_text(label+'，正等待你的發現。')
    expect(pages.locator('.pf-undiscovered-hint')).to_have_text('沿著鐵道前行，尋找尚未拾起的記憶。')
    geometry=page.evaluate('''()=>{const a=[...document.querySelectorAll('.pf-page.--simple')].filter(e=>e.style.display!=='none');return a.map(e=>{const r=e.getBoundingClientRect(),text=e.querySelector('.pf-undiscovered-copy p').getBoundingClientRect(),lock=e.querySelector('svg').getBoundingClientRect();return {page:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},text:{x:text.x,y:text.y,right:text.right,bottom:text.bottom},lock:{width:lock.width,height:lock.height},paper:getComputedStyle(e).backgroundColor,prompt:getComputedStyle(e.querySelector('.pf-undiscovered-page')).backgroundColor,pointer:getComputedStyle(e.querySelector('.pf-undiscovered-page')).pointerEvents}})}''')
    for g in geometry:
     assert g['paper']=='rgb(245, 236, 219)' and g['prompt']=='rgba(0, 0, 0, 0)' and g['pointer']=='none',g
     assert g['text']['x']>=g['page']['x']+8 and g['text']['right']<=g['page']['right']-8,g
     assert g['text']['y']>=g['page']['y'] and g['text']['bottom']<=g['page']['bottom'],g
     assert g['lock']['width']<=24 and g['lock']['height']<=28
    if index in (3,5,13):page.screenshot(path=f'/workspace/work/unwritten-{label}-{width}.png')
   page.locator('.pf-index-tab').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');idle(page,1)
   drag(page,mobile,True);idle(page,3);drag(page,mobile,False);idle(page,1)
   # 沿用 disabled / locked 條件：隱藏提示，不更動玩家進度。
   page.evaluate('()=>{const e=document.querySelector(".station-journal");e.disabled=false;e.classList.remove("locked");}')
   assert page.locator('.pf-undiscovered-page').first.evaluate('(e)=>e.hidden')
   page.evaluate('()=>{const e=document.querySelector(".station-journal");e.disabled=true;e.classList.add("locked");}')
   assert not page.locator('.pf-undiscovered-page').first.evaluate('(e)=>e.hidden')
   page.locator('[data-book="close"]').click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert not page.locator('.bottom-nav').evaluate('(e)=>e.inert');assert not errors,errors
   context.close();print('PASS unwritten diary',width,height,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
