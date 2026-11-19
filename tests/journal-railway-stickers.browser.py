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
   mobile=w<1000;c=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   fb=(ROOT/'aming-game/vendor/fabric/fabric.min.js').read_text();page.route('**/fabric.min.js',lambda r:r.fulfill(body=fb+';window.canvases=[];const init=fabric.Canvas.prototype.initialize;fabric.Canvas.prototype.initialize=function(...args){const r=init.apply(this,args);canvases.push(this);return r;};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui();GameProgress.saveNote("ruisui","既有心得必須保留")');page.locator('[data-book="edit"]').click();layer_ready(page)
   page.locator('[data-layout="stickers"]').click();expect(page.locator('.journal-sticker-picker button')).to_have_count(6);assert page.locator('.journal-sticker-picker button').all_text_contents()==NAMES
   assert page.locator('.journal-sticker-picker').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").length')==3
   assert page.locator('.journal-sticker-picker img').evaluate_all('(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth>0&&getComputedStyle(i).objectFit==="contain")')
   assert page.locator('.journal-sticker-picker .journal-tool-name').evaluate_all('(names)=>names.every(e=>e.scrollWidth<=e.clientWidth+1)')
   page.screenshot(path=f'/workspace/work/railway-picker-{w}.png');page.locator('[data-layout="conductor-hat"]').click();layer_ready(page);page.locator('[data-book="edit"]').click()
   # Existing saved sources remain loadable, but have no menu buttons.
   page.evaluate('()=>{const k="aming-diary-journal-layouts",d=JSON.parse(localStorage.getItem(k)),s=d.stations.ruisui,example=s.objects.find(o=>o.type==="sticker");s.objects=s.objects.filter(o=>o.type!=="sticker");["compass","journal","tape"].forEach((source,i)=>s.objects.push({...example,id:"legacy-"+source,source,x:.2+i*.2,y:.4,angle:0,order:2+i}));localStorage.setItem(k,JSON.stringify(d))}')
   page.reload();ready(page);page.locator('[data-book="edit"]').click();layer_ready(page);page.evaluate('window.currentCanvas=canvases.find(c=>c.lowerCanvasEl.closest(".journal-decoration-layer"))')
   for source in ['compass','journal','tape']:assert page.locator(f'.journal-stack-object[data-layer-id="legacy-{source}"]').is_visible()
   assert page.locator('[data-layout="compass"],[data-layout="journal"],[data-layout="tape"]').count()==0
   new_ids=[]
   for source in SOURCES:
    tool(page,source).click();layer_ready(page);page.wait_for_timeout(40)
    id=page.evaluate('currentCanvas.getActiveObject().journalId');new_ids.append(id)
    shape=page.evaluate('()=>{const o=currentCanvas.getActiveObject(),i=o.getObjects()[0];return {count:o.getObjects().length,type:i.type,ratio:o.width/o.height,original:i.width/i.height}}');assert shape['count']==1 and shape['type']=='image' and abs(shape['ratio']-shape['original'])<.01,shape
    alpha=page.locator(f'[data-layer-id="{id}"] img').evaluate('(img)=>{const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext("2d");x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let clear=0,paint=0;for(let i=3;i<d.length;i+=4){if(d[i]===0)clear++;if(d[i]>0)paint++;}return {clear,paint}}');assert alpha['clear']>0 and alpha['paint']>0
    # A single source object uses the same native selection/controls and page snap.
    point=page.evaluate('()=>{const o=currentCanvas.getActiveObject();return {x:o.left,y:o.top}}');r=page.locator('.pf-frame').bounding_box();x=r['x']+point['x']/1200*r['width'];y=r['y']+point['y']/800*r['height'];drag(page,x,y,8,-8,mobile);assert page.evaluate('currentCanvas.getActiveObject()?.journalId')==id
    initial=page.evaluate('({scale:currentCanvas.getActiveObject().scaleX,angle:currentCanvas.getActiveObject().angle})')
    def change(handle,dx,dy):
     q=page.evaluate('(handle)=>{const o=currentCanvas.getActiveObject();o.setCoords();return {x:o.oCoords[handle].x,y:o.oCoords[handle].y}}',handle);r=page.locator('.journal-decoration-layer .upper-canvas').bounding_box();drag(page,r['x']+q['x']/1200*r['width'],r['y']+q['y']/800*r['height'],dx,dy,mobile)
    change('tr',10,-8);change('mtr',12,7)
    assert abs(page.evaluate('currentCanvas.getActiveObject().scaleX')-initial['scale'])>.001
    assert abs(page.evaluate('currentCanvas.getActiveObject().angle')-initial['angle'])>.1
    q=page.evaluate('({x:currentCanvas.getActiveObject().left,y:currentCanvas.getActiveObject().top})');r=page.locator('.pf-frame').bounding_box();x=r['x']+q['x']/1200*r['width'];y=r['y']+q['y']/800*r['height'];drag(page,x,y,r['width']*.5,0,mobile)
    assert page.evaluate('currentCanvas.getActiveObject().journalPage')=='right'
    page.locator('[data-layout="layers"]').click();page.locator(f'[data-layer-select="{id}"]').click()
    for action in ['top','bottom','up','down']:page.locator(f'[data-stack-action="{action}"]').click()
    page.locator('[data-layout="layers"]').click()
    print('PASS railway sticker add/transform/snap/layers/alpha',w,source,flush=True)
   page.locator('[data-book="edit"]').click();saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert len([o for o in saved['objects'] if o['type']=='sticker'])==9
   page.reload();ready(page);assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui')==saved
   for id in new_ids+['legacy-compass','legacy-journal','legacy-tape']:expect(page.locator(f'.journal-stack-object[data-layer-id="{id}"]')).to_be_visible()
   page.locator('[data-book="edit"]').click();layer_ready(page);page.evaluate('window.currentCanvas=canvases.find(c=>c.lowerCanvasEl.closest(".journal-decoration-layer"))');page.locator('[data-layout="layers"]').click();page.locator(f'[data-layer-select="{new_ids[-1]}"]').click();page.locator('[data-layout="layers"]').click();tool(page,'delete').click();assert page.locator(f'[data-layer-id="{new_ids[-1]}"]').count()==0
   tool(page,'undo').click();layer_ready(page);expect(page.locator(f'.journal-stack-object[data-layer-id="{new_ids[-1]}"]')).to_be_visible()
   tool(page,'reset').click();layer_ready(page);assert page.evaluate('currentCanvas.getObjects().filter(o=>o.journalType==="sticker").length')==0
   tool(page,'undo').click();layer_ready(page);assert page.evaluate('currentCanvas.getObjects().filter(o=>o.journalType==="sticker").length')==9
   page.locator('[data-book="edit"]').click();assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='既有心得必須保留';assert not errors,errors;c.close();print('PASS six PNGs, legacy preservation, reload/delete/undo/defaults',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
