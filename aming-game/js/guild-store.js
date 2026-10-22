/* 旅團獨立存檔；不改動主線或活動狀態。 */
(() => {
    'use strict';
    const C = GuildConfig, copy = v => JSON.parse(JSON.stringify(v)), listeners = new Set();
    let state, issue = '', blocked = false;
    const fresh = () => ({ version: 1, activeId: null, guilds: [], earned: [] });
    const id = () => crypto.randomUUID();
    function validate(s) {
        if (!s || s.version !== 1 || !Array.isArray(s.guilds) || !Array.isArray(s.earned) ||
            !s.earned.every(x => C.stations.some(t => t.id === x)) || new Set(s.earned).size !== s.earned.length) throw Error('invalid');
        const int = n => Number.isSafeInteger(n) && n >= 0;
        for (const g of s.guilds) {
            if (!g || typeof g.id !== 'string' || typeof g.code !== 'string' || typeof g.name !== 'string' || !g.name.trim() || g.name.length > 24 ||
                !Array.isArray(g.members) || g.members.length < C.minMembers || g.members.length > C.maxMembers || !Array.isArray(g.posts) || !int(g.draws) || !int(g.points) || !g.puzzles ||
                new Set(g.members.map(m => m.id)).size !== g.members.length || !g.members.some(m => m.id === g.leader)) throw Error('invalid');
            for (const m of g.members) if (!C.members.some(d => d.id === m.id) && m.id !== C.player.id) throw Error('invalid');
            for (const p of g.posts) if (!p || typeof p.id !== 'string' || typeof p.memberId !== 'string' || typeof p.station !== 'string' || typeof p.summary !== 'string' || p.summary.length > 500 || !Number.isFinite(Date.parse(p.at))) throw Error('invalid');
            for (const p of C.puzzles) {
                const owned = g.puzzles[p.id]?.owned, contributions = g.puzzles[p.id]?.contributions;
                if (!Array.isArray(owned) || new Set(owned).size !== owned.length || !owned.every(n => int(n) && n < p.rows*p.cols) || !contributions || !Object.values(contributions).every(int)) throw Error('invalid');
            }
        }
        if (new Set(s.guilds.map(g => g.code)).size !== s.guilds.length || new Set(s.guilds.map(g => g.id)).size !== s.guilds.length ||
            (s.activeId !== null && !s.guilds.some(g => g.id === s.activeId && g.members.some(m => m.id === C.player.id))) ||
            s.guilds.filter(g => g.members.some(m => m.id === C.player.id)).length > 1) throw Error('invalid');
        return s;
    }
    function read() {
        try { const raw = localStorage.getItem(C.storageKey); state = raw ? validate(JSON.parse(raw)) : fresh(); blocked = false; issue = ''; }
        catch (_) { state = fresh(); blocked = true; issue = '旅團存檔無法讀取；原資料保留，可在旅團管理重置。'; }
    }
    const active = s => s.guilds.find(g => g.id === s.activeId);
    function notify() { for (const f of listeners) f(); }
    function change(fn) {
        if (blocked) return { ok: false, message: issue };
        try {
            // 每次從儲存讀取，避免另一分頁的較新進度被覆蓋。
            const raw = localStorage.getItem(C.storageKey), next = raw ? validate(JSON.parse(raw)) : fresh();
            const value = fn(next);
            validate(next); localStorage.setItem(C.storageKey, JSON.stringify(next));
            state = next; issue = ''; notify(); return { ok: true, value };
        } catch (e) { issue = e.name === 'QuotaExceededError' || e.name === 'SecurityError' ? '旅團未能保存，請允許本機儲存後再試。' : (e.message === 'invalid' ? '存檔格式不符，未覆寫原資料。' : e.message); return { ok: false, message: issue }; }
    }
    function member(source, now) { return { id: source.id, joinedAt: now }; }
    function makeGuild(name, code, leader, count) {
        const at = new Date().toISOString(), members = C.members.slice(0, count).map(m => member(m, at));
        members.push(member(C.player, at));
        return { id: id(), name, code, leader, createdAt: at, members,
            posts: C.demoPosts.filter(p => members.some(m => m.id === p.memberId)).map(p => ({ ...p, id: id(), at })),
            draws: C.initialDraws, points: C.initialPoints,
            puzzles: Object.fromEntries(C.puzzles.map(p => [p.id, { owned: [...p.initial], contributions: {} }])) };
    }
    const needGuild = s => { const g = active(s); if (!g) throw Error('請先建立或加入旅團。'); return g; };
    function leave(s) {
        const g = needGuild(s); g.members = g.members.filter(m => m.id !== C.player.id);
        if (g.leader === C.player.id) g.leader = g.members[0]?.id;
        if (g.members.length < C.minMembers) s.guilds = s.guilds.filter(x => x.id !== g.id);
        s.activeId = null;
    }
    read();
    window.GuildStore = Object.freeze({
        snapshot: () => copy(state), current: () => copy(active(state) || null), status: () => ({ issue, blocked }),
        subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
        refresh() { read(); notify(); },
        create(name) { return change(s => {
            if (s.activeId) throw Error('一次只能加入一個旅團。');
            name = String(name).trim(); if (!name || name.length > 24) throw Error('旅團名稱請填寫 1～24 個字。');
            let code; do { code = id().replaceAll('-', '').slice(0,8).toUpperCase(); } while (code === C.invite || s.guilds.some(g => g.code === code));
            const g = makeGuild(name, code, C.player.id, C.minMembers-1); s.guilds.push(g); s.activeId = g.id;
        }); },
        join(code) { return change(s => {
            if (s.activeId) throw Error('請先退出目前的旅團。');
            code = String(code).trim().toUpperCase(); let g = s.guilds.find(g => g.code === code);
            if (!g && code === C.invite) { g = makeGuild(C.demoName, C.invite, C.members[0].id, 3); s.guilds.push(g); }
            else {
                if (!g) throw Error('找不到本機邀請碼，請使用示範碼或這個瀏覽器建立的邀請碼。');
                if (g.members.length >= C.maxMembers) throw Error('旅團已滿 6 人。');
                g.members.push(member(C.player, new Date().toISOString()));
            }
            s.activeId = g.id;
        }); },
        share(stationId, summary) { return change(s => {
            const g = needGuild(s), t = C.stations.find(t => t.id === stationId);
            if (!t || !GameProgress.hasMemory(t.memory)) throw Error('只能分享自己已解鎖的車站日記。');
            summary = String(summary).trim(); if (!summary || summary.length > 500) throw Error('旅程摘要請填寫 1～500 個字。');
            if (g.posts.some(p => p.memberId === C.player.id && p.stationId === stationId)) throw Error('這本車站日記已分享到旅行牆。');
            g.posts.push({ id: id(), memberId: C.player.id, stationId, station: t.name, summary, at: new Date().toISOString() });
            const earned = !s.earned.includes(stationId); if (earned) { s.earned.push(stationId); g.draws++; }
            return { earned };
        }); },
        draw(puzzleId) { return change(s => {
            const g = needGuild(s), p = C.puzzles.find(p => p.id === puzzleId); if (!p) throw Error('找不到拼圖。');
            if (!g.draws) throw Error('沒有可用的抽取次數。');
            if (g.puzzles[p.id].owned.length === p.rows*p.cols) throw Error('這張拼圖已完成。');
            const n = Math.floor(Math.random()*p.rows*p.cols), record = g.puzzles[p.id], duplicate = record.owned.includes(n);
            g.draws--; if (duplicate) g.points += C.duplicatePoints; else record.owned.push(n);
            record.contributions[C.player.id] = (record.contributions[C.player.id] || 0)+1;
            return { n, duplicate, points: duplicate ? C.duplicatePoints : 0, puzzleId };
        }); },
        exchange(puzzleId, n) { return change(s => {
            const g = needGuild(s), p = C.puzzles.find(p => p.id === puzzleId);
            if (!p || !Number.isInteger(n) || n<0 || n>=p.rows*p.cols) throw Error('請選擇缺少的拼圖片。');
            const r = g.puzzles[p.id]; if (r.owned.includes(n)) throw Error('已經擁有這片拼圖。');
            if (g.points < C.exchangeCost) throw Error('旅團點數不足。');
            g.points -= C.exchangeCost; r.owned.push(n); r.contributions[C.player.id]=(r.contributions[C.player.id]||0)+1;
        }); },
        inviteDemo() { return change(s => {
            const g = needGuild(s); if (g.leader !== C.player.id) throw Error('只有團長可以邀請示範團員。');
            if (g.members.length >= C.maxMembers) throw Error('旅團已滿 6 人。');
            const candidates = C.members;
            const m = candidates.find(m => !g.members.some(x => x.id===m.id));
            if (!m || !C.members.some(x => x.id===m.id)) throw Error('目前可邀請的示範團員已全數加入。');
            g.members.push(member(m, new Date().toISOString()));
        }); },
        leave: () => change(leave),
        reset() { try { localStorage.removeItem(C.storageKey); state=fresh(); blocked=false; issue=''; notify(); return {ok:true}; } catch (_) { return {ok:false,message:'無法重置旅團，原資料保留。'}; } }
    });
})();
