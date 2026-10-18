"""共用場景與漸進單頁測試：python tests/scenes.browser.py。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import shutil
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
errors = []

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'aming-game')))
BASE = f'http://127.0.0.1:{server.server_port}/'
Thread(target=server.serve_forever, daemon=True).start()

def ready(page, scene):
    expect(page.locator('#scene-loading')).to_be_hidden(timeout=20000)
    expect(page.locator(f'#{scene}-screen')).to_be_visible()
    expect(page.locator('#scene-host > main')).to_have_count(1)
    expect(page.locator('[data-game-nav]')).to_have_count(1)
    expect(page.locator(f'[data-destination="{scene}"]')).to_have_attribute('aria-current', 'page')

def nav(page, scene):
    page.locator(f'[data-destination="{scene}"]').click()
    ready(page, scene)

def state(page):
    return page.evaluate('GameProgress.snapshot()')

def report(message):
    print('PASS:', message, flush=True)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
                                    headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1280, 'height':900})
        context.add_init_script('''
            window.listeners = [];
            const add = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, callback, options) {
                if (this === window && options?.signal) listeners.push({type, signal: options.signal});
                return add.call(this, type, callback, options);
            };
        ''')
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE)
        page.locator('#continuous-journey').click()
        ready(page, 'home')
        page.goto(BASE + 'game.html#/home')
        ready(page, 'home')
        page.evaluate('window.documentToken = {}; window.oldToken = documentToken; window.sharedNav = document.querySelector("nav"); window.oldMemoryCount = document.getElementById("memory-count");')
        page.locator('#journey-next').click()
        ready(page, 'explore')
        expect(page.locator('#station-explore')).to_have_class('station-explore show')
        page.mouse.move(1024, 630)
        page.mouse.down()
        page.mouse.move(192, 630, steps=10)
        page.mouse.up()
        page.locator('#cow-target').click()
        page.locator('#shutter-button').click()
        expect(page.locator('#photo-success')).to_have_class('photo-success show')
        page.locator('#view-memory').click()
        ready(page, 'diary')
        assert state(page)['readMemories'] == ['ruisui-01']
        assert page.evaluate('oldMemoryCount.textContent') == '0'
        page.locator('#player-tab').click()
        page.locator('#travel-note').fill('同一頁的瑞穗旅程')
        nav(page, 'home')
        assert state(page)['notes']['ruisui'] == '同一頁的瑞穗旅程'
        expect(page.locator('#memory-count')).to_have_text('1')
        assert page.evaluate('documentToken === oldToken && sharedNav === document.querySelector("nav")')
        page.go_back()
        ready(page, 'diary')
        expect(page.locator('#player-journal')).to_have_class('journal journal-content active')
        expect(page.locator('#travel-note')).to_have_value('同一頁的瑞穗旅程')
        page.go_forward()
        ready(page, 'home')
        page.reload()
        ready(page, 'home')
        report('瑞穗探索→拍照→閱讀→心得→首頁全程不重載文件；共享導覽、存檔、上一頁／下一頁與重新整理正常')

        page.goto(BASE + 'game.html#/explore?station=ruisui')
        ready(page, 'explore')
        page.locator('#leave-station').click()
        expect(page).to_have_url(BASE + 'game.html#/explore')
        page.go_back()
        ready(page, 'explore')
        expect(page.locator('#station-explore')).to_have_class('station-explore show')
        page.go_forward()
        ready(page, 'explore')
        expect(page.locator('#station-explore')).not_to_have_class('station-explore show')
        page.locator('#ruisui-station').click()
        nav(page, 'home')
        page.wait_for_timeout(2000)
        assert state(page)['lastScene'] == 'home'
        for _ in range(4):
            nav(page, 'explore')
            nav(page, 'diary')
            assert page.evaluate('listeners.filter(x => !x.signal.aborted).length') == 2
            nav(page, 'home')
            assert page.evaluate('listeners.filter(x => !x.signal.aborted).length') == 0
        assert page.locator('link[href="css/home.css"]').count() == 1
        assert page.locator('link[href="css/explore.css"], link[href="css/diary.css"]').count() == 0
        # 已卸載的相機不能在離開後發獎勵，連結攔截只處理本遊戲目錄。
        page.evaluate("localStorage.removeItem('aming-diary-progress')")
        page.reload()
        ready(page, 'home')
        page.evaluate("location.hash = '#/explore?station=ruisui'")
        ready(page, 'explore')
        page.evaluate('''() => {
            window.oldCow = document.getElementById('cow-target');
            oldCow.click(); document.getElementById('shutter-button').click();
            document.querySelector('[data-destination="home"]').click();
        }''')
        ready(page, 'home')
        before = state(page)['collectedMemories']
        page.evaluate('oldCow.click()')
        page.wait_for_timeout(700)
        assert before == []
        assert state(page)['collectedMemories'] == []
        assert page.evaluate("GameNavigation.route('/other/home.html') === null && GameNavigation.route('https://example.com/home.html') === null && GameNavigation.route('game.html#/missing') === null")
        report('場景內深層網址可前後移動；反覆切換不累加視窗事件或樣式；定位與快門計時器會清除')
        context.close()

        context = browser.new_context(viewport={'width':1280, 'height':900})
        context.add_init_script('''
            window.failWrites = false;
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (window.failWrites) throw new DOMException('full', 'QuotaExceededError');
                return original.call(this, key, value);
            };
        ''')
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + 'game.html#/home')
        ready(page, 'home')
        nav(page, 'diary')
        page.locator('#ruisui-journal').click()
        page.locator('#player-tab').click()
        page.evaluate('window.failWrites = true')
        page.locator('#travel-note').fill('不能遺失的心得')
        page.locator('[data-destination="home"]').click()
        expect(page.locator('#travel-note')).to_have_value('不能遺失的心得')
        expect(page).to_have_url(BASE + 'game.html#/diary?station=ruisui&tab=player')
        page.go_back()
        expect(page).to_have_url(BASE + 'game.html#/diary?station=ruisui&tab=player')
        expect(page.locator('#scene-loading')).to_be_hidden()
        page.evaluate('window.failWrites = false')
        nav(page, 'home')
        assert state(page)['notes']['ruisui'] == '不能遺失的心得'
        report('心得儲存失敗時阻止導覽與瀏覽器返回；恢復寫入後可保存並繼續')
        context.close()

        context = browser.new_context(viewport={'width':1280, 'height':900})
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + 'game.html#/home')
        ready(page, 'home')
        fail = [True]
        def fail_html(route):
            if fail[0]: route.fulfill(status=503, body='unavailable')
            else: route.continue_()
        page.route('**/explore.html', fail_html)
        page.locator('[data-destination="explore"]').click()
        expect(page.locator('#scene-retry')).to_be_visible()
        expect(page).to_have_url(BASE + 'game.html#/home')
        assert state(page)['lastScene'] == 'home'
        expect(page.locator('#home-screen')).to_be_attached()
        fail[0] = False
        page.locator('#scene-retry').click()
        ready(page, 'explore')
        page.go_back()
        ready(page, 'home')
        held = []
        def hold_image(route): held.append(route)
        page.route('**/js/explore.js', hold_image)
        page.locator('[data-destination="explore"]').click()
        page.wait_for_function('document.getElementById("scene-progress").value > 0')
        page.wait_for_timeout(150)
        assert held
        assert page.locator('#scene-progress').evaluate('(el) => el.value') < 100
        page.locator('#scene-cancel').click()
        ready(page, 'home')
        for route in held: route.abort()
        page.unroute('**/js/explore.js', hold_image)
        page.evaluate("location.hash = '#/explore'; location.hash = '#/diary'")
        ready(page, 'diary')
        assert page.locator('link[href="css/explore.css"]').count() == 0
        page.evaluate("location.hash = '#/unavailable'")
        expect(page).to_have_url(BASE + 'game.html#/diary')
        report('載入失敗保留舊場景並可重試；真實資源進度不提前補滿；取消、快速換場與無效路由可回復')
        context.close()

        for width in (320, 390):
            context = browser.new_context(viewport={'width':width, 'height':844}, is_mobile=True, has_touch=True)
            page = context.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(BASE + 'game.html#/diary?station=ruisui&tab=player')
            ready(page, 'diary')
            expect(page.locator('#travel-note')).to_be_visible()
            assert state(page)['readMemories'] == []
            page.locator('#travel-note').fill(f'{width} 手機心得')
            nav(page, 'home')
            page.reload()
            ready(page, 'home')
            assert state(page)['notes']['ruisui'] == f'{width} 手機心得'
            page.goto(BASE + 'home.html')
            expect(page.locator('#memory-count')).to_have_text('0')
            page.locator('[data-destination="diary"]').click()
            page.locator('#ruisui-journal').click()
            page.locator('#player-tab').click()
            expect(page.locator('#travel-note')).to_have_value(f'{width} 手機心得')
            page.goto(BASE + 'game.html')
            ready(page, 'diary')
            expect(page.locator('#travel-note')).to_have_value(f'{width} 手機心得')
            expect(page.locator('#player-journal')).to_have_class('journal journal-content active')
            context.close()
        report('320／390 手機深層入口、心得保存與新舊多頁入口相容')
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
