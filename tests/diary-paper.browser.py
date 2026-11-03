"""旋轉紙背視覺取樣；套件的平面紙角角度，不是實體紙張法線角度。"""
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
   page.goto(f'http://127.0.0.1:{server.server_port}/diary.html',wait_until='domcontentloaded');page.wait_for_function('window.testBook');page.locator('.pf-hard').first.click();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert page.evaluate('testBook.getSettings().maxShadowOpacity')==.35
   r=page.locator('.pf-stage').bounding_box();x=r['x']+r['width']-4;y=r['y']+r['height']-4;page.mouse.move(x,y);page.mouse.down()
   samples=[]
   for fx in [.95,.75,.5,.25,.05,-.25]:
    for fy in [.1,.3,.5,.7,.9]:
     px=r['x']+r['width']/2+r['width']/2*fx;py=r['y']+r['height']*fy;page.mouse.move(px,py);page.wait_for_timeout(18)
     data=page.evaluate('''()=>[...document.querySelectorAll('.pf-page.--soft:not(.--simple)')].map(e=>{const m=e.style.transform.match(/rotate\\(([-.0-9]+)rad\\)/);return m?{angle:Math.abs(Number(m[1]))*180/Math.PI,color:getComputedStyle(e).backgroundColor,overlay:getComputedStyle(e,'::after').content}:null}).filter(Boolean).find(x=>x.angle>.1)''')
     if data:samples.append((data['angle'],px,py))
   assert samples,'No rotating soft page'
   for target in [30,60,90,120]:
    angle,px,py=min(samples,key=lambda a:abs(a[0]-target));page.mouse.move(px,py);page.wait_for_timeout(50);page.screenshot(path=f'/workspace/work/paper-{width}-{target}.png');print(width,'target',target,'actual',round(angle,1),flush=True)
    assert page.locator('.pf-page.--soft:not(.--simple)[style*="rotate("]:not([style*="rotate(0rad)"])').first.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(234, 220, 195)'
   page.mouse.up();page.wait_for_timeout(700)
   assert page.locator('.pf-page.--soft.--simple').first.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(245, 236, 219)'
   if width<1000:
    before=page.evaluate('testBook.getCurrentPageIndex()');c=context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for k in range(1,16):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-r['width']*.75*k/15,'y':y}]})
    c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach();page.wait_for_timeout(900);assert page.evaluate('testBook.getCurrentPageIndex()')!=before;print('PASS native touch flip',flush=True)
   assert not errors,errors;context.close()
  browser.close()
finally:server.shutdown()
