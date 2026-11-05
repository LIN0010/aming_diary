"""手機橫向 UI 健檢。Chromium + iPhone UA/觸控/standalone 旗標，非實機 Safari。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import shutil, re, os
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT/'aming-game')))
Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}/'
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'

def box(page, selector): return page.locator(selector).bounding_box()
def inside(page, selector):
    r = box(page, selector); assert r and r['width'] > 0 and r['height'] > 0, selector
    v = page.viewport_size
    assert r['x'] >= -1 and r['y'] >= -1 and r['x']+r['width'] <= v['width']+1 and r['y']+r['height'] <= v['height']+1, (selector,r,v)
    return r

def hit(page, selector):
    page.locator(selector).scroll_into_view_if_needed()
    assert page.locator(selector).evaluate('''e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;const target=document.elementFromPoint(x,y);return e===target||e.contains(target)}'''), selector

def no_overlap(a,b):
    assert min(a['x']+a['width'],b['x']+b['width'])-max(a['x'],b['x']) <= 1 or min(a['y']+a['height'],b['y']+b['height'])-max(a['y'],b['y']) <= 1,(a,b)

def shot(page, label):
    name=f"{page.viewport_size['width']}-{page.viewport_size['height']}"
    page.screenshot(path=f'/workspace/work/mobile-ui-{label}-{name}.png')

def scroll_end(page, selector):
    el=page.locator(selector);el.evaluate('(e)=>e.scrollTop=e.scrollHeight')
    assert el.evaluate('(e)=>e.scrollHeight<=e.clientHeight+1||e.scrollTop>0'),selector

def touch_scroll(page, selector):
    r=box(page,selector);session=page.context.new_cdp_session(page)
    x=r['x']+r['width']*.8; y=r['y']+r['height']*.85
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for step in range(1,9):session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-r['height']*.65*step/8}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});session.detach();page.wait_for_timeout(200)
    assert page.locator(selector).evaluate('(e)=>e.scrollTop>0'),selector

try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for standalone in (() if os.environ.get("UI_DESKTOP") else (True,) if os.environ.get("UI_STANDALONE") else (False,) if os.environ.get("UI_QUICK") else (False,True)):
   for width,height in ([(812,300)] if os.environ.get("UI_QUICK") else [(844,390),(667,375),(812,300)]):
    context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,user_agent=UA)
    context.add_init_script(f'Object.defineProperty(navigator,"standalone",{{get:()=>{str(standalone).lower()}}})')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR:',str(e),flush=True)))
    def goto(url):
     page.goto(BASE+url,wait_until="domcontentloaded");page.wait_for_function('document.documentElement.classList.contains("mobile-nav")');page.wait_for_timeout(150)
    # 首頁及地圖既有操作，確認最小高度也不與導覽重疊。
    goto('home.html');no_overlap(inside(page,'.player-panel'),inside(page,'.bottom-nav'));hit(page,'#save-progress');page.locator('#save-progress').tap();hit(page,'#aming-click-area');page.locator('#aming-click-area').tap();expect(page.locator('#aming-dialogue')).to_have_class(re.compile('show'));shot(page,'home')
    goto('explore.html');inside(page,'.bottom-nav');hit(page,'#ruisui-station');shot(page,'map')
    for n in range(1,8):
     inside(page,f'.station-{n} .dot');hit(page,f'.station-{n} .dot');page.locator(f'.station-{n}').tap()
     if n==5:page.wait_for_timeout(2100);page.locator('#mission-close').tap()
    # 只有瑞穗有正式探索場景；其他站點保留原本未開放狀態。
    page.locator('#ruisui-station').tap();expect(page.locator('#mission-card')).to_have_class(re.compile('show'));hit(page,'#start-mission');page.locator('#start-mission').tap()
    a=inside(page,'.station-header');b=inside(page,'.explore-mission');no_overlap(a,b)
    page.locator('.mission-toggle').tap();expect(page.locator('.mission-toggle')).to_have_attribute('aria-expanded','false');expect(page.locator('.mission-progress')).to_be_visible();page.locator('.mission-toggle').tap();shot(page,'ruisui')
    page.mouse.move(width*.8,height*.7);page.mouse.down();page.mouse.move(width*.15,height*.7,steps=10);page.mouse.up();page.locator('#cow-target').tap();hit(page,'#shutter-button');page.locator('#shutter-button').tap();expect(page.locator('#photo-success')).to_have_class(re.compile('show'),timeout=15000);hit(page,'#view-memory');shot(page,'camera')
    # 日記全內容捲動：照片比例、故事末段、碎片、上傳及儲存。
    goto('diary.html?station=ruisui');page.wait_for_function('document.querySelectorAll(".stf__item").length===16');inside(page,'.pf-frame');shot(page,'diary')
    page.locator('#aming-journal').evaluate('(e)=>e.scrollTop=0');touch_scroll(page,'#aming-journal')
    assert page.locator('.photo-card img').evaluate('(e)=>Math.abs(e.width/e.height-e.naturalWidth/e.naturalHeight)<.02')
    right='.pf-aming-right';scroll_end(page,right);shot(page,'diary-bottom');hit(page,'.memory-fragment-info')
    page.locator('#player-tab').tap();page.locator('#player-photo-input').set_input_files(str(ROOT/'aming-game/images/cow.png'));expect(page.locator('.player-photo')).to_have_class(re.compile('has-photo'))
    page.locator('#travel-note').fill('手機橫向保存測試');page.locator('#save-travel').tap();assert page.evaluate('GameProgress.snapshot().notes.ruisui')=='手機橫向保存測試'
    hit(page,'#memory-count');page.locator('#memory-count').tap();page.locator('#close-memory').tap();page.wait_for_timeout(450)
    # 進入沉浸模式，仍為雙頁，導覽隱藏且可以闔書離開。
    page.locator('[data-book="close"]').tap();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');page.locator('.pf-mode-switch input').check();page.locator('.pf-hard').first.tap();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');page.locator('#ruisui-journal').tap();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert page.locator('.bottom-nav').evaluate('(e)=>e.inert');inside(page,'.pf-frame');scroll_end(page,'#player-journal');page.locator('#travel-note').fill('沉浸式手機測試');page.locator('#save-travel').tap();page.locator('[data-book="close"]').tap();page.wait_for_function('!document.querySelector(".pf-book").hasAttribute("aria-busy")');assert not page.locator('.bottom-nav').evaluate('(e)=>e.inert')
    goto('event.html');page.locator('[data-action="next-activity"]').tap();page.locator('[data-action="open-race"]').tap();hit(page,'[data-action="begin-quiz"]');page.locator('[data-action="begin-quiz"]').tap()
    for q in range(3):
     expect(page.locator('#ev-question-progress')).to_have_text(f'{q+1} / 3');page.locator('[data-answer="0"]').tap()
    page.locator('[data-action="enter-race"]').tap();page.locator('[data-task]').first.tap();shot(page,'race');scroll_end(page,'.ev-scroll')
    goto('event.html?activity=photo');inside(page,'.ev-photo-panel:not([hidden])');shot(page,'photo')
    for name in ['tasks','album','submit']:
     hit(page,f'[data-photo-section="{name}"]');page.locator(f'[data-photo-section="{name}"]').tap();expect(page.locator(f'#ev-photo-panel-{name}')).to_be_visible();scroll_end(page,f'#ev-photo-panel-{name}')
    page.locator('#ev-photo-file').set_input_files(str(ROOT/'aming-game/images/cow.png'));expect(page.locator('.ev-upload-preview')).to_be_visible();page.locator('#ev-photo-title').fill('手機投稿');page.locator('#ev-submit-photo').tap();expect(page.locator('#ev-photo-count')).to_contain_text('8')
    # 加入/建立板夾與小屋各子功能必須可捲到並點擊。
    goto('group.html');shot(page,'guild-entry');page.locator('[data-gl="join"]').tap();expect(page.locator('.gl-roster-row')).to_have_count(3);hit(page,'.gl-roster-apply button');page.locator('.gl-roster-row').nth(1).tap();page.locator('#gl-search-form input').fill('迷途');expect(page.locator('.gl-roster-row')).to_have_count(1);page.locator('#gl-search-form input').fill('');shot(page,'guild-roster');scroll_end(page,'.gl-roster-info');hit(page,'.gl-roster-apply button');page.locator('.gl-roster-apply button').tap();expect(page.locator('.gl-application-status')).to_have_text('審核中');page.locator('[data-cancel-application]').tap();page.locator('[data-join-mode="code"]').tap();page.locator('input[name="code"]').fill('INVALID');page.locator('#gl-join-form button').last.tap();expect(page.locator('#gl-dialog')).to_be_visible();page.locator('[data-join-mode="apply"]').tap();page.locator('.gl-clipboard-back').tap()
    page.locator('[data-gl="create"]').tap();page.locator('input[name="name"]').fill('橫向測試團');page.locator('textarea[name="introduction"]').fill('旅行測試');hit(page,'#gl-create-form button');shot(page,'guild-create');page.locator('#gl-create-form button').tap();expect(page.locator('.gl-room-heading')).to_be_visible(timeout=10000);shot(page,'guild-room')
    for panel in ['wall','puzzle','members','manage']:
     selector='.gl-member-count' if panel=='members' else f'.gl-hotspot[data-gl="{panel}"]';hit(page,selector);page.locator(selector).tap();expect(page.locator('#gl-dialog')).to_be_visible();scroll_end(page,'#gl-dialog');hit(page,'.gl-close');page.locator('.gl-close').tap()
    # SPA 五頁快速切換後均收合，動畫遮罩可正常清除。
    goto('game.html#/home');expect(page.locator('#home-screen')).to_be_visible(timeout=60000)
    for name in ['explore','diary','event','group','home']:
     page.locator('.nav-toggle').tap();hit(page,f'[data-destination="{name}"]');page.locator(f'[data-destination="{name}"]').tap();page.wait_for_function('!TravelTransition.active');expect(page.locator('.nav-toggle')).to_have_attribute('aria-expanded','false');assert page.evaluate('GameNavigation.route(location.href).name')==name
    assert not errors,errors
    print('PASS all scenes',width,height,'standalone flag' if standalone else 'browser flag',flush=True);context.close()
  page=browser.new_page(viewport={'width':1280,'height':844});page.goto(BASE+'explore.html?station=ruisui',wait_until='domcontentloaded');expect(page.locator('.station-explore')).to_have_class(re.compile('show'));expect(page.locator('.mission-toggle')).to_be_hidden();no_overlap(box(page,'.station-header'),box(page,'.explore-mission'));assert page.locator('.station-hud').evaluate('(e)=>getComputedStyle(e).display')=='contents';page.close();print('PASS desktop exploration HUD preserved',flush=True)
  context=browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,user_agent=UA);page=context.new_page();page.goto(BASE+'event.html?activity=photo',wait_until='domcontentloaded');expect(page.locator('.ev-photo-menu')).to_have_attribute('aria-orientation','vertical');page.set_viewport_size({'width':390,'height':844});expect(page.locator('html')).not_to_have_class(re.compile('mobile-nav'));expect(page.locator('.ev-photo-menu')).to_have_attribute('aria-orientation','horizontal');page.set_viewport_size({'width':844,'height':390});expect(page.locator('.ev-photo-menu')).to_have_attribute('aria-orientation','vertical');context.close();print('PASS photo menu orientation follows viewport',flush=True)
  browser.close()
finally:server.shutdown()
