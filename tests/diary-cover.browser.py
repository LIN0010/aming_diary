"""新硬封面圖片與可見頁中心：閉合／跨頁／封底、重載與 viewport 變化。"""
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
def settled(page,index):
 page.wait_for_function('(i)=>testBook.getCurrentPageIndex()===i&&testBook.getState()==="read"&&!document.querySelector(".pf-book").hasAttribute("aria-busy")',arg=index)
 page.wait_for_function('!document.querySelector(".pf-book").getAnimations().length')
def center(page,selector,w):
 r=(page.locator('.pf-hard').last if selector=='back' else page.locator(selector)).bounding_box();assert abs(r['x']+r['width']/2-w/2)<1,(selector,r,w)
 assert r['x']>=-1 and r['x']+r['width']<=w+1,r
 return r
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1440,900),(1280,800),(844,390)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Original=St.PageFlip;St.PageFlip=class extends Original{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary');page.wait_for_function('window.testBook&&document.querySelectorAll(".stf__item").length===16');settled(page,0)
   cover=page.locator('.pf-scrapbook-cover');expect(cover.locator('h2')).to_have_count(0);expect(cover).to_have_attribute('data-density','hard')
   image=cover.locator('img');expect(image).to_have_attribute('src','images/diary-cover-scrapbook2.png');assert image.evaluate('async e=>{await e.decode();return e.naturalWidth===1086&&e.naturalHeight===1448}')
   r=center(page,'.pf-scrapbook-cover',w);im=image.bounding_box();assert all(abs(r[k]-im[k])<1 for k in ['x','y','width','height']);assert abs(r['width']/r['height']-.75)<.003
   page.screenshot(path=f'/workspace/work/diary-cover-closed-{w}.png')
   for repeat in range(2):
    cover.click();settled(page,1);center(page,'.pf-frame',w);assert page.evaluate('testBook.getSettings().usePortrait') is False
    if repeat==0:page.screenshot(path=f'/workspace/work/diary-cover-open-{w}.png')
    page.locator('[data-book="close"]').click();settled(page,0);center(page,'.pf-scrapbook-cover',w)
   # 可視高度變動後不重新建立引擎，開闔仍置中。
   page.set_viewport_size({'width':w,'height':h-40});page.wait_for_function('(h)=>document.querySelector("#diary-screen").clientHeight===h',arg=h-40);settled(page,0);center(page,'.pf-scrapbook-cover',w)
   cover.click();settled(page,1);center(page,'.pf-frame',w)
   # 逐站向前翻至最後跨頁，再翻到硬封底。
   for dest in [3,5,7,9,11,13]:page.evaluate('testBook.flipNext()');settled(page,dest)
   page.evaluate('testBook.flipNext()');settled(page,15);page.wait_for_function('!document.querySelector("#diary-screen").classList.contains("pf-reading")');settled(page,15)
   back=page.locator('.pf-scrapbook-back-cover');expect(back.locator('h2')).to_have_count(0);expect(back).to_have_attribute('data-density','hard')
   back_image=back.locator('img');expect(back_image).to_have_attribute('src','images/diary-back-cover-scrapbook2.png')
   assert back_image.evaluate('async e=>{await e.decode();return e.naturalWidth===1086&&e.naturalHeight===1448&&getComputedStyle(e).transform==="none"&&getComputedStyle(e).objectFit==="contain"}')
   br=center(page,'back',w);ir=back_image.bounding_box();assert all(abs(br[k]-ir[k])<1 for k in ['x','y','width','height']);assert abs(br['width']/br['height']-.75)<.003
   assert back.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
   page.screenshot(path=f'/workspace/work/diary-back-closed-{w}.png')
   # 點封底反向翻回最後跨頁，再以原操作闔回正封面。
   back.click();settled(page,13);center(page,'.pf-frame',w)
   page.locator('[data-book="close"]').click();settled(page,0);center(page,'.pf-scrapbook-cover',w)
   assert page.evaluate('engineCount')==1;assert not errors,errors
   print('PASS actual cover CG, no title/crop, centered front/spread/back, resize, one engine',w,h,flush=True);context.close()
  browser.close()
finally:server.shutdown()
