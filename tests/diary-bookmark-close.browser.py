"""闔書索引先淡出、立即停用；原生封底拖曳及取消恢復。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')))
Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
def ready(page):page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")')
def open_ruisui(page):
 page.locator('.pf-hard').first.click();ready(page);expect(page.locator('.pf-index-tab')).to_be_hidden();page.locator('#ruisui-journal').click();ready(page);expect(page.locator('.pf-index-tab')).to_be_visible()
def native_close(page,mobile,commit):
 r=page.locator('.pf-stage').bounding_box();x=r['x']+r['width']-3;y=r['y']+r['height']*.8;delta=r['width']*(.7 if commit else .04)
 if mobile:
  c=page.context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(300)
  for k in range(1,7):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-delta*k/6,'y':y}]})
 else:page.mouse.move(x,y);page.mouse.down();page.mouse.move(x-delta,y,steps=8)
 page.wait_for_function('document.querySelector(".pf-index-tab").classList.contains("pf-index-fading")');expect(page.locator('.pf-index-tab')).to_be_disabled()
 if commit:
  page.wait_for_timeout(180);assert page.locator('.pf-index-tab').evaluate('(e)=>e.hidden');assert page.evaluate('testBook.getState()')!='read'
 if mobile:c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
 else:page.mouse.up()
 page.wait_for_function('(i)=>testBook.getState()==="read"&&testBook.getCurrentPageIndex()===i',arg=15 if commit else 13)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox']);bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text()
  for width,height in [(1280,844),(844,390),(812,300)]:
   mobile=width<1000;context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,**({'user_agent':UA} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   page.goto(BASE+'game.html#/diary',wait_until='domcontentloaded');page.wait_for_function('window.testBook&&document.querySelectorAll(".stf__item").length===16');open_ruisui(page)
   page.evaluate('GameProgress.completeRuisui()');page.locator('#travel-note').fill('闔書先保存心得')
   state=page.evaluate('''()=>{const previous=testBook.flipPrev.bind(testBook);testBook.flipPrev=(...a)=>{window.firstCloseFlip??={elapsed:performance.now()-closeClick,hidden:document.querySelector('.pf-index-tab').hidden};return previous(...a)};window.closeClick=performance.now();document.querySelector('[data-book="close"]').click();const b=document.querySelector('.pf-index-tab');return {disabled:b.disabled,hidden:b.hidden,fade:b.classList.contains('pf-index-fading'),duration:getComputedStyle(b).transitionDuration,state:testBook.getState()};}''')
   assert state=={'disabled':True,'hidden':False,'fade':True,'duration':'0.12s','state':'read'},state
   ready(page);expect(page.locator('.pf-index-tab')).to_be_hidden();assert page.evaluate('firstCloseFlip.hidden&&firstCloseFlip.elapsed>=100');assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='闔書先保存心得'
   open_ruisui(page)
   for i in [11,13]:page.evaluate('testBook.flipNext()');page.wait_for_function('(n)=>testBook.getState()==="read"&&testBook.getCurrentPageIndex()===n',arg=i)
   # 取消封底拖曳不得被先前淡出 Promise 再次隱藏。
   native_close(page,mobile,False);page.wait_for_timeout(250);expect(page.locator('.pf-index-tab')).to_be_visible();expect(page.locator('.pf-index-tab')).to_be_enabled()
   native_close(page,mobile,True);page.wait_for_function('!document.querySelector("#diary-screen").classList.contains("pf-ui-hidden")');expect(page.locator('.pf-index-tab')).to_be_hidden()
   page.locator('.pf-hard').last.click();ready(page);expect(page.locator('.pf-index-tab')).to_be_visible();page.locator('.pf-index-tab').click();ready(page);expect(page.locator('.pf-index-tab')).to_be_hidden();assert page.evaluate('engineCount')==1;assert page.evaluate('testBook.getSettings().flippingTime')==350;assert not errors,errors
   context.close();print('PASS bookmark close timing',width,height,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
