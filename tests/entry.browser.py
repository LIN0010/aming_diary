"""開始／繼續入口及重設保護：python tests/entry.browser.py。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os, shutil
from playwright.sync_api import sync_playwright, expect
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(Path(__file__).resolve().parents[1]/'aming-game')))
Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
errors=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':390,'height':844})
  context.add_init_script("""
   window.sawTransitionBox=false;
   new MutationObserver(() => {
    const box=document.getElementById('scene-loading');
    if(box && !box.hidden) window.sawTransitionBox=true;
   }).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  """)
  page=context.new_page()
  page.on('pageerror',lambda e:errors.append(str(e)))
  held=[]
  hold=[True]
  def stall(route):
   if hold[0]: held.append(route)
   else: route.continue_()
  page.route('**/js/app.js',stall)
  page.goto(BASE)
  expect(page.locator('#start-btn')).to_have_text('開始遊戲')
  expect(page.locator('#continuous-journey')).to_have_text('繼續旅程')
  expect(page.locator('#continuous-journey')).to_be_disabled()
  page.locator('#start-btn').click()
  expect(page.locator('#loading-progress')).to_be_visible()
  page.wait_for_timeout(200)
  assert held
  assert int(page.locator('#percentage').inner_text())<100
  assert page.evaluate("localStorage.getItem('aming-diary-progress')") is None
  hold[0]=False
  for route in list(held): route.continue_()
  page.wait_for_url(BASE+'game.html#/home',timeout=20000)
  expect(page.locator('#memory-count')).to_have_text('0')
  assert not page.evaluate('window.sawTransitionBox'), '開始遊戲不應再跳出換場方框'
  print('PASS: 無存檔停用繼續；開始遊戲須等待場景與單頁入口資源載入，完成前不建立／重設存檔。',flush=True)
  page.evaluate("""() => {
   const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
   EventStore.joinPhoto();EventStore.submitPhoto('重置前的攝影紀錄','保留測試',canvas.toDataURL('image/jpeg'));
   EventStore.claim('pose');
  }""")
  page.evaluate("EventStore.assign([0,0,0]); EventStore.completeTask('ticket'); GameProgress.completeRuisui(); GameProgress.saveNote('ruisui','保留我的心得'); GameProgress.enterScene('diary','ruisui-player')")
  page.goto(BASE)
  original=page.evaluate("localStorage.getItem('aming-diary-progress')")
  activity=page.evaluate('localStorage.getItem(EventConfig.storageKey)')
  held=[]
  hold[0]=True
  page.locator('#continuous-journey').click()
  expect(page.locator('#loading-progress')).to_be_visible()
  page.wait_for_timeout(200)
  assert held and int(page.locator('#percentage').inner_text())<100
  assert page.evaluate("localStorage.getItem('aming-diary-progress')")==original
  assert page.evaluate('localStorage.getItem(EventConfig.storageKey)')==activity
  hold[0]=False
  for route in list(held): route.continue_()
  page.wait_for_url(BASE+'game.html#/diary?station=ruisui&tab=player',timeout=20000)
  expect(page.locator('#travel-note')).to_have_value('保留我的心得')
  assert page.evaluate('EventStore.snapshot().team')=='blue'
  assert page.evaluate('EventStore.personal()')==30
  assert page.evaluate('EventStore.snapshot().photos.length')==1
  assert page.evaluate('EventStore.snapshot().claims')==['pose']
  assert not page.evaluate('window.sawTransitionBox'), '繼續旅程不應再跳出換場方框'
  print('PASS: 繼續旅程使用相同進度條，恢復原日記頁籤、碎片與心得。',flush=True)
  page.unroute('**/js/app.js',stall)
  page.goto(BASE)
  page.once('dialog',lambda d:d.dismiss())
  page.locator('#start-btn').click()
  expect(page.locator('#start-screen')).to_be_visible()
  assert page.evaluate("localStorage.getItem('aming-diary-progress')")==original
  assert page.evaluate('localStorage.getItem(EventConfig.storageKey)')==activity
  page.route('**/js/app.js',lambda route:route.abort())
  page.once('dialog',lambda d:d.accept())
  page.locator('#start-btn').click()
  expect(page.locator('#retry-loading')).to_be_visible()
  assert page.evaluate("localStorage.getItem('aming-diary-progress')")==original
  assert page.evaluate('localStorage.getItem(EventConfig.storageKey)')==activity
  page.unroute('**/js/app.js')
  page.locator('#retry-loading').click()
  page.wait_for_url(BASE+'game.html#/home',timeout=20000)
  expect(page.locator('#memory-count')).to_have_text('0')
  assert page.evaluate('GameProgress.snapshot().notes.ruisui')==''
  assert page.evaluate('GameProgress.snapshot().collectedMemories')==[]
  assert page.evaluate('EventStore.snapshot().team') is None
  assert page.evaluate('EventStore.snapshot().photos')==[]
  assert page.evaluate('EventStore.snapshot().claims')==[]
  assert not page.evaluate('EventStore.snapshot().photoJoined')
  assert page.evaluate('EventStore.snapshot().completed')==[]
  page.locator('[data-destination="event"]').click()
  page.locator('#ev-cards').press('ArrowRight')
  page.locator('[data-action="open-race"]').click()
  expect(page.locator('.ev-start-modal')).to_be_visible()
  expect(page.locator('[data-team-score]')).to_have_count(0)
  print('PASS: 取消重設／載入失敗保留原存檔；重試載入成功後才開始全新旅程。',flush=True)
  context.close()
  context=browser.new_context()
  context.add_init_script('''window.failWrites=false; const write=Storage.prototype.setItem;
   Storage.prototype.setItem=function(k,v){if(window.failWrites)throw new DOMException('full','QuotaExceededError');return write.call(this,k,v)};''')
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE)
  page.evaluate("GameProgress.completeRuisui(); window.failWrites=true")
  before=page.evaluate("localStorage.getItem('aming-diary-progress')")
  page.once('dialog',lambda d:d.accept())
  page.locator('#start-btn').click()
  expect(page.locator('#progress-warning')).to_contain_text('原存檔已保留',timeout=20000)
  expect(page.locator('#start-btn')).to_be_enabled()
  expect(page.locator('#start-screen')).to_be_visible()
  assert page.evaluate("localStorage.getItem('aming-diary-progress')")==before
  assert not errors,errors
  print('PASS: 重設寫入失敗留在入口、保留舊存檔；測試沒有 JavaScript 執行錯誤。',flush=True)
  browser.close()
finally: server.shutdown()
