"""旅團名冊選取、真實進度、獨立捲動與響應式檢查。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil
class Q(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Q,directory=str(Path(__file__).resolve().parents[1]/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for width,height in [(1280,800),(390,844),(320,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});page.goto(f'http://127.0.0.1:{server.server_port}/group.html');page.locator('[data-gl="join"]').click()
   expect(page.locator('.gl-roster-row').first).to_have_attribute('aria-pressed','true');expect(page.locator('.gl-roster-detail h3')).to_have_text('沿線慢慢走')
   expect(page.locator('.gl-roster-detail progress')).to_have_count(0)
   img=page.locator('.gl-roster-info header img');expect(img).to_be_visible()
   assert img.evaluate('(e)=>e.complete&&e.naturalWidth>0')
   detail=page.locator('.gl-roster-detail').bounding_box();pic=img.bounding_box();assert abs(pic['x']+pic['width']/2-detail['x']-(detail['width']-float(page.locator('.gl-roster-detail').evaluate('(e)=>parseFloat(getComputedStyle(e).paddingRight)'))-1)/2)<2
   expect(page.locator('.gl-roster-detail')).to_contain_text('7 / 12');expect(page.locator('.gl-roster-detail')).not_to_contain_text('旅行牆紀錄');expect(page.locator('.gl-roster-detail')).not_to_contain_text('本機模擬旅團')
   assert page.locator('.gl-roster-row span').all_text_contents()==['沿線慢慢走','星光末班車','迷途旅人協會']
   assert len(set(page.locator('.gl-roster-row img').evaluate_all('(es)=>es.map(e=>e.getAttribute("src"))')))==3
   page.locator('.gl-roster-row').nth(1).click();expect(page.locator('.gl-guild-count')).to_contain_text('4 / 6');expect(page.locator('.gl-guild-introduction')).to_have_text('錯過末班車也沒關係，我們陪你等天亮。')
   page.locator('.gl-roster-row').nth(2).click();expect(page.locator('.gl-guild-count')).to_contain_text('2 / 6');expect(page.locator('.gl-guild-introduction')).to_have_text('方向感不好沒關係，反正每條路都有風景。')
   # 只在測試工作階段複製示範資料，不變更產品資料格式或建立額外正式旅團。
   page.evaluate("""()=>{const s=GuildStore.snapshot(),g=s.guilds[0];for(let i=0;i<9;i++){const x=structuredClone(g);x.id='fixture-'+i;x.code='FIX'+i;x.name='測試旅團'+i;if(i===1)x.avatar='images/ruisui-bg.jpg';x.introduction='本機測試資料';x.puzzles.spring.owned=[0,1];x.posts=[];s.guilds.push(x);}localStorage.setItem(GuildConfig.storageKey,JSON.stringify(s));GuildStore.refresh();}""")
   page.locator('.gl-roster-row').nth(4).click();expect(page.locator('.gl-roster-detail h3')).to_have_text('測試旅團1');expect(page.locator('.gl-roster-detail')).to_contain_text('2 / 12')
   assert page.locator('.gl-roster-row[aria-pressed="true"] img').get_attribute('src')==page.locator('.gl-roster-info header img').get_attribute('src')=='images/ruisui-bg.jpg'
   expect(page.locator('.gl-roster-row img')).to_have_count(12)
   a=page.locator('.gl-roster-detail').bounding_box();r=page.locator('.gl-roster-list').bounding_box();assert abs(a['width']/r['width']-45/55)<.03
   field=page.locator('[name="query"]');field.focus();assert field.evaluate('(e)=>getComputedStyle(e).borderTopWidth')=='0px';assert field.evaluate('(e)=>getComputedStyle(e).outlineStyle')=='none'
   page.locator('[name="query"]').fill('測試');expect(page.locator('.gl-roster-detail h3')).to_have_text('測試旅團1')
   page.locator('[name="query"]').fill('旅團7');expect(page.locator('.gl-roster-detail h3')).to_have_text('測試旅團7')
   page.locator('[name="query"]').fill('找不到');expect(page.locator('.gl-guild-directory')).to_have_text('找不到符合條件的旅團');expect(page.locator('[data-apply]')).to_have_count(0)
   page.locator('[name="query"]').fill('');expect(page.locator('.gl-roster-detail h3')).to_have_text('沿線慢慢走')
   page.locator('#gl-dialog').evaluate('(e)=>Promise.all(e.getAnimations().map(a=>a.finished))')
   board=page.locator('#gl-dialog').bounding_box();cross=page.locator('.gl-close').bounding_box();assert cross['x']+cross['width']<=board['x']+.77*board['width']
   box=page.locator('#gl-dialog').bounding_box();detail=page.locator('.gl-roster-detail').bounding_box();page.locator('.gl-guild-directory').evaluate('(e)=>e.scrollTop=10000');assert page.locator('.gl-guild-directory').evaluate('(e)=>e.scrollTop')>0
   assert page.locator('#gl-dialog').bounding_box()==box and page.locator('.gl-roster-detail').bounding_box()==detail
   paper=page.locator('#gl-dialog-content').bounding_box()
   for selector in ['.gl-roster-detail','.gl-roster-list']:
    r=page.locator(selector).bounding_box();assert r['x']>=paper['x'] and r['x']+r['width']<=paper['x']+paper['width']+1 and r['y']+r['height']<=paper['y']+paper['height']+1
   page.screenshot(path=f'/workspace/work/roster-{width}.png')
   page.locator('[data-join-mode="code"]').click();page.locator('[data-join-mode="apply"]').click();expect(page.locator('.gl-roster')).to_be_visible()
   page.locator('[name="query"]').fill('旅團7');target=page.locator('[data-apply]').get_attribute('data-apply');page.locator('[data-apply]').click();expect(page.locator('#gl-dialog-title')).to_have_text('等待團長審核');assert page.evaluate('GuildStore.latestApplication().guildId')==target
   page.locator('.gl-close').click();expect(page.locator('#gl-dialog')).not_to_be_visible();page.close();print(f'PASS {width}: default/select/filter/progress/scroll/bounds/invite-mode/apply target')
  for width in [1280,390,320]:
   page=browser.new_page(viewport={'width':width,'height':844});page.goto(f'http://127.0.0.1:{server.server_port}/group.html');page.locator('[data-gl="create"]').click()
   expect(page.locator('.gl-avatar-picker img')).to_have_count(5)
   page.wait_for_function('Array.from(document.querySelectorAll(".gl-avatar-picker img")).every(e=>e.complete&&e.naturalWidth===1024)')
   expect(page.locator('[name="avatarId"][value="station"]')).to_be_checked()
   for value in ['compass','ocean','journal','moon','station']:
    page.locator(f'[name="avatarId"][value="{value}"]').check();expect(page.locator(f'[name="avatarId"][value="{value}"]')).to_be_checked()
   page.locator('[name="avatarId"][value="ocean"]').check();page.locator('[name="name"]').fill('海洋旅團');page.locator('#gl-create-form button').click()
   page.wait_for_function('!document.querySelector("#gl-dialog").open');expect(page.locator('.gl-room-heading > img')).to_have_attribute('src','images/guild-ocean.png')
   page.reload();expect(page.locator('.gl-room-heading > img')).to_have_attribute('src','images/guild-ocean.png')
   assert page.evaluate('GuildStore.current().avatarId')=='ocean'
   page.close();print(f'PASS {width}: five assets, selection, create, room portrait, reload')
  browser.close()
finally:server.shutdown()
