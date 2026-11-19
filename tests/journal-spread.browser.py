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
 point=page.evaluate('(name)=>{const o=testCanvas.getActiveObject();o.setCoords();return {x:o.oCoords[name].x,y:o.oCoords[name].y}}',name);r=page.locator('.journal-decoration-layer .upper-canvas').bounding_box()
 drag(page,r['x']+point['x']/page.evaluate('testCanvas.getWidth()')*r['width'],r['y']+point['y']/800*r['height'],dx,dy,mobile)

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
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   fb=(ROOT/'aming-game/vendor/fabric/fabric.min.js').read_text();page.route('**/fabric.min.js',lambda r:r.fulfill(body=fb+';window.canvases=[];const init=fabric.Canvas.prototype.initialize;fabric.Canvas.prototype.initialize=function(...args){const r=init.apply(this,args);canvases.push(this);return r};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui()');page.locator('[data-book="edit"]').click();layer_ready(page)
   page.wait_for_function('canvases.length===2')
   def move_fabric(kind,destination,memory=False):
    page.evaluate('(memory)=>window.currentCanvas=canvases.find(c=>!!c.lowerCanvasEl.closest(".journal-memory-layer")===memory)',memory)
    object_id=page.evaluate('(kind)=>currentCanvas.getObjects().find(o=>kind==="memory"||o.journalType===kind).journalId',kind)
    # With real mixed layers, use the panel to expose an object hidden by an earlier drag.
    page.locator('[data-layout="layers"]').click();page.locator(f'[data-layer-select="{object_id}"]').click();page.locator('[data-stack-action="top"]').click();page.locator('[data-layout="layers"]').click()
    q=page.evaluate('(kind)=>{const o=currentCanvas.getObjects().find(o=>kind==="memory"||o.journalType===kind);return {x:o.left,y:o.top}}',kind);r=page.locator('.pf-frame').bounding_box()
    x=r['x']+q['x']/1200*r['width'];y=r['y']+q['y']/800*r['height'];target=r['x']+r['width']*(.25 if destination=='left' else .75)
    drag(page,x,y,target-x,0,mobile)
    owner=page.evaluate('(kind)=>currentCanvas.getObjects().find(o=>kind==="memory"||o.journalType===kind).journalPage',kind);assert owner==destination,(kind,owner,destination)
    bounds=page.evaluate('(kind)=>{const o=currentCanvas.getObjects().find(o=>kind==="memory"||o.journalType===kind),r=o.getBoundingRect(true,true);return {left:r.left,right:r.left+r.width,top:r.top,bottom:r.top+r.height}}',kind)
    assert bounds['left']>=(-.1 if destination=='left' else 599.9) and bounds['right']<=(600.1 if destination=='left' else 1200.1) and bounds['top']>=-.1 and bounds['bottom']<=800.1,bounds
   # 真實拖到書脊正中，放手前可跨脊；放手依實際重疊面積歸屬（同面積規則另有單元測試）。
   page.evaluate('window.currentCanvas=canvases.find(c=>c.lowerCanvasEl.closest(".journal-decoration-layer"))');r=page.locator('.pf-frame').bounding_box();q=page.evaluate('(()=>{const o=currentCanvas.getObjects().find(o=>o.journalType==="official-photo");return {x:o.left,y:o.top}})()');x=r['x']+q['x']/1200*r['width'];y=r['y']+q['y']/800*r['height']
   if not mobile:
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(r['x']+r['width']/2,y,steps=18)
    assert page.evaluate('(()=>{const o=currentCanvas.getActiveObject(),b=o.getBoundingRect(true,true);return b.left<600&&b.left+b.width>600&&o.journalPage==="left"})()')
    expected=page.evaluate('JournalSpread.choose(currentCanvas.getActiveObject().getCoords(true,true),"left")');page.screenshot(path='/workspace/work/spread-drag-seam.png');page.mouse.up()
    assert page.evaluate('currentCanvas.getObjects().find(o=>o.journalType==="official-photo").journalPage')==expected
   move_fabric('official-photo','right');move_fabric('photo','right');move_fabric('memory','left',True);tool(page,'compass').click();layer_ready(page);move_fabric('sticker','right');move_fabric('memory','right',True);move_fabric('memory','left',True)
   # 玩家照片移至右頁後仍可直接點中央更換，保留右頁歸屬。
   page.evaluate('window.currentCanvas=canvases.find(c=>c.lowerCanvasEl.closest(".journal-decoration-layer"))');r=page.locator('.pf-frame').bounding_box();q=page.evaluate('(()=>{const o=currentCanvas.getObjects().find(o=>o.journalType==="photo");return {x:o.left,y:o.top}})()')
   page.locator('[data-layout="layers"]').click();page.locator('[data-layer-select="player-polaroid"]').click();page.locator('[data-stack-action="top"]').click();page.locator('[data-layout="layers"]').click()
   with page.expect_file_chooser() as chosen:
    x=r['x']+q['x']/1200*r['width'];y=r['y']+q['y']/800*r['height'];page.touchscreen.tap(x,y) if mobile else page.mouse.click(x,y)
   chosen.value.set_files(str(ROOT/'aming-game/images/cow.png'));layer_ready(page);assert page.evaluate('currentCanvas.getObjects().find(o=>o.journalType==="photo").journalPage')=='right'
   # 每個 HTML 文字區塊也要跨頁，仍是原 textarea／故事節點。
   for id in ['aming-story','player-writing']:
    page.locator('[data-layout="layers"]').click();page.locator(f'[data-layer-select="{id}"]').click();page.locator('[data-stack-action="top"]').click();page.locator('[data-layout="layers"]').click()
    box=page.locator(f'[data-dom-object="{id}"]');box.scroll_into_view_if_needed();heading=box.locator('h2').bounding_box();page.mouse.click(heading['x']+10,heading['y']+10);handle=box.locator('h2');b=handle.bounding_box();r=page.locator('.pf-frame').bounding_box();drag(page,b['x']+14,b['y']+14,-r['width']*.5,0,mobile)
    assert box.get_attribute('data-journal-page')=='left'
   page.evaluate('(()=>{const c=canvases.find(c=>c.lowerCanvasEl.closest(".journal-decoration-layer")),o=c.getObjects().find(o=>o.journalType==="official-photo");o.scale(7);o.setCoords();c.setActiveObject(o);c.fire("selection:updated");c.requestRenderAll()})()');page.locator('[data-layout="layers"]').click();page.locator('[data-layer-select="aming-photo"]').click();page.locator('[data-stack-action="top"]').click();page.locator('[data-layout="layers"]').click();move_fabric('official-photo','left');move_fabric('official-photo','right')
   page.locator('#travel-note').fill('跨頁保存的心得');page.locator('[data-layout="layers"]').click();page.locator('[data-layer-select="memory-fragment"]').click();page.locator('[data-stack-action="top"]').click();page.locator('[data-layout="layers"]').click();page.locator('[data-book="edit"]').click();expect(page.locator('#travel-note')).to_be_hidden()
   saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert saved['memoryObject']['page']=='left';assert all(o['page']=='left' for o in saved['domObjects']);assert all(o['page']=='right' for o in saved['objects'])
   page.locator('.journal-memory-hit').click();expect(page.locator('#memory-drawer')).to_have_class(__import__('re').compile('show'));page.locator('#close-memory').click();expect(page.locator('#memory-overlay')).to_be_hidden()
   page.wait_for_function("location.hash.includes('station=ruisui')");page.reload();ready(page);expect(page.locator('#travel-note-reading')).to_have_text('跨頁保存的心得');assert page.locator('.journal-memory-hit').evaluate('(e)=>e.closest(".pf-page").classList.contains("--left")')
   assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui')==saved
   page.screenshot(path=f'/workspace/work/spread-read-{w}.png')
   r=page.locator('.pf-frame').bounding_box();drag(page,r['x']+r['width']-4,r['y']+r['height']*.45,-r['width']*.7,0,mobile);ready(page,11);page.evaluate('testBook.flipPrev()');ready(page)
   page.locator('.pf-index-tab').click();ready(page,1);page.locator('#ruisui-journal').click();ready(page);assert page.evaluate('engineCount')==1
   assert not errors,errors;context.close();print('PASS all cross-page types, ownership, bounds, HTML input, collection, reload, page turns',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
