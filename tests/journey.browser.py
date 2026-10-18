"""本機端到端測試：python tests/journey.browser.py（需要 Playwright 與 Chromium）。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import os
import shutil

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
KEY = 'aming-diary-progress'
errors = []
passed = []


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def report(message):
    passed.append(message)
    print('PASS:', message, flush=True)


def watch(page):
    page.on('pageerror', lambda error: errors.append(str(error)))
    return page


def state(page):
    return page.evaluate('GameProgress.snapshot()')


def drag_to_cow(page):
    width, height = page.viewport_size.values()
    page.mouse.move(width * .8, height * .7)
    page.mouse.down()
    page.mouse.move(width * .15, height * .7, steps=10)
    page.mouse.up()
    page.locator('#cow-target').click()


def shoot(page):
    page.locator('#shutter-button').click()
    expect(page.locator('#photo-success')).to_have_class('photo-success show')


def continue_from_start(page, expected_url):
    page.goto(BASE)
    expect(page.locator('#start-btn')).to_have_text('繼續旅程')
    page.locator('#start-btn').click()
    page.wait_for_url(BASE + expected_url, timeout=20000)


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'aming-game')))
BASE = f'http://127.0.0.1:{server.server_port}/'
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        browser = p.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1280, 'height':900})
        page = watch(context.new_page())
        page.goto(BASE)
        expect(page.locator('#start-btn')).to_have_text('開始遊戲')
        page.locator('#start-btn').click()
        page.wait_for_url(BASE + 'home.html', timeout=20000)
        expect(page.locator('#memory-count')).to_have_text('0')
        page.locator('#save-progress').click()
        expect(page.locator('#save-status')).to_have_text('✓ 旅程已儲存')
        page.locator('#journey-next').click()
        expect(page.locator('#station-explore')).to_have_class('station-explore show')
        page.reload()
        expect(page.locator('#station-explore')).to_have_class('station-explore show')
        assert state(page)['visitedStations'] == ['ruisui']
        saved_context = context.storage_state()
        context.close()
        context = browser.new_context(viewport={'width':1280, 'height':900}, storage_state=saved_context)
        page = watch(context.new_page())
        continue_from_start(page, 'explore.html?station=ruisui')
        expect(page.locator('#station-explore')).to_have_class('station-explore show')
        report('新遊戲、手動儲存、探索中重新整理、關閉後從入口繼續原場景')

        drag_to_cow(page)
        page.evaluate("document.getElementById('shutter-button').click(); document.getElementById('close-camera').click();")
        page.wait_for_timeout(700)
        assert state(page)['collectedMemories'] == []
        drag_to_cow(page)
        shoot(page)
        expect(page.locator('#photo-result')).to_have_text('已找回一段新記憶')
        assert state(page)['collectedMemories'] == ['ruisui-01']
        page.locator('#close-camera').click()
        drag_to_cow(page)
        shoot(page)
        expect(page.locator('#photo-result')).to_have_text('這段回憶已收藏')
        assert state(page)['collectedMemories'] == ['ruisui-01']
        page.reload()
        expect(page.locator('#scene-diary')).to_be_visible()
        expect(page.locator('.mission-progress')).to_have_text('1 / 1')
        unread_context = context.storage_state()
        page.locator('#scene-diary').click()
        expect(page.locator('#aming-journal .diary-entry')).to_be_visible()
        expect(page.locator('#journey-return')).to_be_visible()
        assert state(page)['readMemories'] == ['ruisui-01']
        page.locator('#journey-return').click()
        page.locator('#ruisui-station').click()
        expect(page.locator('.mission-tag')).to_have_text('JOURNEY COMPLETE')
        page.locator('#mission-diary').click()
        expect(page.locator('#journey-return')).to_be_visible()
        report('取消／重拍不重複獲得；重新載入可直接閱讀；完成後返回地圖並重溫日記')

        page.locator('#player-tab').click()
        page.locator('#travel-note').fill('停下來寫一段瑞穗旅程，不必另外按儲存。')
        expect(page.locator('.travel-saved')).to_have_text('✓ 已記錄這段旅程')
        page.reload()
        expect(page.locator('#player-journal')).to_have_class('journal journal-content active')
        expect(page.locator('#travel-note')).to_have_value('停下來寫一段瑞穗旅程，不必另外按儲存。')
        continue_from_start(page, 'diary.html?station=ruisui&tab=player')
        expect(page.locator('#player-journal')).to_have_class('journal journal-content active')
        page.locator('#back-to-index').click()
        continue_from_start(page, 'diary.html')
        expect(page.locator('#diary-index')).to_be_visible()
        page.goto(BASE + 'home.html')
        expect(page.locator('#memory-count')).to_have_text('1')
        expect(page.locator('#journey-next')).to_have_text('瑞穗・第一段記憶已完成')
        report('心得自動儲存；重新進入保留日記頁籤、文字及目錄位置，首頁顯示完成狀態')
        context.close()

        context = browser.new_context(storage_state=unread_context)
        page = watch(context.new_page())
        page.goto(BASE + 'diary.html?station=ruisui&tab=player')
        assert state(page)['readMemories'] == []
        page.locator('#travel-note').fill('尚未閱讀阿明故事時的心得')
        page.reload()
        expect(page.locator('#travel-note')).to_have_value('尚未閱讀阿明故事時的心得')
        assert state(page)['readMemories'] == []
        continue_from_start(page, 'diary.html?station=ruisui&tab=player')
        assert state(page)['readMemories'] == []
        page.locator('#aming-tab').click()
        assert state(page)['readMemories'] == ['ruisui-01']
        report('只看自己的旅程不會誤標故事已讀；立即離頁的心得也會保存')
        context.close()

        context = browser.new_context(viewport={'width':1280, 'height':900})
        context.add_init_script("""
            window.failWrites = sessionStorage.getItem('writes-recovered') !== '1';
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (window.failWrites) throw new DOMException('full', 'QuotaExceededError');
                return original.call(this, key, value);
            };
        """)
        page = watch(context.new_page())
        page.goto(BASE + 'explore.html?station=ruisui')
        drag_to_cow(page)
        shoot(page)
        expect(page.locator('#photo-result')).to_have_text('已找到回憶，尚未儲存')
        page.locator('#view-memory').click()
        expect(page).to_have_url(BASE + 'explore.html?station=ruisui')
        page.locator('#close-camera').click()
        page.locator('#scene-diary').click()
        expect(page).to_have_url(BASE + 'explore.html?station=ruisui')
        page.evaluate("window.failWrites = false; sessionStorage.setItem('writes-recovered', '1')")
        page.locator('#progress-warning button').click()
        expect(page.locator('#progress-warning')).to_be_hidden()
        page.locator('#scene-diary').click()
        expect(page.locator('#journey-return')).to_be_visible()
        assert state(page)['collectedMemories'] == ['ruisui-01']
        page.reload()
        assert state(page)['readMemories'] == ['ruisui-01']
        report('存檔失敗不會帶著未保存的獎勵換頁；重試成功後可繼續閱讀')
        context.close()

        context = browser.new_context()
        context.add_init_script("localStorage.setItem('aming-diary-progress', '{broken');")
        page = watch(context.new_page())
        page.goto(BASE)
        expect(page.locator('#start-btn')).to_have_text('開始遊戲')
        page.locator('#progress-warning button').click()
        expect(page.locator('#progress-warning')).to_contain_text('原始資料已保留')
        assert page.evaluate("localStorage.getItem('aming-diary-progress')") == '{broken'
        report('開始畫面能操作存檔錯誤提示；損壞資料保持原樣')
        context.close()

        for width in [320, 390]:
            context = browser.new_context(viewport={'width':width, 'height':844}, is_mobile=True, has_touch=True)
            page = watch(context.new_page())
            page.goto(BASE + 'explore.html?station=ruisui')
            cdp = context.new_cdp_session(page)
            for event, points in [('touchStart', [{'x':width*.8,'y':580}]),
                                  ('touchMove', [{'x':width*.15,'y':580}]), ('touchCancel', [])]:
                cdp.send('Input.dispatchTouchEvent', {'type':event, 'touchPoints':points})
            assert 'dragging' not in page.locator('#station-scene').get_attribute('class')
            page.locator('#cow-target').tap()
            page.locator('#shutter-button').tap()
            expect(page.locator('#photo-success')).to_have_class('photo-success show')
            page.locator('#view-memory').tap()
            expect(page.locator('#journey-return')).to_be_visible()
            page.locator('#journey-return').tap()
            expect(page).to_have_url(BASE + 'explore.html')
            page.locator('#ruisui-station').tap()
            expect(page.locator('.mission-tag')).to_have_text('JOURNEY COMPLETE')
            page.locator('#mission-diary').tap()
            page.locator('#player-tab').tap()
            page.locator('#travel-note').fill(f'{width}px 手機的旅程')
            page.reload()
            expect(page.locator('#travel-note')).to_have_value(f'{width}px 手機的旅程')
            page.locator('#back-to-index').tap()
            expect(page.locator('#diary-index')).to_be_visible()
            report(f'{width}px 手機觸控取消、拍照、完成返回、日記與自動存讀檔')
            context.close()

        assert not errors, errors
        report('所有測試頁面沒有 JavaScript 執行錯誤')
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print(json.dumps({'passed':len(passed), 'errors':errors}, ensure_ascii=False))
