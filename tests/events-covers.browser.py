"""正式活動 CG：票券左右欄、切換、備援與原功能不變。"""
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
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1440,900),(852,393),(932,430),(667,375)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/event');expect(page.locator('.ev-banner-image')).to_have_count(1)
   before=page.evaluate('localStorage.getItem(EventConfig.storageKey)')
   for kind,name in [('photo','event-spring-photography.png'),('race','event-mountain-sea.png')]:
    if kind=='race':
     arrow=page.locator('[data-action="next-activity"]');arrow.tap() if mobile else arrow.click()
    expect(page.locator('.ev-banner h2')).to_have_text(page.evaluate('(k)=>EventConfig[k].title',kind));expect(page.locator('.ev-banner-image')).to_have_attribute('src','images/'+name)
    im=page.locator('.ev-banner-image');assert im.evaluate('async e=>{await e.decode();return e.naturalWidth===1232&&e.naturalHeight===928&&getComputedStyle(e).objectFit==="cover";}')
    expect(page.locator('.ev-rail,.ev-banner-art > span')).to_have_count(0)
    assert page.locator('.ev-banner-art').evaluate('(e)=>getComputedStyle(e,"::before").content')=='none'
    page.locator('#ev-cards').evaluate('e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))')
    art=page.locator('.ev-banner-art').bounding_box();image=im.bounding_box();copy=page.locator('.ev-banner-copy').bounding_box()
    assert abs(art['x']-image['x'])<1 and image['x']+image['width']<=copy['x']+1
    assert copy['x']>art['x'] and art['width']>=180,(w,h,art,copy)
    assert abs(art['y']-image['y'])<1 and abs(art['height']-image['height'])<1
    page.locator('.ev-banner').screenshot(path=f'/workspace/work/event-cover-{kind}-{w}.png')
    assert 'radial-gradient' in page.locator('.ev-banner').evaluate('(e)=>getComputedStyle(e).maskImage')
   assert page.evaluate('localStorage.getItem(EventConfig.storageKey)')==before
   # 陣營參加仍直接開測驗確認浮窗；返回攝影活動可照常進入投稿畫面。
   page.locator('.ev-banner-copy .ev-button').click();expect(page.locator('.ev-start-modal')).to_be_visible();page.locator('[data-action="close-start"]').click()
   page.locator('[data-action="previous-activity"]').click();expect(page.locator('.ev-banner h2')).to_have_text('春日花季攝影祭');page.locator('.ev-banner-copy .ev-button').click();expect(page.locator('#ev-photo-form')).to_be_visible()
   assert not errors,errors
   print('PASS CG pairing/cover/bounds/ticket mask, activity switch & participation',w,h,flush=True);context.close()
  context=browser.new_context(viewport={'width':852,'height':393});page=context.new_page();page.route('**/images/event-*.png',lambda r:r.abort())
  page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/event')
  for _ in range(2):
   expect(page.locator('.ev-banner-image')).to_be_hidden();assert page.locator('.ev-banner-art').evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(229, 232, 219)';expect(page.locator('.ev-banner-copy .ev-button')).to_be_visible();page.locator('[data-action="next-activity"]').click()
  print('PASS failed image hides broken icon and keeps fallback & controls');context.close();browser.close()
finally:server.shutdown()
