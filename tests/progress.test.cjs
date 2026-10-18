// 執行：node --test tests/progress.test.cjs（僅使用 Node 內建工具）
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const source = readFileSync(join(__dirname, '../aming-game/js/progress.js'), 'utf8');
const KEY = 'aming-diary-progress';

function app({ data = new Map(), failRead = false, failWrite = false, failRemove = false } = {}) {
    const events = {};
    const warning = { setAttribute() {}, addEventListener() {}, appendChild() {}, hidden: true };
    const storage = {
        getItem(key) {
            if (failRead) throw new Error('storage blocked');
            return data.get(key) ?? null;
        },
        setItem(key, value) {
            if (failWrite) throw new Error('quota exceeded');
            data.set(key, value);
        },
        removeItem(key) {
            if (failRemove) throw new Error('remove blocked');
            data.delete(key);
        }
    };
    const context = vm.createContext({
        localStorage: storage,
        document: {
            createElement: tag => tag === 'div' ? warning : { addEventListener() {} },
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

test('瑞穗階段從未開始、探索中、取得回憶到完成，重新讀檔保持完成', () => {
    const current = app();
    assert.equal(current.api.ruisuiStage(), 'unvisited');
    current.api.visitRuisui();
    assert.equal(current.api.ruisuiStage(), 'exploring');
    current.api.completeRuisui();
    assert.equal(current.api.ruisuiStage(), 'memory-found');
    current.api.readMemory('ruisui-01');
    assert.equal(app({ data: current.data }).api.ruisuiStage(), 'complete');
});

test('開始入口可回到首頁、地圖、探索場景及日記原頁籤', () => {
    const current = app();
    assert.equal(current.api.saveStatus().canResume, false);
    for (const [scene, view, url] of [
        ['home', undefined, 'home.html'],
        ['explore', undefined, 'explore.html'],
        ['ruisui', undefined, 'explore.html?station=ruisui'],
        ['diary', 'index', 'diary.html'],
        ['diary', 'ruisui-memory', 'diary.html?station=ruisui&tab=aming'],
        ['diary', 'ruisui-player', 'diary.html?station=ruisui&tab=player']
    ]) {
        current.api.enterScene(scene, view);
        const restored = app({ data: current.data });
        assert.equal(restored.api.resumeUrl(), url);
        assert.equal(restored.api.saveStatus().canResume, true);
    }
});

test('舊版 version 1 存檔缺少日記頁籤仍相容，不改動既有心得與碎片', () => {
    const old = app();
    old.api.completeRuisui();
    old.api.saveNote('ruisui', '舊版心得');
    old.api.enterScene('diary');
    const saved = JSON.parse(old.data.get(KEY));
    delete saved.diaryView;
    old.data.set(KEY, JSON.stringify(saved));
    const restored = app({ data: old.data });
    assert.equal(restored.api.resumeUrl(), 'diary.html');
    assert.equal(restored.state().notes.ruisui, '舊版心得');
    assert.deepEqual(restored.state().collectedMemories, ['ruisui-01']);
});

test('入口讀到另一分頁最新儲存的位置，不使用開啟入口時的舊位置', () => {
    const data = new Map();
    const entrance = app({ data });
    const game = app({ data });
    game.api.enterScene('diary', 'ruisui-player');
    assert.equal(entrance.api.resumeUrl(), 'diary.html?station=ruisui&tab=player');
});

test('儲存狀態與手動重試會如實反映寫入結果', () => {
    const current = app({ failWrite: true });
    const savedStates = [];
    current.api.subscribe((_, status) => savedStates.push(status.saved));
    current.api.completeRuisui();
    assert.equal(current.api.saveStatus().saved, false);
    current.allowWrites();
    assert.equal(current.api.save(), true);
    assert.equal(current.api.saveStatus().saved, true);
    assert.deepEqual(savedStates, [false, false, true]);
    assert.equal(app({ data: current.data }).api.ruisuiStage(), 'memory-found');
});

test('損壞或未知版本的存檔不能藉手動儲存被覆寫，也不提供繼續入口', () => {
    for (const raw of ['{bad', '{"version":99}']) {
        const current = app({ data: new Map([[KEY, raw]]) });
        assert.equal(current.api.save(), false);
        assert.equal(current.data.get(KEY), raw);
        assert.equal(current.api.saveStatus().canResume, false);
        assert.equal(current.api.resumeUrl(), 'home.html');
    }
});

test('新遊戲重設碎片、心得與位置，重新載入不會匯回舊心得', () => {
    const first = app({data:new Map([['ruisui-travel-note','舊心得']])});
    first.api.completeRuisui();
    first.api.saveNote('ruisui','現有心得');
    first.api.enterScene('diary','ruisui-player');
    assert.equal(first.api.reset(), true);
    const next = app({data:first.data});
    assert.deepEqual(next.state().collectedMemories, []);
    assert.deepEqual(next.state().visitedStations, []);
    assert.equal(next.state().notes.ruisui, '');
    assert.equal(next.state().lastScene, 'home');
    assert.equal(first.data.get('ruisui-travel-note'), '舊心得');
});

test('重設寫入失敗時保留既有存檔及本頁進度', () => {
    const first=app(); first.api.completeRuisui();
    const original=first.data.get(KEY);
    const next=app({data:first.data,failWrite:true});
    assert.equal(next.api.reset(), false);
    assert.equal(first.data.get(KEY), original);
    assert.deepEqual(next.state().collectedMemories, ['ruisui-01']);
});

test('重設不覆寫無法辨識的既有存檔', () => {
    const first=app({data:new Map([[KEY,'{broken']])});
    assert.equal(first.api.reset(), false);
    assert.equal(first.data.get(KEY), '{broken');
});


test('入口新遊戲一併清除活動存檔，無關資料保留', () => {
    const a = app({data:new Map([['activity','saved team'],['unrelated','keep']])});
    a.api.completeRuisui();
    assert.equal(a.api.reset({activityKey:'activity'}),true);
    assert.equal(a.data.has('activity'),false);
    assert.equal(a.data.get('unrelated'),'keep');
    assert.deepEqual(a.state().collectedMemories,[]);
});

test('活動無法清除時還原主線，不留下只重設一半的旅程', () => {
    const a=app({data:new Map([['activity','saved team']]),failRemove:true});
    a.api.completeRuisui();const before=a.data.get(KEY);
    assert.equal(a.api.reset({activityKey:'activity'}),false);
    assert.equal(a.data.get(KEY),before);
    assert.equal(a.data.get('activity'),'saved team');
    assert.deepEqual(a.state().collectedMemories,['ruisui-01']);
});
