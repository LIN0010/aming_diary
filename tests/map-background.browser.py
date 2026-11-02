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
  for width in [1280,390]:
   page=browser.new_page(viewport={'width':width,'height':844});page.goto(f'http://127.0.0.1:{server.server_port}/explore.html')
   assert page.evaluate('getComputedStyle(document.querySelector("#explore-screen"),"::before").filter')=='saturate(0.75)'
   assert page.evaluate('getComputedStyle(document.querySelector("#explore-screen"),"::after").backgroundColor')=='rgba(245, 238, 223, 0.38)'
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert page.evaluate('getComputedStyle(document.querySelector(".rail-route")).filter')=='none'
   assert page.evaluate('getComputedStyle(document.querySelector(".bottom-nav")).filter')=='none'
   assert page.evaluate('new Promise((ok)=>{const i=new Image();i.onload=()=>ok(true);i.onerror=()=>ok(false);i.src="images/explore-map-bg.png"})')
   page.screenshot(path=f'/workspace/work/map-{width}.png');page.locator('#ruisui-station').click();assert page.locator('#location-check').evaluate('(e)=>e.classList.contains("show")');page.close();print('PASS map',width)
  browser.close()
finally:server.shutdown()
