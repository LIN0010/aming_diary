"""獨立翻頁除錯頁：五角度實際像素、舞台邊界與操作驗證。"""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import shutil
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 from PIL import Image
 from io import BytesIO
 import math
 for width in [1280,390]:
  page=browser.new_page(viewport={'width':width,'height':844});page.set_content((Path(__file__).resolve().parents[1]/'aming-game/book-debug.html').read_text());stage=page.locator('.stage');original=stage.bounding_box();font=page.locator('.front').evaluate('(e)=>getComputedStyle(e).fontSize')
  for angle in [0,45,90,135,180]:
   page.locator('#angle').evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));}',angle);assert stage.bounding_box()==original
   assert page.locator('.front').evaluate('(e)=>getComputedStyle(e).fontSize')==font
   for selector in ['.front','.back','.right-page']:
    r=page.locator(selector).bounding_box();assert r['x']>=original['x']-1 and r['y']>=original['y']-1 and r['x']+r['width']<=original['x']+original['width']+1 and r['y']+r['height']<=original['y']+original['height']+1
   png=page.screenshot(path=f'/workspace/work/book-debug-{width}-{angle}.png');im=Image.open(BytesIO(png)).convert('RGB');colors=im.getcolors(im.width*im.height);counts={color:n for n,color in colors};brown=counts.get((74,47,34),0);red=counts.get((197,48,56),0);blue=counts.get((36,89,187),0)
   if angle==0:assert brown>1000 and red==0 and blue<10
   elif angle==45:assert brown>1000 and blue>1000 and red==0
   elif angle==90:assert blue>1000 and brown<10 and red<10
   elif angle==135:assert red>1000 and blue>1000 and brown==0
   else:assert red>1000 and blue>1000 and brown==0
  page.locator('#close').click();page.wait_for_function('document.querySelector("#angle").value==="0"');page.locator('#open').click();page.wait_for_function('document.querySelector("#angle").value==="180"');page.locator('#close').click();page.locator('#angle').evaluate('(e)=>{e.value=45;e.dispatchEvent(new Event("input",{bubbles:true}));}');page.wait_for_timeout(100);assert page.locator('#angle').input_value()=='45'
  page.close();print('PASS fixed stage, five-angle screenshots/colors/bounds, buttons and slider',width)
 browser.close()
