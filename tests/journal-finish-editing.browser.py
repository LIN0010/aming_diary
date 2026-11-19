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
 if action in SOURCES and page.locator('.journal-sticker-picker').is_hidden():page.locator('[data-layout="stickers"]').click()
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
SOURCES=['conductor-hat','train-rear','vintage-train','rail-crossing','rail-lantern','old-station']
NAMES=['站長帽','列車車尾','復古列車','平交道號誌','復古鐵道煤油燈','木造車站']
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1440,900),(852,393)]:
   mobile=w<1000;c=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   fb=(ROOT/'aming-game/vendor/fabric/fabric.min.js').read_text();page.route('**/fabric.min.js',lambda r:r.fulfill(body=fb+';window.canvases=[];const init=fabric.Canvas.prototype.initialize;fabric.Canvas.prototype.initialize=function(...args){const r=init.apply(this,args);canvases.push(this);return r;};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui()');page.locator('[data-book="edit"]').click();layer_ready(page)
   assert page.locator('#save-travel,.journal-save-dock').count()==0
   tool(page,'conductor-hat').click();layer_ready(page);page.evaluate('window.currentCanvas=canvases.find(c=>c.lowerCanvasEl.closest(".journal-decoration-layer"))');id=page.evaluate('currentCanvas.getActiveObject().journalId')
   r=page.locator('.pf-book').bounding_box();q=page.evaluate('({x:currentCanvas.getActiveObject().left,y:currentCanvas.getActiveObject().top})');x=r['x']+q['x']/1200*r['width'];y=r['y']+q['y']/800*r['height'];drag(page,x,y,r['width']*.75+r['x']-x,r['height']*.85+r['y']-y,mobile)
   assert page.evaluate('currentCanvas.getActiveObject().journalPage')=='right'
   q=page.evaluate('(()=>{const o=currentCanvas.getActiveObject();o.setCoords();return {x:o.oCoords.tr.x,y:o.oCoords.tr.y}})()');r=page.locator('.journal-decoration-layer .upper-canvas').bounding_box();drag(page,r['x']+q['x']/1200*r['width'],r['y']+q['y']/800*r['height'],8,-6,mobile)
   sticker=page.evaluate('(id)=>{const o=currentCanvas.getObjects().find(o=>o.journalId===id);return {left:o.left,top:o.top,scale:o.scaleX,angle:o.angle}}',id);assert sticker['top']>600,sticker
   with page.expect_file_chooser() as file:tool(page,'photo').click()
   file.value.set_files(str(ROOT/'aming-game/images/cow.png'));layer_ready(page)
   def positions():return page.locator('[data-layer-id]').evaluate_all('(items)=>Object.fromEntries(items.map(e=>{const b=e.getBoundingClientRect();return [e.dataset.layerId,{x:b.x,y:b.y,width:b.width,height:b.height,fabric:e.classList.contains("journal-stack-object")}]}))')
   def same(before,after):
    deltas=[]
    for id,a in before.items():
     keys=['x','y','width','height'] if a['fabric'] else ['x','y']
     deltas.append((id,{k:after[id][k]-a[k] for k in keys}))
    assert max(abs(value) for _,values in deltas for value in values.values())<.2,deltas
   page.locator('#travel-note').fill('完成編輯才結束，心得與排版保留。');before=positions();page.locator('[data-book="edit"]').click();expect(page.locator('[data-book="edit"]')).to_have_text('編輯手帳');same(before,positions())
   saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert saved['photo'].startswith('data:image/jpeg');assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='完成編輯才結束，心得與排版保留。'
   page.locator('[data-book="edit"]').click();layer_ready(page);same(before,positions());expect(page.locator('#travel-note')).to_have_value('完成編輯才結束，心得與排版保留。')
   # Independent failures for the layout key and the progress/note key.
   for failure in ['layout','note']:
    page.evaluate('(failure)=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if((failure==="layout")===(k==="aming-diary-journal-layouts"))throw new DOMException("test full","QuotaExceededError");return originalSet.call(this,k,v)}}',failure)
    tool(page,'old-station').click();layer_ready(page);page.locator('#travel-note').fill('失敗後保留草稿 '+failure);page.locator('[data-book="edit"]').click();expect(page.locator('[data-book="edit"]')).to_have_text('完成編輯');expect(page.locator('#travel-note')).to_have_value('失敗後保留草稿 '+failure)
    expect(page.locator('.journal-layout-status') if failure=='layout' else page.locator('.travel-saved')).to_be_visible()
    page.evaluate('()=>{Storage.prototype.setItem=originalSet;}');page.locator('[data-book="edit"]').click();expect(page.locator('[data-book="edit"]')).to_have_text('編輯手帳');page.locator('[data-book="edit"]').click();layer_ready(page)
   page.locator('[data-book="edit"]').click();final=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts"))');page.reload();ready(page);assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts"))')==final
   page.locator('[data-book="edit"]').click();layer_ready(page);expect(page.locator('#travel-note')).to_have_value('失敗後保留草稿 note');loaded=page.evaluate('(id)=>{const o=canvases.flatMap(c=>c.getObjects()).find(o=>o.journalId===id);return {left:o.left,top:o.top,scale:o.scaleX,angle:o.angle}}',id);assert loaded==sticker,(loaded,sticker)
   assert page.evaluate('engineCount')==1;assert not errors,errors;c.close();print('PASS finish-only save, both failure paths retain edits, lower-page placement, mode/reload coordinates',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
