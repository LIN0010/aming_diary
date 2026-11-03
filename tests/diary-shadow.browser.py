"""原生下層落影：前中後、雙向翻頁、圖層、原紙色與觸控。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
import shutil, math, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Q(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Q,directory=str(ROOT/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for width,height in [(1280,844),(844,390)]:
   context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<1000,has_touch=width<1000);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Original=St.PageFlip;St.PageFlip=class extends Original{constructor(...a){super(...a);window.testBook=this;}};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/diary.html',wait_until='domcontentloaded');page.wait_for_function('window.testBook');page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert page.evaluate('testBook.getSettings().maxShadowOpacity')==.25
   r=page.locator('.pf-stage').bounding_box()
   for direction in ['forward','backward']:
    page.screenshot(path=f'/workspace/work/cast-{width}-{direction}-before.png')
    x=r['x']+(r['width']-4 if direction=='forward' else 4);y=r['y']+r['height']-4
    c=context.new_cdp_session(page) if width<1000 else None
    if c:c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(300)
    else:page.mouse.move(x,y);page.mouse.down()
    shadows=[]
    for step,f in enumerate([.2,.45,.75]):
     px=x+(-1 if direction=='forward' else 1)*r['width']*f;py=y-r['height']*.25
     if c:c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':px,'y':py}]})
     else:page.mouse.move(px,py,steps=8)
     page.wait_for_timeout(70)
     data=page.evaluate("""()=>{const s=document.querySelector('.stf__outerShadow'),i=document.querySelector('.stf__innerShadow');return {width:s.style.width,transform:s.style.transform,clip:s.style.clipPath,z:getComputedStyle(s).zIndex,inner:getComputedStyle(i).opacity,pages:[...document.querySelectorAll('.pf-page.--soft')].filter(e=>e.style.display!=='none').map(e=>({z:Number(e.style.zIndex),color:getComputedStyle(e).backgroundColor}))}}""")
     assert data['z']=='4' and data['inner']=='0';assert all(p['color']=='rgb(245, 236, 219)' for p in data['pages']);assert any(p['z']<4 for p in data['pages']) and any(p['z']==5 for p in data['pages']);shadows.append((data['width'],data['transform'],data['clip']));page.screenshot(path=f'/workspace/work/cast-{width}-{direction}-{step}.png')
    assert len(set(shadows))>1
    if c:c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
    else:page.mouse.up()
    page.wait_for_function('testBook.getState()==="read" && getComputedStyle(document.querySelector(".stf__outerShadow")).display==="none"');page.screenshot(path=f'/workspace/work/cast-{width}-{direction}-after.png');assert page.locator('.stf__outerShadow').evaluate('(e)=>getComputedStyle(e).display')=='none'
    assert page.evaluate('testBook.getCurrentPageIndex()')==(3 if direction=='forward' else 1)
   if width<1000:
    x=r['x']+r['width']-4;y=r['y']+r['height']-4;c=context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for k in range(1,16):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-r['width']*.75*k/15,'y':y}]})
    c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach();page.wait_for_timeout(900);assert page.evaluate('testBook.getCurrentPageIndex()')==3
   assert not errors,errors;context.close()
  browser.close()
finally:server.shutdown()
