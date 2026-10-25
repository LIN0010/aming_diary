/* 旅團獨立存檔；不改動主線或活動狀態。 */
(() => {
    'use strict';
    const C = GuildConfig, copy = v => JSON.parse(JSON.stringify(v)), listeners = new Set();
    let state, issue = '', blocked = false;
    const fresh = () => ({ version: 1, activeId: null, guilds: [], earned: [], applications: [] });
    const id = () => crypto.randomUUID();
    function validate(s) {
        if (!s || s.version !== 1 || !Array.isArray(s.guilds) || !Array.isArray(s.earned) ||
            !s.earned.every(x => C.stations.some(t => t.id === x)) || new Set(s.earned).size !== s.earned.length) throw Error('invalid');
        // 舊版 v1 只補齊新欄位，不變更既有旅團、拼圖與日記。
        if (s.applications === undefined) s.applications = [];
        if (!Array.isArray(s.applications)) throw Error('invalid');
        const int = n => Number.isSafeInteger(n) && n >= 0;
        for (const g of s.guilds) {
            if (g.introduction === undefined) g.introduction = '';
            if (g.openApplications === undefined) g.openApplications = true;
            if (!g || typeof g.id !== 'string' || typeof g.code !== 'string' || typeof g.name !== 'string' || !g.name.trim() || g.name.length > 24 ||
                !Array.isArray(g.members) || g.members.length < C.minMembers || g.members.length > C.maxMembers || !Array.isArray(g.posts) || !int(g.draws) || !int(g.points) || !g.puzzles ||
                new Set(g.members.map(m => m.id)).size !== g.members.length || !g.members.some(m => m.id === g.leader)) throw Error('invalid');
            if (typeof g.introduction !== 'string' || g.introduction.length > 120 || typeof g.openApplications !== 'boolean') throw Error('invalid');
            for (const m of g.members) if (!C.members.some(d => d.id === m.id) && m.id !== C.player.id) throw Error('invalid');
            for (const p of g.posts) if (!p || typeof p.id !== 'string' || typeof p.memberId !== 'string' || typeof p.station !== 'string' || typeof p.summary !== 'string' || p.summary.length > 500 || !Number.isFinite(Date.parse(p.at))) throw Error('invalid');
            for (const p of C.puzzles) {
                const owned = g.puzzles[p.id]?.owned, contributions = g.puzzles[p.id]?.contributions;
                if (!Array.isArray(owned) || new Set(owned).size !== owned.length || !owned.every(n => int(n) && n < p.rows*p.cols) || !contributions || !Object.values(contributions).every(int)) throw Error('invalid');
            }
        }
        if (new Set(s.applications.map(r => r.id)).size !== s.applications.length) throw Error('invalid');
        for (const r of s.applications) {
            if (!r || typeof r.id !== 'string' || !s.guilds.some(g => g.id === r.guildId) ||
                ![C.player.id,...C.members.map(m=>m.id)].includes(r.applicantId) ||
                !['pending','approved','rejected','cancelled'].includes(r.status) || !Number.isFinite(Date.parse(r.at))) throw Error('invalid');
        }
        if (s.applications.filter(r => r.applicantId === C.player.id && r.status === 'pending').length > 1) throw Error('invalid');
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
    function makeGuild(name, code, leader, count, includePlayer = true) {
        const at = new Date().toISOString(), members = C.members.slice(0, count).map(m => member(m, at));
        if (includePlayer) members.push(member(C.player, at));
        return { id: id(), name, code, leader, createdAt: at, members, introduction: '', openApplications: true,
            posts: C.demoPosts.filter(p => members.some(m => m.id === p.memberId)).map(p => ({ ...p, id: id(), at })),
            draws: C.initialDraws, points: C.initialPoints,
            puzzles: Object.fromEntries(C.puzzles.map(p => [p.id, { owned: [...p.initial], contributions: {} }])) };
    }
    function ensureDirectory(s) {
        for (const demo of C.directoryGuilds) {
            // 只補缺少的展示旅團；既有 ID、成員、收藏與玩家旅團完全保留。
            if (s.guilds.some(g => g.id === demo.id || g.code === demo.code)) continue;
            const g = makeGuild(demo.name, demo.code, C.members[0].id, demo.count, false);
            g.id = demo.id; g.introduction = demo.introduction; g.avatar = demo.avatar;
            s.guilds.push(g);
        }
        return s.guilds.find(g => g.code === C.invite);
    }

    function cancelPending(s) { s.applications.forEach(r => { if (r.applicantId === C.player.id && r.status === 'pending') r.status='cancelled'; }); }
    function admit(s,g,applicantId) {
        if (g.members.length >= C.maxMembers) throw Error('旅團已滿 6 人。');
        if (s.guilds.some(g => g.members.some(m => m.id === applicantId))) throw Error('這位旅人已加入其他旅團。');
        g.members.push({ id: applicantId, joinedAt: new Date().toISOString() });
        if (applicantId === C.player.id) { s.activeId=g.id; cancelPending(s); }
    }
    const needGuild = s => { const g = active(s); if (!g) throw Error('請先建立或加入旅團。'); return g; };
    function leave(s) {
        const g = needGuild(s); g.members = g.members.filter(m => m.id !== C.player.id);
        if (g.leader === C.player.id) g.leader = g.members[0]?.id;
        if (g.members.length < C.minMembers) { s.guilds = s.guilds.filter(x => x.id !== g.id); s.applications=s.applications.filter(r=>r.guildId!==g.id); }
        s.activeId = null;
    }
    read();
    window.GuildStore = Object.freeze({
        snapshot: () => copy(state), current: () => copy(active(state) || null), status: () => ({ issue, blocked }),
        subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
        refresh() { read(); notify(); },
        latestApplication: () => copy([...state.applications].reverse().find(r=>r.applicantId===C.player.id) || null),
        directory: query => copy([...state.guilds].sort((a,b) => {
            const rank = g => { const n=C.directoryGuilds.findIndex(d=>d.id===g.id||d.code===g.code); return n<0?C.directoryGuilds.length:n; };
            return rank(a)-rank(b);
        }).filter(g=>g.name.toLocaleLowerCase().includes(String(query||'').trim().toLocaleLowerCase())).map(g=>({id:g.id,name:g.name,introduction:g.introduction,count:g.members.length,open:g.openApplications}))),
        prepareDirectory: () => change(s => { ensureDirectory(s); }),
        create(name, introduction = '') { return change(s => {
            if (s.activeId) throw Error('一次只能加入一個旅團。');
            name = String(name).trim(); if (!name || name.length > 24) throw Error('旅團名稱請填寫 1～24 個字。');
            let code; do { code = id().replaceAll('-', '').slice(0,8).toUpperCase(); } while (code === C.invite || s.guilds.some(g => g.code === code));
            introduction=String(introduction).trim(); if (introduction.length>120) throw Error('旅團介紹最多 120 個字。');
            const g = makeGuild(name, code, C.player.id, C.minMembers-1); g.introduction=introduction; s.guilds.push(g); s.activeId = g.id; cancelPending(s);
        }); },
        join(code) { return change(s => {
            if (s.activeId) throw Error('請先退出目前的旅團。');
            code = String(code).trim().toUpperCase();
            const g = s.guilds.find(g => g.code === code) || (code === C.invite ? ensureDirectory(s) : null);
            if (!g) throw Error('邀請碼不正確，請重新確認。');
            admit(s,g,C.player.id);
        }); },
        apply(guildId) { return change(s => {
            if(s.activeId) throw Error('一次只能加入一個旅團。');
            if(s.applications.some(r=>r.applicantId===C.player.id&&r.status==='pending')) throw Error('已有等待審核的申請，請先取消或等待結果。');
            const g=s.guilds.find(g=>g.id===guildId);
            if(!g||!g.openApplications) throw Error('這個旅團目前未開放申請。');
            if(g.members.length>=C.maxMembers) throw Error('旅團已滿 6 人。');
            s.applications.push({id:id(),guildId,applicantId:C.player.id,status:'pending',at:new Date().toISOString()});
        }); },
        cancelApplication() { return change(s => { cancelPending(s); }); },
        setApplications(open) { return change(s => {
            const g=needGuild(s); if(g.leader!==C.player.id) throw Error('只有團長可以管理申請。');
            g.openApplications=Boolean(open);
        }); },
        addDemoApplication() { return change(s => {
            const g=needGuild(s); if(g.leader!==C.player.id) throw Error('只有團長可以產生本機測試申請。');
            if(!g.openApplications) throw Error('請先開放申請。');
            if(g.members.length>=C.maxMembers) throw Error('旅團已滿 6 人。');
            const m=C.members.find(m=>!s.guilds.some(g=>g.members.some(x=>x.id===m.id))&&!s.applications.some(r=>r.applicantId===m.id&&r.status==='pending'));
            if(!m) throw Error('目前沒有可用的本機測試旅人。');
            s.applications.push({id:id(),guildId:g.id,applicantId:m.id,status:'pending',at:new Date().toISOString()});
        }); },
        reviewApplication(requestId, approve, simulateLeader=false) { return change(s => {
            const r=s.applications.find(r=>r.id===requestId),g=r&&s.guilds.find(g=>g.id===r.guildId);
            if(!g||r.status!=='pending') throw Error('這筆申請已處理或不存在。');
            const leader=s.activeId===g.id&&g.leader===C.player.id;
            const localTest=simulateLeader&&!s.activeId&&r.applicantId===C.player.id&&C.members.some(m=>m.id===g.leader);
            if(!leader&&!localTest) throw Error('只有團長可以審核這筆申請。');
            if(approve) admit(s,g,r.applicantId);
            r.status=approve?'approved':'rejected'; r.decidedAt=new Date().toISOString();
            return {joined:approve&&r.applicantId===C.player.id};
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
