"""小屋物件熱區、成員資訊入口與共用背景座標；桌面／橫向觸控模擬。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'aming-game')))
Thread(target=server.serve_forever,daemon=True).start()
def target(page,selector):
 # 找到可視且未被 HUD／底部導覽遮擋的實際觸控點。
 return page.locator(selector).evaluate('''e=>{const r=e.getBoundingClientRect();for(let y=Math.max(0,r.top)+8;y<Math.min(innerHeight,r.bottom)-8;y+=8)for(let x=Math.max(0,r.left)+8;x<Math.min(innerWidth,r.right)-8;x+=8)if(e.contains(document.elementFromPoint(x,y)))return {x,y};return null;}''')
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1280,900),(1920,1080),(844,390),(812,300),(667,375)]:
   mobile=w<1000;context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'} if mobile else {}))
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/game.html#/group');page.wait_for_function('window.GuildStore')
   assert page.evaluate("GuildStore.join('RAIL2027').ok")
   page.reload();expect(page.locator('.gl-room-heading h1')).to_have_text('沿線慢慢走')
   saved=page.evaluate('localStorage.getItem(GuildConfig.storageKey)')
   expect(page.locator('#gl-menu,.gl-room-menu')).to_have_count(0)
   expect(page.locator('.gl-hotspot[data-gl="puzzle"]')).to_have_count(1)
   image=page.locator('.gl-room-bg').bounding_box()
   boxes=[]
   for t in page.evaluate('GuildConfig.room.hotspots'):
    selector=f'.gl-hotspot[data-gl="{t["id"]}"]';box=page.locator(selector).bounding_box();boxes.append(box)
    assert abs(box['x']-(image['x']+t['x']*image['width']))<1
    assert abs(box['y']-(image['y']+t['y']*image['height']))<1
    assert abs(box['width']-t['w']*image['width'])<1
    assert target(page,selector),(w,h,t,box)
   for a,b in [(boxes[0],boxes[1]),(boxes[1],boxes[2]),(boxes[0],boxes[2])]:
    assert min(a['x']+a['width'],b['x']+b['width'])<=max(a['x'],b['x']) or min(a['y']+a['height'],b['y']+b['height'])<=max(a['y'],b['y'])
   label=page.locator('.gl-hotspot[data-gl="manage"] span');assert label.evaluate('(e)=>{const r=e.getBoundingClientRect();return e.parentElement.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
   page.screenshot(path=f'/workspace/work/guild-object-room-{w}-{h}.png')
   for action,title in [('wall','旅團旅行牆'),('puzzle','一起拼回旅途的光'),('manage','旅團資訊'),('members','一起旅行的夥伴')]:
    selector=f'.gl-hotspot[data-gl="{action}"]' if action!='members' else '.gl-member-count'
    point=target(page,selector);assert point,(w,h,selector)
    if mobile:page.touchscreen.tap(**point)
    else:page.mouse.click(**point)
    expect(page.locator('#gl-dialog')).to_be_visible();expect(page.locator('#gl-dialog-title')).to_have_text(title)
    page.locator('.gl-close').click();expect(page.locator('#gl-dialog')).not_to_be_visible()
   page.locator('.gl-avatars button').first.focus();page.keyboard.press('Enter');expect(page.locator('.gl-member')).to_have_count(4);page.locator('.gl-close').click()
   page.locator('.gl-hotspot[data-gl="wall"]').focus();page.keyboard.press('Enter');expect(page.locator('#gl-dialog-title')).to_have_text('旅團旅行牆');page.locator('.gl-close').click()
   assert page.evaluate('localStorage.getItem(GuildConfig.storageKey)')==saved
   assert not errors,errors
   print('PASS object navigation, alignment, keyboard/touch, unchanged save',w,h,flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
