"""旅團車站入口、申請、審核、蓋章與相容存檔：python tests/guild-entry.browser.py。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import shutil
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')))
Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
errors=[]
def entry(page):
 expect(page.locator('#group-screen')).to_have_class('gl-entry-mode',timeout=20000)
 expect(page.locator('.gl-entry-hotspot')).to_have_count(2)
 expect(page.locator('#gl-dialog')).not_to_be_visible()
 assert 'RAIL2027' not in page.locator('#group-screen').inner_text()
def aligned(page):
 image=page.locator('.gl-room-bg').bounding_box()
 assert page.locator('.gl-room-bg').evaluate('(e)=>e.complete&&e.naturalWidth===1536&&e.naturalHeight===1024')
 assert abs(image['width']/image['height']-1.5)<.01
 for t in page.evaluate('GuildConfig.entrance.hotspots'):
  box=page.locator(f'.gl-entry-hotspot[data-gl="{t["id"]}"]').bounding_box()
  assert abs(box['x']-image['x']-t['x']*image['width'])<1
  assert abs(box['y']-image['y']-t['y']*image['height'])<1
  assert box['x']>=-1 and box['x']+box['width']<=page.viewport_size['width']+1
  assert box['y']>=0 and box['y']+box['height']<page.viewport_size['height']-90
  assert page.locator(f'.gl-entry-hotspot[data-gl="{t["id"]}"]').evaluate('(e)=>getComputedStyle(e).backgroundImage')!='none'
def close(page):
 page.locator('.gl-close').click();expect(page.locator('#gl-dialog')).not_to_be_visible()
def join_screen(page,method='apply'):
 page.locator('.gl-entry-hotspot[data-gl="join"]').click()
 if page.locator(f'[data-join-mode="{method}"]').count():page.locator(f'[data-join-mode="{method}"]').click()
 assert 'RAIL2027' not in page.locator('#gl-dialog').inner_text()
def apply(page):
 join_screen(page)
 page.locator('#gl-search-form [name="query"]').fill('慢慢')
 page.locator('#gl-search-form [name="query"]').press('Enter')
 expect(page.locator('.gl-roster-row')).to_have_count(1)
 expect(page.locator('.gl-roster-detail')).to_contain_text('3 / 6')
 expect(page.locator('[data-apply]')).to_be_enabled()
 page.locator('[data-apply]').click()
 expect(page.locator('#gl-dialog-title')).to_have_text('等待團長審核')
 assert page.evaluate('GuildStore.current()') is None
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1280,'height':800})
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'game.html#/group');entry(page);aligned(page)
  page.screenshot(path='/workspace/work/guild-entrance-desktop.png')
  page.locator('.gl-entry-hotspot[data-gl="create"]').click()
  page.locator('#gl-create-form [name="name"]').fill('山線同行')
  page.locator('#gl-create-form [name="introduction"]').fill('一起收藏沿途的光')
  page.locator('#gl-dialog').evaluate('(e)=>Promise.all(e.getAnimations().map(a=>a.finished))')
  page.screenshot(path='/workspace/work/guild-create-ticket.png')
  page.locator('#gl-create-form button').click()
  expect(page.locator('.gl-boarding-stamp')).to_have_text('旅程啟程')
  expect(page.locator('#group-screen')).to_have_class('gl-entry-mode')
  expect(page.locator('#gl-dialog')).not_to_be_visible(timeout=10000)
  expect(page.locator('.gl-room-heading h1')).to_have_text('山線同行')
  assert page.evaluate('GuildStore.current().leader')=='you'
  assert page.evaluate('GuildStore.current().introduction')=='一起收藏沿途的光'
  assert page.locator('.gl-room-bg').get_attribute('src')=='images/guild-room-bg.png'
  raw=page.evaluate('localStorage.getItem(GuildConfig.storageKey)')
  page.reload();expect(page.locator('.gl-room-heading h1')).to_have_text('山線同行',timeout=20000)
  expect(page.locator('.gl-entry-hotspot')).to_have_count(0)
  page.locator('#gl-menu [data-gl="manage"]').click()
  page.locator('[data-gl="test-application"]').click()
  expect(page.locator('[data-review]')).to_have_count(2)
  page.locator('[data-approve="false"]').click()
  assert page.evaluate('GuildStore.current().members.length')==2
  page.locator('[data-gl="test-application"]').click();page.locator('[data-approve="true"]').click()
  assert page.evaluate('GuildStore.current().members.length')==3
  page.locator('[data-gl="toggle-applications"]').click()
  expect(page.locator('[data-gl="toggle-applications"]')).to_have_text('開放申請')
  page.once('dialog',lambda d:d.accept());page.locator('[data-gl="leave"]').click();entry(page)
  print('PASS: 原圖載入、精準熱區、名稱與介紹、建立蓋章、直達小屋、團長核准／拒絕及退出返回入口。',flush=True)
  context.close()
  context=browser.new_context(viewport={'width':1280,'height':800});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'game.html#/group');entry(page);apply(page)
  page.reload();expect(page.locator('#gl-dialog-title')).to_have_text('等待團長審核',timeout=20000)
  page.locator('#gl-dialog-content [data-gl="close"]').click();entry(page)
  page.locator('[data-gl="pending"]').click();page.locator('[data-gl="review-demo"]').click()
  expect(page.locator('.gl-applications')).to_contain_text('本機模擬審核')
  page.locator('[data-approve="false"]').click();expect(page.locator('#gl-dialog-title')).to_have_text('申請未通過')
  close(page);apply(page)
  page.locator('[data-gl="review-demo"]').click();page.locator('[data-approve="true"]').click()
  expect(page.locator('.gl-boarding-stamp')).to_have_text('同行確認')
  expect(page.locator('#gl-dialog')).not_to_be_visible(timeout=10000)
  expect(page.locator('.gl-room-heading h1')).to_have_text('沿線慢慢走')
  page.locator('#gl-menu [data-gl="manage"]').click();assert 'RAIL2027' not in page.locator('#gl-dialog').inner_text();close(page)
  print('PASS: 搜尋、申請等待、重載恢復、返回入口、本機拒絕後重申請、核准蓋章入團且未公開測試邀請碼。',flush=True)
  context.close()
  context=browser.new_context();page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'group.html');entry(page);apply(page)
  reviewer=context.new_page();reviewer.on('pageerror',lambda e:errors.append(str(e)));reviewer.goto(BASE+'group.html')
  expect(reviewer.locator('#gl-dialog-title')).to_have_text('等待團長審核')
  reviewer.locator('[data-gl="review-demo"]').click();reviewer.locator('[data-approve="true"]').click()
  expect(page.locator('#gl-dialog')).not_to_be_visible(timeout=10000)
  expect(page.locator('.gl-room-heading h1')).to_have_text('沿線慢慢走')
  print('PASS: 同一瀏覽器另一分頁本機核准後，等待畫面自動返回已加入的小屋。',flush=True)
  context.close()
  for width in (390,320):
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True)
   page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(BASE+'group.html');entry(page);aligned(page)
   page.screenshot(path=f'/workspace/work/guild-entrance-{width}.png')
   page.locator('.gl-entry-hotspot[data-gl="create"]').tap();expect(page.locator('#gl-create-form')).to_be_visible();close(page)
   join_screen(page,'code');page.locator('[name="code"]').fill('BADCODE');page.locator('#gl-join-form button:not([type="button"])').tap();expect(page.locator('#gl-notice')).to_contain_text('不正確')
   assert page.evaluate('GuildStore.current()') is None
   page.locator('[name="code"]').fill('RAIL2027');page.locator('#gl-join-form button:not([type="button"])').tap();expect(page.locator('.gl-boarding-stamp')).to_have_text('同行確認');expect(page.locator('#gl-dialog')).not_to_be_visible(timeout=10000)
   expect(page.locator('.gl-room-heading h1')).to_have_text('沿線慢慢走')
   page.locator('#gl-menu [data-gl="manage"]').click();page.once('dialog',lambda d:d.accept());page.locator('[data-gl="leave"]').click();entry(page)
   page.set_viewport_size({'width':844,'height':390});aligned(page)
   context.close()
  print('PASS: 320／390 手機熱區、車票操作、錯誤邀請碼、正確邀請碼蓋章、退出與橫向旋轉對齊。',flush=True)
  assert not errors,errors
  browser.close()
finally:server.shutdown()
