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
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   bundle=(ROOT/'aming-game/vendor/page-flip/page-flip.browser.js').read_text();page.route('**/page-flip.browser.js',lambda r:r.fulfill(body=bundle+';const Orig=St.PageFlip;St.PageFlip=class extends Orig{constructor(...a){super(...a);window.testBook=this;window.engineCount=(window.engineCount||0)+1;}};',content_type='application/javascript'))
   fb=(ROOT/'aming-game/vendor/fabric/fabric.min.js').read_text();page.route('**/fabric.min.js',lambda r:r.fulfill(body=fb+';const init=fabric.Canvas.prototype.initialize;fabric.Canvas.prototype.initialize=function(...args){if(args[0].closest(".journal-decoration-layer"))window.testCanvas=this;return init.apply(this,args)};',content_type='application/javascript'))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/diary?station=ruisui');ready(page);page.evaluate('GameProgress.completeRuisui()')
   page.locator('[data-book="edit"]').click();layer_ready(page)
   assert page.locator('[data-dom-object="aming-photo"]').count()==0
   for kind in ['official-photo','photo']:
    o=page.evaluate('(kind)=>{const o=testCanvas.getObjects().find(o=>o.journalType===kind);return {x:o.left/600,y:o.top/800,scale:o.scaleX,angle:o.angle}}',kind)
    r=page.locator('.journal-decoration-layer .upper-canvas').bounding_box();drag(page,r['x']+o['x']*r['width'],r['y']+o['y']*r['height'],14,10,mobile)
    assert page.evaluate('testCanvas.getActiveObject()?.journalType')==kind
    control(page,'mtr',20,10,mobile);control(page,'tr',12,-12,mobile)
    after=page.evaluate('({scale:testCanvas.getActiveObject().scaleX,angle:testCanvas.getActiveObject().angle})')
    assert abs(after['angle']-o['angle'])>1 and abs(after['scale']-o['scale'])>.01
    assert page.evaluate('testBook.getCurrentPageIndex()')==9
   page.locator('[data-book="edit"]').click();expect(page.locator('#travel-note')).to_be_hidden()
   saved=page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui');assert any(o['type']=='official-photo' for o in saved['objects'])
   page.wait_for_function("location.hash.includes('station=ruisui')");page.reload();ready(page);expect(page.locator('.journal-decoration-preview')).to_be_visible()
   assert page.evaluate('JSON.parse(localStorage.getItem("aming-diary-journal-layouts")).stations.ruisui')==saved
   page.screenshot(path=f'/workspace/work/cow-fabric-{w}.png')
   # 舊 HTML 乳牛位置不應因轉換為 Fabric 而被重設。
   page.evaluate('''()=>{const key='aming-diary-journal-layouts',data=JSON.parse(localStorage.getItem(key)),s=data.stations.ruisui;s.objects=s.objects.filter(o=>o.type!=='official-photo');s.domObjects.push({id:'aming-photo',page:'left',type:'html',x:.2,y:.15,width:.36,angle:9,order:10});localStorage.setItem(key,JSON.stringify(data));}''')
   page.reload();ready(page);page.locator('[data-book="edit"]').click();layer_ready(page)
   migrated=page.evaluate('(()=>{const o=testCanvas.getObjects().find(o=>o.journalType==="official-photo");return {angle:o.angle,scale:o.scaleX}})()');assert migrated['angle']==9 and abs(migrated['scale']-.9)<.001,migrated
   assert not errors,errors;context.close();print('PASS true Fabric cow/player groups, native drag/rotation/scale, persistence',w,h,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
