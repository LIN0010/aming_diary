GameScenes.register('group', ctx => {
    'use strict';
    const C = GuildConfig, S = GuildStore, dialog = ctx.id('gl-dialog'), body = ctx.id('gl-dialog-content');
    const noticeElement=ctx.id('gl-notice');
    let panel = '', puzzleId = C.puzzles[0].id, drawing = false, reveal = null, noticeTimer, draft = '', selectedStation = '', disposed = false;
    const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const btn = (action,label,off=false,extra='') => `<button type="button" class="gl-button ${extra}" data-gl="${action}"${off?' disabled':''}>${h(label)}</button>`;
    const date = s => new Date(s).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    const memberInfo = id => id===C.player.id ? C.player : C.members.find(m=>m.id===id) || {name:'旅人',avatar:C.player.avatar};
    const avatar = id => `<img class="gl-avatar" src="${memberInfo(id).avatar}" alt="${h(memberInfo(id).name)}">`;
    const title = text => `<h2 id="gl-dialog-title">${h(text)}</h2>`;
    function notify(text) {
        (dialog.open?dialog:ctx.root).append(noticeElement);
        ctx.cancelTimer(noticeTimer); ctx.id('gl-notice').textContent=text; ctx.id('gl-notice').hidden=false;
        noticeTimer=ctx.delay(()=>ctx.id('gl-notice').hidden=true,4500);
    }
    function result(r, text) { if (!r.ok) {notify(r.message);return false;} ctx.cancelTimer(noticeTimer); noticeElement.hidden=true; if(text)notify(text);return true; }
    function background() {
        ctx.root.style.setProperty('--gl-room-ratio',C.room.width/C.room.height);
        ctx.query('.gl-room-bg').src=C.room.image;
        ctx.id('gl-hotspots').innerHTML=C.room.hotspots.map(t=>`<button type="button" class="gl-hotspot" data-gl="${t.id}" aria-label="${h(t.label)}" style="left:${t.x*100}%;top:${t.y*100}%;width:${t.w*100}%;height:${t.h*100}%"><span>${h(t.label)} ↗</span></button>`).join('')+'<span class="gl-wall-progress" id="gl-wall-progress"></span>';
        const marker=ctx.id('gl-wall-progress'); marker.style.left=C.room.progress.x*100+'%';marker.style.top=C.room.progress.y*100+'%';
    }
    function renderRoom() {
        const g=S.current();
        ctx.id('gl-hud').innerHTML=g ? `<div class="gl-room-heading"><h1>${h(g.name)}</h1><span>${g.members.length}/${C.maxMembers} 位旅人</span><div class="gl-avatars">${g.members.map(m=>`<button type="button" data-member="${m.id}" aria-label="查看${h(memberInfo(m.id).name)}">${avatar(m.id)}</button>`).join('')}</div></div>` : `<div class="gl-room-heading"><h1>旅團小屋</h1><span>一起收藏沿線的回憶</span></div>`;
        ctx.id('gl-wall-progress').textContent=g ? `共同拼圖 ${g.puzzles.spring.owned.length}/12` : '共同回憶拼圖';
        ctx.id('gl-menu').innerHTML=`<nav class="gl-room-menu" aria-label="旅團功能">${g ? btn('wall','旅行牆 ↗')+btn('puzzle','回憶拼圖 ↗')+btn('members','旅團成員 ↗')+btn('manage','旅團手帳 ↗') : btn('welcome','建立／加入旅團 ↗')}</nav>`;
    }
    function welcome(mode='welcome') {
        const issue=S.status().issue;
        return title('下一段旅程，一起出發')+`<p class="gl-subtle">本機示範旅團 · 邀請碼不跨裝置連線</p>${issue?`<p role="alert">${h(issue)}</p>`:''}`+
            (mode==='create' ? `<form id="gl-create-form"><label>旅團名稱<input name="name" maxlength="24" required autocomplete="off" placeholder="替我們的小屋取個名字"></label><p class="gl-subtle">與一位示範同伴共創小屋，最多 6 人。</p><button class="gl-button">建立旅團</button></form>` : mode==='join' ? `<form id="gl-join-form"><label>旅團邀請碼<input name="code" maxlength="24" required autocomplete="off" placeholder="${C.invite}"></label><p class="gl-subtle">示範邀請碼：<strong>${C.invite}</strong></p><button class="gl-button">加入旅團</button></form>` : `<div class="gl-welcome-actions">${btn('create','建立旅團')}${btn('join','加入旅團')}</div>`)+
            `<div class="gl-actions">${mode!=='welcome'?btn('welcome','← 返回','', 'gl-plain'):''}${S.status().blocked?btn('reset','重置旅團示範資料'):''}</div>`;
    }
    function wall(g) {
        const unlocked=C.stations.filter(t=>GameProgress.hasMemory(t.memory));
        const available=unlocked.filter(t=>!g.posts.some(p=>p.memberId===C.player.id&&p.stationId===t.id));
        if (!available.some(t=>t.id===selectedStation)) selectedStation=available[0]?.id||'';
        return title('旅團旅行牆')+`<div class="gl-wall-layout"><section class="gl-share-paper"><h3>分享一頁旅行</h3>${available.length ? `<form id="gl-share-form"><label>已解鎖的日記<select name="station">${available.map(t=>`<option value="${t.id}"${selectedStation===t.id?' selected':''}>${h(t.name)}</option>`).join('')}</select></label><label>旅程摘要<textarea name="summary" maxlength="500" rows="4" required placeholder="寫下想分享的風景…">${h(draft||GameProgress.snapshot().notes[selectedStation]||C.stations.find(t=>t.id===selectedStation)?.summary||'')}</textarea></label><p class="gl-subtle">首次分享同一車站，可獲得 1 次拼圖抽取機會。</p><button class="gl-button">貼上旅行牆</button></form>` : `<p>${unlocked.length?'已解鎖的日記都分享過了。':'探索瑞穗並取得回憶後，就能分享自己的車站日記。'}</p>${btn('explore','前往探索',false,'gl-plain')}`}</section><div class="gl-post-wall">${[...g.posts].reverse().map(p=>`<article class="gl-post"><header>${avatar(p.memberId)}<span>${h(memberInfo(p.memberId).name)}${p.memberId!==C.player.id?' · 示範團員':''}<small>${date(p.at)}</small></span></header><h3>${h(p.station)}站</h3><p>${h(p.summary)}</p></article>`).join('')}</div></div>`;
    }
    function puzzle(g) {
        const p=C.puzzles.find(p=>p.id===puzzleId), r=g.puzzles[p.id], total=p.rows*p.cols, complete=r.owned.length===total;
        return title('一起拼回旅途的光')+`<div class="gl-puzzle-tabs">${C.puzzles.map(p=>`<button type="button" class="gl-button ${p.id===puzzleId?'is-selected':'gl-plain'}" data-puzzle="${p.id}" aria-pressed="${p.id===puzzleId}">${h(p.title)} · ${p.rows}×${p.cols}</button>`).join('')}</div><div class="gl-puzzle-layout"><section><div class="gl-puzzle-board" style="--cols:${p.cols};--rows:${p.rows};aspect-ratio:${p.aspect}">${Array.from({length:total},(_,n)=>{
            const owned=r.owned.includes(n), col=n%p.cols,row=Math.floor(n/p.cols);
            return `<button type="button" class="gl-piece ${owned?'is-owned':''} ${drawing&&reveal?.n===n&&reveal.puzzleId===p.id?'gl-flip':''}" data-piece="${n}" ${owned||drawing?'disabled':''} aria-label="${owned?'已取得':'兌換'}第 ${n+1} 片" style="background-image:${owned?`url('${p.image}')`:'none'};background-size:${p.cols*100}% ${p.rows*100}%;background-position:${col*100/(p.cols-1)}% ${row*100/(p.rows-1)}%">${owned?'':'<span aria-hidden="true">✧</span>'}</button>`;
        }).join('')}</div><p class="gl-subtle">${p.placeholder?'示意 CG · 正式素材可替換':''}</p></section><section class="gl-puzzle-notes"><h3>${h(p.title)}</h3><p id="gl-puzzle-progress">${r.owned.length}/${total} 片回憶</p><progress max="${total}" value="${r.owned.length}" aria-label="拼圖收集進度"></progress><p>抽取次數 <strong id="gl-draws">${g.draws}</strong> · 旅團點數 <strong id="gl-points">${g.points}</strong></p>${btn('draw',drawing?'紙片翻開中…':'抽取回憶拼圖',drawing||!g.draws||complete)}
            ${reveal?`<p class="gl-draw-result" role="status">${reveal.duplicate?`重複的回憶，轉換為 ${reveal.points} 點旅團點數`:'獲得新的回憶拼圖'} · 第 ${reveal.n+1} 片</p>`:''}
            <h4>兌換缺片 · 每片 ${C.exchangeCost} 點</h4><p class="gl-subtle">點選左側尚未取得的拼圖片即可兌換。</p><p class="gl-missing">缺少：${Array.from({length:total},(_,n)=>n).filter(n=>!r.owned.includes(n)).map(n=>n+1).join('、')||'已全部找回'}</p>
            <div class="gl-reward-preview"><h4>${complete?'✧ 回憶已完整解鎖':'完成獎勵'}</h4><p>阿明 CG ＋ 補充故事</p>${complete?btn('reward','翻開這段回憶'): '<span class="gl-subtle">拼完即可收藏</span>'}</div></section></div>`;
    }
    function members(g) {
        return title('一起旅行的夥伴')+`<div class="gl-member-list">${g.members.map(m=>{
            const info=memberInfo(m.id), shares=g.posts.filter(p=>p.memberId===m.id).length, contribution=C.puzzles.reduce((sum,p)=>sum+(g.puzzles[p.id].contributions[m.id]||0),0);
            return `<article id="gl-member-${m.id}" class="gl-member">${avatar(m.id)}<div><h3>${h(info.name)} ${g.leader===m.id?'<span class="gl-label">團長</span>':''}</h3><p>${m.id===C.player.id?'你':'示範團員'} · ${date(m.joinedAt)} 加入</p><p>分享 ${shares} 篇 · 拼圖貢獻 ${contribution+(m.id===C.player.id?0:info.contribution)} 次</p></div></article>`;
        }).join('')}</div>`;
    }
    function manage(g) {
        const leader=g.leader===C.player.id;
        return title('旅團手帳')+`<section class="gl-manage"><h3>${h(g.name)}</h3><p>${g.members.length}/${C.maxMembers} 位旅人 · ${leader?'你是團長':h(memberInfo(g.leader).name)+'帶隊'}</p><p class="gl-code" id="gl-invite-code">${h(g.code)}</p><div class="gl-actions">${btn('copy','複製邀請碼')}${btn('invite','邀請示範同伴',!leader||g.members.length>=C.maxMembers)}</div><p class="gl-subtle">本機模擬，邀請碼只適用這個瀏覽器。示範同行者、初始拼圖與點數由本機設定提供。</p><div class="gl-actions">${btn('leave','退出旅團',false,'gl-plain')}${btn('reset','重置旅團示範',false,'gl-plain')}</div><p class="gl-subtle">退出不影響主線；團長退出後由下一位成員接任，不足 2 人則解散。</p></section>`;
    }
    function reward(g) {
        const p=C.puzzles.find(p=>p.id===puzzleId);
        if(g.puzzles[p.id].owned.length!==p.rows*p.cols) return puzzle(g);
        return title(p.title)+`<img class="gl-unlocked-cg" src="${p.image}" alt="${h(p.title)}完整示意 CG"><article class="gl-story"><h3>阿明的補充日記</h3><p>${h(p.story)}</p></article>${btn('puzzle','← 回到拼圖')}`;
    }
    function show(next) {
        const g=S.current(); panel=g?next:['create','join'].includes(next)?next:'welcome';
        if(panel==='puzzle') reveal=null;
        renderPanel();
        // SPA 掛載時先隱藏 root，待掛載完成再進入原生對話框頂層。
        ctx.delay(()=>{if(!disposed&&panel&&!dialog.open)dialog.showModal();},0);
    }
    function renderPanel() {
        const g=S.current();
        dialog.dataset.panel=panel;
        body.innerHTML=!g ? welcome(panel) : panel==='wall'?wall(g):panel==='puzzle'?puzzle(g):panel==='members'?members(g):panel==='reward'?reward(g):manage(g);
        dialog.setAttribute('aria-busy',String(drawing));
    }
    function close() { if(drawing){notify('請等紙片翻開後再離開。');return;} panel='';dialog.close(); }
    background();renderRoom();
    ctx.on(ctx.root,'click',async e=>{
        const button=e.target.closest('button');if(!button||button.disabled)return;
        const action=button.dataset.gl;
        if(button.dataset.member){show('members');ctx.delay(()=>ctx.id('gl-member-'+button.dataset.member)?.scrollIntoView({block:'nearest'}),0);return;}
        if(button.dataset.puzzle){if(drawing)return;puzzleId=button.dataset.puzzle;show('puzzle');return;}
        if(button.dataset.piece!==undefined){if(drawing)return;const r=S.exchange(puzzleId,Number(button.dataset.piece));if(result(r,'這片回憶已加入共同拼圖。')){reveal=null;renderPanel();}return;}
        if(action==='close'){close();return;}
        if(['welcome','create','join','wall','puzzle','members','manage','reward'].includes(action)){if(!drawing)show(action);return;}
        if(action==='explore'){close();ctx.go('explore.html');return;}
        if(action==='draw'){
            if(drawing)return;drawing=true;reveal=null;
            const r=S.draw(puzzleId);if(!r.ok){drawing=false;notify(r.message);renderPanel();return;}
            reveal=r.value;renderPanel();ctx.delay(()=>{drawing=false;renderPanel();},650);return;
        }
        if(action==='copy'){
            const code=S.current()?.code;if(!code)return;
            try{await navigator.clipboard.writeText(code);if(!disposed)notify('邀請碼已複製。');}catch(_){notify('無法自動複製，請選取手帳中的邀請碼。');}return;
        }
        if(action==='invite'){if(result(S.inviteDemo(),'示範同伴已加入小屋。'))renderPanel();}
        if(action==='leave'&&confirm('要退出旅團嗎？不足 2 人的小屋會解散，主線日記與回憶不受影響。')){if(result(S.leave()))show('welcome');}
        if(action==='reset'&&confirm('清除本機旅團示範？主線與活動存檔不受影響。')){if(result(S.reset())){draft='';reveal=null;show('welcome');}}
    });
    ctx.on(ctx.root,'submit',e=>{
        if(!['gl-create-form','gl-join-form','gl-share-form'].includes(e.target.id))return;e.preventDefault();const f=new FormData(e.target);
        if(e.target.id==='gl-share-form'){
            const r=S.share(f.get('station'),f.get('summary'));
            if(result(r,r.value?.earned?'已分享日記，獲得 1 次拼圖抽取機會。':'已分享日記。')){draft='';renderPanel();}return;
        }
        const r=e.target.id==='gl-create-form'?S.create(f.get('name')):S.join(f.get('code'));
        if(result(r)){panel='';dialog.close();renderRoom();}
    });
    ctx.on(ctx.root,'input',e=>{if(e.target.name==='summary')draft=e.target.value;});
    ctx.on(ctx.root,'change',e=>{if(e.target.name==='station'){selectedStation=e.target.value;draft='';renderPanel();}});
    ctx.on(dialog,'close',()=>ctx.root.append(noticeElement));
    ctx.on(dialog,'cancel',e=>{e.preventDefault();close();});
    ctx.on(window,'storage',e=>{if(e.key===C.storageKey||e.key===null)S.refresh();});
    ctx.cleanup(S.subscribe(()=>{renderRoom();if(panel&&!drawing){if(!S.current()&&!['welcome','create','join'].includes(panel))panel='welcome';renderPanel();}}));
    ctx.subscribe(()=>{if(panel==='wall')renderPanel();});
    ctx.beforeLeave(()=>!drawing);
    ctx.cleanup(()=>{disposed=true;if(dialog.open)dialog.close();});
    ctx.delay(()=>{
        const room=ctx.query('.gl-room');room.scrollLeft=(room.scrollWidth-room.clientWidth)/2;
        if(!S.current())show('welcome');
    },0);
});
