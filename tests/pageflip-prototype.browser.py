"""獨立翻頁除錯頁：五角度實際像素、舞台邊界與操作驗證。"""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
class Q(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Q,directory=str(Path(__file__).resolve().parents[1]/'aming-game')));Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 for width in [1280,390]:
  page=browser.new_page(viewport={'width':width,'height':844});page.goto(f'http://127.0.0.1:{server.server_port}/stpageflip-debug.html');page.wait_for_function('window.flip&&flip.getPageCount()===6')
  assert page.evaluate('flip.getSettings().showCover');page.locator('#next').click();page.wait_for_function('flip.getState()==="read"&&flip.getCurrentPageIndex()===1');page.locator('#inside').click();expect(page.locator('#clicked')).to_have_text('成功');page.locator('input').fill('HTML互動');page.locator('#next').click();page.wait_for_function('flip.getState()==="read"&&flip.getCurrentPageIndex()===3');page.locator('#prev').click();page.wait_for_function('flip.getState()==="read"&&flip.getCurrentPageIndex()===1');expect(page.locator('input')).to_have_value('HTML互動');page.locator('#prev').click();page.wait_for_function('flip.getState()==="read"&&flip.getCurrentPageIndex()===0');page.screenshot(path=f'/workspace/work/pageflip-debug-{width}.png');page.close();print('PASS HTML library prototype',width,flush=True)
 browser.close()
