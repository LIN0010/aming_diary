"""瑞穗 Fabric 編輯、座標存讀檔、照片持久化與翻頁整合。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil,json
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
def ready(page,index=9):page.wait_for_function('(i)=>window.testBook&&testBook.getCurrentPageIndex()===i&&testBook.getState()==="read"&&!document.querySelector(".pf-book").hasAttribute("aria-busy")',arg=index)
def tool(page,action):
 if action in ['compass','journal'] and page.locator('.journal-sticker-picker').is_hidden():page.locator('[data-layout="stickers"]').click()
 return page.locator(f'[data-layout="{action}"]')
def control(page,name,dx,dy,mobile):
 point=page.evaluate('(name)=>{const o=testCanvas.getActiveObject();o.setCoords();return {x:o.oCoords[name].x,y:o.oCoords[name].y}}',name);r=page.locator('.upper-canvas').bounding_box()
 drag(page,r['x']+point['x']/600*r['width'],r['y']+point['y']/800*r['height'],dx,dy,mobile)

def layer_ready(page):page.wait_for_function('document.querySelector(".journal-decoration-layer").getAttribute("aria-busy")==="false"')
def drag(page,x,y,dx,dy,mobile):
 if mobile:
  c=page.context.new_cdp_session(page);c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(300)
  for n in range(1,16):c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*n/15,'y':y+dy*n/15}]})
  c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.detach()
 else:page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=18);page.mouse.up()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1440,900),(852,393)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=context.new_page();confirmation={'accept':True};page.on('dialog',lambda d:d.accept() if confirmation['accept'] else d.dismiss());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   fb=(ROOT/'aming-game/vendor/fabric/fabric.min.js').read_text();page.route('**/fabric.min.js',lambda r:r.fulfill(body=fb+';const init=fabric.Canvas.prototype.initialize;fabric.Canvas.prototype.initialize=function(...args){window.testCanvas=this;return init.apply(this,args)};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page)
   expect(page.locator('[data-book="edit"]')).to_be_hidden();expect(page.locator('.journal-decoration-layer')).to_be_hidden()
   page.evaluate('GameProgress.completeRuisui()');expect(page.locator('.photo-card img')).to_be_visible();expect(page.locator('.journal-layout-tools')).to_be_hidden()
   # 先驗證已解鎖 HTML 文字可拖動翻頁，避免把既有缺陷帶入整合。
   r=page.locator('.diary-entry p').nth(1).bounding_box();stage=page.locator('.pf-stage').bounding_box();drag(page,r['x']+r['width']/2,r['y']+r['height']/2,-stage['width']*.55,0,mobile);ready(page,11);page.evaluate('testBook.flipPrev()');ready(page)
   page.locator('[data-book="edit"]').click();layer_ready(page);expect(page.locator('.journal-layout-tools')).to_be_visible();expect(page.locator('#travel-note')).to_be_visible()
   with page.expect_file_chooser() as chooser:tool(page,'photo').click()
   chooser.value.set_files(str(ROOT/'aming-game/images/cow.png'));layer_ready(page)
   page.wait_for_function('document.querySelector("#player-photo-preview").src.startsWith("data:image/jpeg")')
   # 照片與拍立得為同一組，實際拖動及旋轉縮放後一起保存。
   r=page.locator('.upper-canvas').bounding_box();initial=page.evaluate('({x:testCanvas.getObjects()[0].left/600,y:testCanvas.getObjects()[0].top/800})');drag(page,r['x']+r['width']*initial['x'],r['y']+r['height']*initial['y'],-r['width']*.10,-r['height']*.06,mobile)
   control(page,'mtr',22,10,mobile);control(page,'tr',12,-12,mobile)
   tool(page,'compass').click();layer_ready(page);tool(page,'journal').click();layer_ready(page)
   # 工具列在書頁右側，且沒有旋轉／縮放／選取模式按鈕。
   rail=page.locator('.pf-actions').bounding_box();book=page.locator('.pf-stage').bounding_box();assert rail['x']>=book['x']+book['width'] and rail['x']+rail['width']<=w
   assert page.locator('[data-layout=rotate],[data-layout=smaller],[data-layout=larger],[data-layout=select]').count()==0
   # Fabric 原生控制與滑鼠／觸控拖曳，使用實際上層 canvas，不呼叫搬移 API。
   canvas=page.locator('.upper-canvas');r=canvas.bounding_box();x=r['x']+r['width']*.4;y=r['y']+r['height']*.55
   drag(page,x,y,r['width']*.18,-r['height']*.12,mobile);assert page.evaluate('testBook.getCurrentPageIndex()')==9
   control(page,'mtr',22,10,mobile);control(page,'tr',12,-12,mobile);tool(page,'undo').click();layer_ready(page)
   tool(page,'delete').click() if tool(page,'delete').is_enabled() else None
   tool(page,'compass').click();layer_ready(page)
   count=page.evaluate('testCanvas.getObjects().length');tool(page,'delete').click();assert page.evaluate('testCanvas.getObjects().length')==count-1
   tool(page,'compass').click();layer_ready(page)
   r=page.locator('.upper-canvas').bounding_box();x=r['x']+r['width']*.92;y=r['y']+r['height']*.08
   page.touchscreen.tap(x,y) if mobile else page.mouse.click(x,y)
   assert page.evaluate('testCanvas.getActiveObject()==null');expect(tool(page,'delete')).to_be_disabled()
   page.locator('#travel-note').fill('保留的瑞穗心得');page.locator('[data-book="edit"]').click();expect(page.locator('#travel-note')).to_be_hidden();expect(page.locator('.journal-layout-tools')).to_be_hidden()
   saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert saved['photo'].startswith('data:image/jpeg');assert len(saved['objects'])>=2
   frame=saved['objects'][0];assert frame['type']=='photo' and frame['x']<initial['x']-.05 and abs(frame['angle']-3)>1,frame
   assert any(o['type']=='sticker' and abs(o['x']-.4)>.05 for o in saved['objects']),saved['objects']
   assert any(o['type']=='sticker' and abs(o['angle']+8)>1 for o in saved['objects']),saved['objects']
   expect(page.locator('.journal-decoration-preview')).to_be_visible();assert page.evaluate('engineCount')==1
   # 反向翻動時使用 DOM 複本：閱讀投影仍有可複製的 data 圖片。
   page.evaluate('testBook.flipPrev()');page.wait_for_function('testBook.getState()!=="read"')
   assert page.locator('.journal-decoration-preview').count()>=1
   ready(page,7);page.evaluate('testBook.flipNext()');ready(page)
   page.locator('[data-book="close"]').click();ready(page,0);page.locator('.pf-scrapbook-cover').click();ready(page,1);page.locator('#ruisui-journal').click();ready(page)
   assert page.evaluate('engineCount')==1
   page.wait_for_function("location.hash.includes('station=ruisui')");page.reload();ready(page);page.wait_for_function('document.querySelector(".journal-decoration-preview").src.startsWith("data:image/png")')
   assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui')==saved
   expect(page.locator('#travel-note-reading')).to_have_text('保留的瑞穗心得');expect(page.locator('.journal-layout-tools')).to_be_hidden()
   page.set_viewport_size({'width':932 if mobile else 1200,'height':430 if mobile else 760});page.wait_for_timeout(600)
   frame=page.locator('.pf-stage').bounding_box();layer=page.locator('.journal-decoration-layer').bounding_box();assert abs(layer['width']-frame['width']/2)<3
   page.locator('[data-book="edit"]').click();layer_ready(page);before=page.evaluate('testCanvas.getObjects().length');confirmation['accept']=False;tool(page,'reset').click();assert page.evaluate('testCanvas.getObjects().length')==before;confirmation['accept']=True;tool(page,'reset').click();layer_ready(page);page.locator('[data-book="edit"]').click()
   reset=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert reset['photo']==saved['photo'];assert len(reset['objects'])==2;assert reset['objects'][0]['x']>.35 and reset['objects'][0]['scale']>.4,reset['objects'];assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='保留的瑞穗心得'
   page.wait_for_function('document.querySelector(".journal-decoration-preview").naturalWidth===600')
   page.screenshot(path=f'/workspace/work/fabric-read-{w}.png')
   # 儲存失敗不得離開編輯模式；重試保留草稿。
   page.locator('[data-book="edit"]').click();layer_ready(page);tool(page,'journal').click();layer_ready(page);page.screenshot(path=f'/workspace/work/fabric-edit-{w}.png')
   page.evaluate("()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')};}")
   page.locator('[data-book="edit"]').click();expect(page.locator('[data-book="edit"]')).to_have_text('完成編輯');expect(page.locator('.journal-layout-status')).to_be_visible()
   page.evaluate('()=>{Storage.prototype.setItem=originalSet;}');page.locator('[data-book="edit"]').click();expect(page.locator('[data-book="edit"]')).to_have_text('編輯手帳')
   if not mobile:
    page.set_viewport_size({'width':700,'height':1000});page.wait_for_timeout(600);expect(page.locator('.pf-actions')).to_have_class(__import__('re').compile('is-compact'))
    page.locator('[data-book="edit"]').click();layer_ready(page);expect(page.locator('.journal-layout-tools')).to_be_hidden();page.locator('.journal-tool-toggle').click();expect(page.locator('.journal-layout-tools')).to_be_visible();page.locator('[data-book="edit"]').click()
   # 新遊戲命名空間清除確實包含手帳資料。
   page.evaluate('GameProgress.reset()');assert page.evaluate('localStorage.getItem("aming-diary-journal-layouts")') is None
   assert not errors,errors;context.close();print('PASS Fabric photo/layout persistence, undo/reset, gestures, resize, save failure',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
