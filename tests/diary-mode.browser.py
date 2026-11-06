"""心得閱讀／編輯：模式手勢、保存失敗、重載與單一翻頁實例。"""
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
def ready(page,index=9):page.wait_for_function('(i)=>testBook.getState()==="read"&&testBook.getCurrentPageIndex()===i&&!document.querySelector(".pf-book").hasAttribute("aria-busy")',arg=index)
def drag(page,mobile,forward=True):
 r=page.locator('.pf-stage').bounding_box();x=r['x']+(r['width']-3 if forward else 3);y=r['y']+r['height']*.8;dx=(-1 if forward else 1)*r['width']*.8
 if mobile:
  c=page.context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(300)
  for n in range(1,13):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*n/12,'y':y}]})
  c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
 else:page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y,steps=18);page.mouse.up()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1280,844),(844,390),(812,300)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');page.wait_for_function('window.testBook');ready(page)
   expect(page.locator('[data-book="edit"]')).to_be_hidden();expect(page.locator('#travel-note')).to_be_hidden();expect(page.locator('.pf-text-column')).to_be_hidden()
   page.evaluate("GameProgress.completeRuisui();GameProgress.saveNote('ruisui','原有心得\\n第二行')")
   expect(page.locator('#travel-note-reading')).to_have_text('原有心得\n第二行');expect(page.locator('#travel-note')).to_be_hidden()
   page.locator('#travel-note-reading').click();assert page.evaluate('document.activeElement.id')!='travel-note'
   frame=page.locator('.pf-frame').bounding_box();drag(page,mobile);ready(page,11);drag(page,mobile,False);ready(page)
   page.locator('[data-book="edit"]').click();expect(page.locator('[data-book="edit"]')).to_have_text('完成編輯');expect(page.locator('#travel-note')).to_have_value('原有心得\n第二行');expect(page.locator('#travel-note-reading')).to_be_hidden()
   page.locator('#travel-note').fill('編輯後的旅程\n保留換行與 <文字>')
   drag(page,mobile);page.wait_for_timeout(400);assert page.evaluate('testBook.getCurrentPageIndex()')==9 and page.evaluate('testBook.getState()')=='read'
   assert page.locator('.pf-frame').bounding_box()==frame
   # 既有存檔失敗時，保持編輯模式及草稿，不能誤報完成。
   page.evaluate("()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')};}")
   page.locator('#travel-note').fill('儲存失敗後仍保留');page.locator('[data-book="edit"]').click();expect(page.locator('[data-book="edit"]')).to_have_text('完成編輯');expect(page.locator('#travel-note')).to_have_value('儲存失敗後仍保留')
   page.evaluate('()=>{Storage.prototype.setItem=originalSet;}');page.locator('[data-book="edit"]').click();expect(page.locator('#travel-note')).to_be_hidden();expect(page.locator('#travel-note-reading')).to_have_text('儲存失敗後仍保留');assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='儲存失敗後仍保留'
   drag(page,mobile);ready(page,11);drag(page,mobile,False);ready(page);assert page.evaluate('engineCount')==1
   page.wait_for_function("location.hash.includes('station=ruisui')");page.reload();page.wait_for_function('window.testBook');ready(page);expect(page.locator('#travel-note')).to_be_hidden();expect(page.locator('#travel-note-reading')).to_have_text('儲存失敗後仍保留');expect(page.locator('[data-book="edit"]')).to_have_text('編輯手帳')
   page.locator('[data-book="edit"]').click();page.locator('#travel-note').fill('闔書也保留草稿');page.locator('[data-book="close"]').click();ready(page,0)
   r=page.locator('.pf-scrapbook-cover').bounding_box();assert abs(r['x']+r['width']/2-w/2)<1
   assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='闔書也保留草稿';assert not errors,errors
   print('PASS read/edit, real drag blocked/restored, failed-save draft, reload, centered cover',w,h,flush=True);context.close()
  browser.close()
finally:server.shutdown()
