"""陣營結果明信片：兩種真實測驗結果、響應式與存檔／入口保留。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1440,900),(852,393),(667,375),(390,844)]:
   for answer,team in [(0,'blue'),(1,'sage')]:
    mobile=w<1000 and w>h;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}));page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/event?category=race');page.locator('[data-action="open-race"]').click();expect(page.locator('.ev-start-modal')).to_be_visible();page.locator('[data-action="begin-quiz"]').click()
    for n in range(3):
     expect(page.locator('#ev-question-progress')).to_have_text(f'{n+1} / 3');expect(page.locator('#ev-team-result')).to_have_count(0);page.locator(f'[data-answer="{answer}"]').click()
    card=page.locator('#ev-team-result');expect(card).to_be_visible();data=page.evaluate('(id)=>EventConfig.race.teams.find(t=>t.id===id)',team)
    expect(card.locator('h2')).to_contain_text(data['name']);expect(card.locator('.ev-postcard-message > p')).to_have_text(data['subtitle']);expect(card.locator('.ev-eyebrow')).to_have_text('YOUR JOURNEY BEGINS');expect(card.locator('.ev-muted')).to_have_text('依照你的三道旅行選擇完成分隊，結果已保存。')
    assert page.evaluate('EventStore.snapshot().team')==team;saved=page.evaluate('EventStore.snapshot()')
    assert card.evaluate('(e)=>getComputedStyle(e).backgroundImage.includes("repeating-linear-gradient")')
    expect(page.locator('.ev-postcard-landscape')).to_have_attribute('src',data['cover']['image'])
    assert page.locator('.ev-postcard-landscape').evaluate('async e=>{await e.decode();return e.naturalWidth>0&&getComputedStyle(e).objectFit==="cover"}')
    assert card.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    card.evaluate('e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))')
    a=page.locator('.ev-postcard-illustration').bounding_box();b=page.locator('.ev-postcard-copy').bounding_box()
    if w>540:assert a['x']+a['width']<=b['x']+1,(a,b)
    else:assert a['y']+a['height']<=b['y']+1,(a,b)
    assert page.locator('.ev-postcard-postage').evaluate('(e)=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.x>=b.x&&a.right<=b.right}')
    card.screenshot(path=f'/workspace/work/event-postcard-{team}-{w}.png')
    page.locator('[data-action="enter-race"]').click();expect(page.locator('.ev-team-grid')).to_be_visible();assert page.evaluate('EventStore.snapshot()')==saved
    page.reload();expect(page.locator('.ev-team-grid')).to_be_visible();assert page.evaluate('EventStore.snapshot()')==saved
    assert not errors,errors
    print('PASS postcard dynamic team / real quiz / paper layout / saved result & enter',team,w,h,flush=True);context.close()
  browser.close()
finally:server.shutdown()
