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
  for width in [1280,390,320]:
   page=browser.new_page(viewport={'width':width,'height':844});page.goto(f'http://127.0.0.1:{server.server_port}/group.html');page.locator('[data-gl="join"]').click()
   ids=page.evaluate('GuildStore.directory().map(g=>g.id)')
   for gid in ids:
    page.locator(f'[data-select-guild="{gid}"]').click();expect(page.locator('[data-apply]')).to_be_enabled();page.locator('[data-apply]').click();page.locator('.gl-close').click();page.locator('[data-gl="join"]').click()
   expect(page.locator('.gl-application-status')).to_have_count(3)
   for gid in ids:
    page.locator(f'[data-select-guild="{gid}"]').click();expect(page.locator('[data-apply]')).to_have_text('等待團長審核');expect(page.locator('[data-view-application]')).to_have_attribute('data-view-application',gid)
   page.locator(f'[data-select-guild="{ids[1]}"]').click();page.locator('[data-cancel-application]').click();expect(page.locator('.gl-application-status')).to_have_count(2);expect(page.locator('[data-apply]')).to_be_enabled()
   page.locator('[name="query"]').fill('沿線');expect(page.locator('.gl-application-status')).to_have_text('審核中');page.locator('[name="query"]').fill('')
   page.reload();expect(page.locator('#gl-dialog-title')).to_have_text('等待團長審核');page.locator('.gl-close').click();page.locator('[data-gl="join"]').click();expect(page.locator('.gl-application-status')).to_have_count(2)
   page.locator(f'[data-select-guild="{ids[0]}"]').click();page.locator('[data-view-application]').click();expect(page.locator('.gl-ticket-destination')).to_have_text('沿線慢慢走');page.locator('[data-gl="review-demo"]').click();page.locator('[data-approve="true"]').click()
   page.wait_for_function('!!GuildStore.current()&&!document.querySelector("#gl-dialog").open');assert page.evaluate('GuildStore.current().id')==ids[0]
   assert page.evaluate('GuildStore.snapshot().applications.filter(r=>r.status==="pending").length')==0
   page.close();print('PASS multi application',width)
  browser.close()
finally:server.shutdown()
