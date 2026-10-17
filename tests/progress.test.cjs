// 執行：node --test tests/progress.test.cjs（僅使用 Node 內建工具）
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const source = readFileSync(join(__dirname, '../aming-game/js/progress.js'), 'utf8');
const KEY = 'aming-diary-progress';

function app({ data = new Map(), failRead = false, failWrite = false } = {}) {
    const events = {};
    const warning = { setAttribute() {}, hidden: true };
    const storage = {
        getItem(key) {
            if (failRead) throw new Error('storage blocked');
            return data.get(key) ?? null;
        },
        setItem(key, value) {
            if (failWrite) throw new Error('quota exceeded');
            data.set(key, value);
        }
    };
    const context = vm.createContext({
        localStorage: storage,
        document: {
            createElement: () => warning,
            getElementById: () => warning,
            querySelectorAll: () => [],
            body: { appendChild() {} }
        },
        window: {
            addEventListener(name, callback) { events[name] = callback; },
            alert() {}
        }
    });
    vm.runInContext(source, context);
    return {
        api: context.window.GameProgress,
        state: () => JSON.parse(JSON.stringify(context.window.GameProgress.snapshot())),
        events, warning, data,
        allowWrites() { failWrite = false; }
    };
}

test('新遊戲從零開始；任務重複完成只取得一片，重新載入仍保留', () => {
    const first = app();
    assert.deepEqual(first.state().collectedMemories, []);
    assert.equal(first.api.readMemory('ruisui-01'), false);
    first.api.visitRuisui();
    first.api.completeRuisui();
    first.api.completeRuisui();
    const next = app({ data: first.data });
    assert.deepEqual(next.state().visitedStations, ['ruisui']);
    assert.deepEqual(next.state().completedMissions, ['ruisui-cow']);
    assert.deepEqual(next.state().collectedMemories, ['ruisui-01']);
    assert.deepEqual(next.state().readMemories, []);
    next.api.readMemory('ruisui-01');
    assert.deepEqual(app({ data: first.data }).state().readMemories, ['ruisui-01']);
});

test('舊心得移入共用存檔、保留原始鍵值，空白心得不會被舊文字覆蓋', () => {
    const data = new Map([['ruisui-travel-note', '原本的旅程']]);
    const first = app({ data });
    assert.equal(first.state().notes.ruisui, '原本的旅程');
    first.api.enterScene('home');
    assert.equal(JSON.parse(data.get(KEY)).notes.ruisui, '原本的旅程');
    assert.equal(data.get('ruisui-travel-note'), '原本的旅程');
    assert.equal(first.api.saveNote('ruisui', ''), true);
    assert.equal(app({ data }).state().notes.ruisui, '');
});

test('壞掉、格式錯誤、未知版本的存檔不會被覆寫', () => {
    for (const raw of ['{broken', 'null', '{"version":2}', '{"version":1,"notes":{}}']) {
        const data = new Map([[KEY, raw]]);
        const current = app({ data });
        assert.equal(current.api.completeRuisui(), false);
        assert.equal(current.api.saveNote('ruisui', '本次文字'), false);
        assert.equal(data.get(KEY), raw);
        assert.equal(current.state().notes.ruisui, '本次文字');
        assert.equal(current.warning.hidden, false);
    }
});

test('讀取被禁止仍能遊玩，警告資料可能遺失', () => {
    const current = app({ failRead: true, failWrite: true });
    assert.equal(current.api.completeRuisui(), false);
    assert.deepEqual(current.state().collectedMemories, ['ruisui-01']);
    assert.equal(current.warning.hidden, false);
    assert.match(current.warning.textContent, /可能遺失/);
});

test('讀不到原始資料時，即使寫入仍可用，也不覆寫既有存檔', () => {
    const data = new Map([[KEY, 'unreadable existing data']]);
    const current = app({ data, failRead: true });
    assert.equal(current.api.completeRuisui(), false);
    assert.equal(data.get(KEY), 'unreadable existing data');
});

test('寫入失敗不回報成功，恢復後能一起儲存暫存進度及心得', () => {
    const current = app({ failWrite: true });
    assert.equal(current.api.saveNote('ruisui', '尚未存好的文字'), false);
    current.api.completeRuisui();
    current.allowWrites();
    assert.equal(current.api.enterScene('home'), true);
    const next = app({ data: current.data });
    assert.equal(next.state().notes.ruisui, '尚未存好的文字');
    assert.deepEqual(next.state().collectedMemories, ['ruisui-01']);
    assert.equal(current.warning.hidden, true);
});

test('舊分頁儲存心得不會覆蓋另一個分頁新取得的碎片', () => {
    const data = new Map();
    const first = app({ data });
    const second = app({ data });
    first.api.completeRuisui();
    second.api.saveNote('ruisui', '另一個分頁');
    assert.deepEqual(app({ data }).state().collectedMemories, ['ruisui-01']);
    first.events.storage({ key: KEY });
    assert.equal(first.state().notes.ruisui, '另一個分頁');
    first.api.readMemory('ruisui-01');
    second.events.pageshow();
    assert.deepEqual(second.state().readMemories, ['ruisui-01']);
});

test('對外提供的資料是複本，無法直接改壞共用進度', () => {
    const current = app();
    const state = current.api.snapshot();
    state.collectedMemories.push('ruisui-01');
    assert.deepEqual(current.state().collectedMemories, []);
    let calls = 0;
    const unsubscribe = current.api.subscribe(() => calls++);
    unsubscribe();
    current.api.visitRuisui();
    assert.equal(calls, 1);
});
