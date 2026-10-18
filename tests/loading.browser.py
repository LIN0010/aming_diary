"""真實載入進度測試：python tests/loading.browser.py（需要 Playwright 與 Chromium）。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import shutil

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'aming-game')))
BASE = f'http://127.0.0.1:{server.server_port}/'
Thread(target=server.serve_forever, daemon=True).start()
errors = []


def new_page(browser):
    context = browser.new_context(viewport={'width':1280, 'height':900})
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    return context, page


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
                                    headless=True, args=['--no-sandbox'])
        context, page = new_page(browser)
        held = []
        hold = [True]

        def hold_image(route):
            if hold[0]:
                held.append(route)
            else:
                route.continue_()

        page.route('**/images/aming.png', hold_image)
        page.goto(BASE)
        page.evaluate("""() => {
            window.percentages = [];
            new MutationObserver(() => percentages.push(Number(document.getElementById('percentage').textContent)))
                .observe(document.getElementById('percentage'), {childList:true, subtree:true});
        }""")
        page.locator('#start-btn').click()
        page.wait_for_function("Number(document.getElementById('percentage').textContent) > 0")
        page.wait_for_timeout(300)
        assert held, '目標圖片必須真的提出載入請求'
        before = page.locator('#percentage').inner_text()
        assert int(before) < 100
        page.wait_for_timeout(350)
        expect(page.locator('#percentage')).to_have_text(before)
        expect(page).to_have_url(BASE)
        assert page.evaluate("localStorage.getItem('aming-diary-progress')") is None
        hold[0] = False
        for route in held:
            route.continue_()
        page.wait_for_function("document.getElementById('percentage').textContent === '100'")
        percentages = page.evaluate('window.percentages')
        assert percentages == sorted(percentages), percentages
        expect(page.locator('#loading-progress')).to_have_attribute('aria-valuenow', '100')
        page.wait_for_url(BASE + 'home.html')
        print('PASS: 圖片延遲時百分比停住，不提前進場或執行目標頁程式；載入後才到 100%', flush=True)

        page.unroute('**/images/aming.png', hold_image)
        page.go_back()
        expect(page.locator('#start-btn')).to_be_visible()
        expect(page.locator('#start-btn')).to_be_enabled()
        page.locator('#start-btn').click()
        page.wait_for_url(BASE + 'home.html')
        print('PASS: 回到入口後仍可繼續，快取資源也能完成真實載入', flush=True)
        context.close()

        context, page = new_page(browser)
        fail = [True]

        def fail_script(route):
            if fail[0]:
                route.fulfill(status=503, body='temporarily unavailable')
            else:
                route.continue_()

        page.route('**/js/home.js', fail_script)
        page.goto(BASE)
        page.locator('#start-btn').click()
        expect(page.locator('#retry-loading')).to_be_visible()
        assert int(page.locator('#percentage').inner_text()) < 100
        expect(page).to_have_url(BASE)
        expect(page.locator('#loading-status')).to_contain_text('未能載入')
        fail[0] = False
        page.locator('#retry-loading').click()
        page.wait_for_url(BASE + 'home.html')
        print('PASS: 程式載入失敗不會顯示完成或跳頁；恢復後能重試', flush=True)
        context.close()

        context, page = new_page(browser)

        def invalid_image(route):
            route.fulfill(status=200, content_type='image/png', body=b'not an image')

        page.route('**/images/aming.png', invalid_image)
        page.goto(BASE)
        page.locator('#start-btn').click()
        expect(page.locator('#retry-loading')).to_be_visible()
        assert int(page.locator('#percentage').inner_text()) < 100
        expect(page).to_have_url(BASE)
        page.unroute('**/images/aming.png', invalid_image)
        page.locator('#retry-loading').click()
        page.wait_for_url(BASE + 'home.html')
        print('PASS: HTTP 成功但圖片損壞仍視為失敗，修復圖片後可重試', flush=True)
        context.close()

        context, page = new_page(browser)
        timeout_routes = []
        page.route('**/images/aming.png', lambda route: timeout_routes.append(route))
        page.goto(BASE)
        result = page.evaluate("""async () => {
            const values = [];
            try {
                await JourneyLoader.load('home.html', (done, total) => values.push(done / total), {timeoutMs:150});
                return {timedOut:false};
            } catch (error) {
                return {timedOut:error.message.includes('逾時'), complete:values.includes(1)};
            }
        }""")
        assert result == {'timedOut':True, 'complete':False}, result
        for route in timeout_routes:
            route.abort()
        page.unroute_all(behavior='wait')
        print('PASS: 請求卡住會逾時結束，不會虛報 100%', flush=True)
        context.close()

        assert not errors, errors
        browser.close()
        print('PASS: 所有載入測試沒有 JavaScript 執行錯誤', flush=True)
finally:
    server.shutdown()
    server.server_close()
