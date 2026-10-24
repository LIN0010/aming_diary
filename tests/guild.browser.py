"""旅團小屋、分享、拼圖與手機操作：python tests/guild.browser.py。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')))
Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
errors=[]
def closed(page):
 page.locator('.gl-close').click();expect(page.locator('#gl-dialog')).not_to_be_visible()
def opened(page,action):
 page.locator(f'#gl-menu [data-gl="{action}"]').click();expect(page.locator('#gl-dialog')).to_be_visible()
def joined(page):
 expect(page.locator('.gl-entry-hotspot[data-gl="join"]')).to_be_visible()
 page.locator('.gl-entry-hotspot[data-gl="join"]').click()
 page.locator('[data-join-mode="code"]').click()
 page.locator('#gl-join-form [name="code"]').fill('WRONG')
 page.locator('#gl-join-form .gl-button:not([type="button"])').click();expect(page.locator('#gl-notice')).to_contain_text('不正確')
 page.locator('#gl-join-form [name="code"]').fill('rail2027')
 page.locator('#gl-join-form .gl-button:not([type="button"])').click();expect(page.locator('#gl-dialog')).not_to_be_visible()
 expect(page.locator('.gl-room-heading h1')).to_have_text('沿線慢慢走')
def aligned(page):
 image=page.locator('.gl-room-bg').bounding_box()
 for t in page.evaluate('GuildConfig.room.hotspots'):
  box=page.locator(f'.gl-hotspot[data-gl="{t["id"]}"]').bounding_box()
  assert abs(box['x']-(image['x']+t['x']*image['width']))<1
  assert abs(box['y']-(image['y']+t['y']*image['height']))<1
  assert abs(box['width']-t['w']*image['width'])<1
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1280,'height':900})
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'game.html#/group')
  expect(page.locator('#group-screen')).to_be_visible(timeout=20000)
  expect(page.locator('[data-destination="group"]')).to_have_attribute('aria-current','page')
  expect(page.locator('[data-game-nav] .nav-item')).to_have_count(5)
  page.locator('.gl-entry-hotspot[data-gl="create"]').click()
  page.locator('#gl-create-form [name="name"]').fill('沿線朋友')
  page.locator('#gl-create-form .gl-button').click()
  expect(page.locator('#gl-dialog')).not_to_be_visible()
  expect(page.locator('.gl-room-heading h1')).to_have_text('沿線朋友')
  expect(page.locator('.gl-avatars button')).to_have_count(2)
  aligned(page)
  page.screenshot(path='/workspace/work/guild-room-desktop.png')
  # 點圖片中的手帳，只允許已解鎖日記。
  page.locator('.gl-hotspot[data-gl="wall"]').click()
  expect(page.locator('#gl-share-form')).to_have_count(0)
  closed(page)
  page.evaluate("GameProgress.completeRuisui();GameProgress.saveNote('ruisui','和大家一起等一班慢車');EventStore.joinPhoto();")
  main=page.evaluate("localStorage.getItem('aming-diary-progress')")
  event=page.evaluate('localStorage.getItem(EventConfig.storageKey)')
  page.locator('.gl-hotspot[data-gl="wall"]').click()
  expect(page.locator('#gl-share-form')).to_be_visible()
  before=page.evaluate('GuildStore.current().draws')
  page.locator('#gl-share-form textarea').fill('<img src=x onerror=alert(1)> 一起旅行')
  page.locator('#gl-share-form .gl-button').click()
  expect(page.locator('.gl-post')).to_have_count(2)
  assert page.evaluate('GuildStore.current().draws')==before+1
  assert page.locator('.gl-post').first.inner_text().find('<img src=x')>=0
  assert page.locator('.gl-post').first.locator('img').count()==1
  expect(page.locator('#gl-share-form')).to_have_count(0)
  closed(page)
  # 新片與重複片都由真實資料交易產生。
  page.locator('.gl-hotspot[data-gl="puzzle"]').click()
  expect(page.locator('.gl-piece')).to_have_count(12)
  expect(page.locator('#gl-dialog')).to_be_visible()
  page.screenshot(path='/workspace/work/guild-puzzle-desktop.png')
  assert page.locator('.gl-piece.is-owned').first.evaluate('(e)=>getComputedStyle(e).backgroundImage').find('ruisui-memory')>=0
  page.evaluate('window.oldRandom=Math.random;Math.random=()=>.999')
  page.locator('[data-gl="draw"]').click()
  expect(page.locator('[data-gl="draw"]')).to_be_disabled()
  expect(page.locator('.gl-draw-result')).to_contain_text('獲得新的回憶拼圖')
  expect(page.locator('[data-gl="draw"]')).to_be_enabled()
  page.evaluate('Math.random=()=>0')
  points=page.evaluate('GuildStore.current().points')
  page.locator('[data-gl="draw"]').click()
  expect(page.locator('.gl-draw-result')).to_contain_text('重複的回憶')
  expect(page.locator('[data-gl="draw"]')).to_be_enabled()
  assert page.evaluate('GuildStore.current().points')==points+4
  page.evaluate('Math.random=oldRandom')
  for n in (7,8,9,10):page.locator(f'[data-piece="{n}"]').click()
  expect(page.locator('#gl-puzzle-progress')).to_contain_text('12/12')
  page.locator('[data-gl="reward"]').click();expect(page.locator('.gl-unlocked-cg')).to_be_visible();expect(page.locator('.gl-story')).to_contain_text('示範補充故事')
  page.locator('#gl-dialog [data-gl="puzzle"]').click();page.locator('[data-puzzle="limited"]').click()
  expect(page.locator('.gl-piece')).to_have_count(20)
  for n in range(10,20):page.locator(f'[data-piece="{n}"]').click()
  expect(page.locator('#gl-puzzle-progress')).to_contain_text('20/20')
  page.locator('[data-gl="reward"]').click();expect(page.locator('.gl-story')).to_be_visible();closed(page)
  print('PASS: 建立旅團、鎖定日記不分享、首次分享抽取、新片、重複轉點、兩種尺寸兌換完成與 CG 故事。',flush=True)
  # 成員頭像與管理操作。
  page.locator('.gl-avatars button').first.click();expect(page.locator('.gl-member')).to_have_count(2);closed(page)
  opened(page,'manage');code=page.locator('#gl-invite-code').inner_text()
  for _ in range(4):page.locator('[data-gl="invite"]').click()
  expect(page.locator('[data-gl="invite"]')).to_be_disabled()
  expect(page.locator('.gl-avatars button')).to_have_count(6)
  page.once('dialog',lambda d:d.accept());page.locator('[data-gl="leave"]').click()
  expect(page.locator('.gl-entry-hotspot[data-gl="join"]')).to_be_visible()
  page.locator('.gl-entry-hotspot[data-gl="join"]').click();page.locator('[data-join-mode="code"]').click();page.locator('[name="code"]').fill(code);page.locator('#gl-join-form .gl-button:not([type="button"])').click()
  opened(page,'manage');expect(page.locator('[data-gl="invite"]')).to_be_disabled();closed(page)
  page.reload();expect(page.locator('.gl-room-heading h1')).to_have_text('沿線朋友',timeout=20000)
  assert page.evaluate('GuildStore.current().puzzles.spring.owned.length')==12
  assert page.evaluate("localStorage.getItem('aming-diary-progress')")==main
  assert page.evaluate('localStorage.getItem(EventConfig.storageKey)')==event
  # 維持同一份 SPA 文件，原有導覽可返回。
  page.evaluate("window.documentToken='same'")
  for destination in ('home','explore','diary','event','group'):
   page.locator(f'[data-destination="{destination}"]').click()
   expect(page.locator(f'#{destination}-screen')).to_be_visible(timeout=20000)
   assert page.evaluate('window.documentToken')=='same'
  after_nav_main=page.evaluate("localStorage.getItem('aming-diary-progress')")
  opened(page,'manage');page.once('dialog',lambda d:d.accept());page.locator('[data-gl="reset"]').click()
  expect(page.locator('[data-gl="create"]')).to_be_visible()
  assert page.evaluate("localStorage.getItem('aming-diary-progress')")==after_nav_main
  assert page.evaluate('localStorage.getItem(EventConfig.storageKey)')==event
  print('PASS: 成員、滿團邀請、退出加入、團長移轉、重載、五項 SPA 導覽與重置不傷主線／活動。',flush=True)
  context.close()
  # 本機示範加入；手機可讀、熱區縮放對齊，沒加入也能離開推進單人探索。
  for width in (390,320):
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True)
   page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(BASE+'group.html');joined(page);aligned(page)
   page.screenshot(path=f'/workspace/work/guild-room-{width}.png')
   assert page.locator('#group-screen').evaluate('(e)=>e.scrollWidth<=innerWidth')
   page.locator('.gl-hotspot[data-gl="puzzle"]').tap();expect(page.locator('.gl-piece')).to_have_count(12)
   page.locator('[data-gl="draw"]').tap();expect(page.locator('[data-gl="draw"]')).to_be_enabled();closed(page)
   opened(page,'wall');expect(page.locator('.gl-post')).to_have_count(3);closed(page)
   opened(page,'members');expect(page.locator('.gl-member')).to_have_count(4);closed(page)
   page.set_viewport_size({'width':844,'height':390});aligned(page)
   context.close()
  context=browser.new_context();page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'game.html#/group');expect(page.locator('.gl-entry-hotspot[data-gl="create"]')).to_be_visible(timeout=20000)
  page.locator('[data-destination="explore"]').click();expect(page.locator('#explore-screen')).to_be_visible(timeout=20000)
  assert page.evaluate('GuildStore.current()') is None
  print('PASS: 320／390 手機、橫向 resize 熱區、示範加入及未加入旅團仍可探索。',flush=True)
  # 寫入失敗不得扣次數，也不應擋住錯誤訊息。
  context.close();context=browser.new_context();page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'group.html');joined(page);opened(page,'puzzle');before=page.evaluate('JSON.stringify(GuildStore.snapshot())')
  page.evaluate("() => { const oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===GuildConfig.storageKey)throw new DOMException('full','QuotaExceededError');return oldSet.call(this,k,v)}; }")
  page.locator('[data-gl="draw"]').click();expect(page.locator('#gl-notice')).to_be_visible();expect(page.locator('#gl-notice')).to_contain_text('未能保存')
  assert page.evaluate('JSON.stringify(GuildStore.snapshot())')==before
  assert page.locator('#gl-notice').evaluate('(e)=>e.closest("dialog")!==null')
  print('PASS: 儲存失敗不扣抽取次數，原資料保留且原生彈窗內錯誤可見。',flush=True)
  assert not errors,errors
  browser.close()
finally:server.shutdown()
