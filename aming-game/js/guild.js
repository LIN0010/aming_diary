GameScenes.register('group', ctx => {
    'use strict';
    const C = GuildConfig, S = GuildStore, dialog = ctx.id('gl-dialog'), body = ctx.id('gl-dialog-content');
    const noticeElement=ctx.id('gl-notice');
    let panel = '', puzzleId = C.puzzles[0].id, drawing = false, reveal = null, noticeTimer, draft = '', selectedStation = '', disposed = false;
    let sceneMode='', joinMethod='apply', search='', boarding=false, stampLabel='', selectedGuildId=null;
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
    function background(mode) {
        const setting=mode==='entry'?C.entrance:C.room;
        sceneMode=mode; ctx.root.classList.toggle('gl-entry-mode',mode==='entry');
        ctx.root.style.setProperty('--gl-room-ratio',setting.width/setting.height);
        ctx.root.style.setProperty('--gl-entry-image',`url('${new URL(C.entrance.image,document.baseURI).href}')`);
        ctx.query('.gl-room-bg').src=setting.image;
        ctx.query('.gl-room-bg').alt=mode==='entry'?'水彩車站：左側售票窗口，右側剪票口':'旅團小屋：窗邊鐵道、沙發、旅行手帳與拼圖牆';
        ctx.id('gl-hotspots').innerHTML=setting.hotspots.map(t=>`<button type="button" class="gl-hotspot ${mode==='entry'?'gl-entry-hotspot':''}" data-gl="${t.id}" aria-label="${h(t.label)}" style="left:${t.x*100}%;top:${t.y*100}%;width:${t.w*100}%;height:${t.h*100}%"><span>${h(t.label)}${mode==='entry'?'':' ↗'}</span></button>`).join('')+(mode==='room'?'<span class="gl-wall-progress" id="gl-wall-progress"></span>':'');
        if(mode==='room'){
            const marker=ctx.id('gl-wall-progress');marker.style.left=C.room.progress.x*100+'%';marker.style.top=C.room.progress.y*100+'%';
        }
        ctx.delay(()=>{const room=ctx.query('.gl-room');room.scrollLeft=(room.scrollWidth-room.clientWidth)/2;},0);
    }
    function renderRoom() {
        const g=S.current(), entry=!g||boarding, request=S.latestApplication();
        if(sceneMode!==(entry?'entry':'room'))background(entry?'entry':'room');
        if(entry){
            ctx.id('gl-hud').innerHTML=`<header class="gl-entry-heading"><h1>下一段旅程，你想與誰同行？</h1></header>`;
            ctx.id('gl-menu').innerHTML=request&&['pending','rejected'].includes(request.status)?`<div class="gl-application-badge">${btn('pending',request.status==='pending'?'等待團長審核':'查看申請結果')}</div>`:'';
        }else{
            ctx.id('gl-hud').innerHTML=`<div class="gl-room-heading"><h1>${h(g.name)}</h1><span>${g.members.length}/${C.maxMembers} 位旅人</span><div class="gl-avatars">${g.members.map(m=>`<button type="button" data-member="${m.id}" aria-label="查看${h(memberInfo(m.id).name)}">${avatar(m.id)}</button>`).join('')}</div></div>`;
            ctx.id('gl-wall-progress').textContent=`共同拼圖 ${g.puzzles.spring.owned.length}/12`;
            ctx.id('gl-menu').innerHTML=`<nav class="gl-room-menu" aria-label="旅團功能">${btn('wall','旅行牆 ↗')+btn('puzzle','回憶拼圖 ↗')+btn('members','旅團成員 ↗')+btn('manage','旅團手帳 ↗')}</nav>`;
        }
    }
    function pending() {
        const r=S.latestApplication(), g=r&&S.snapshot().guilds.find(g=>g.id===r.guildId);
        if(!r||!g)return title('尚未送出申請')+btn('close','返回入口');
        const waiting=r.status==='pending';
        return title(waiting?'等待團長審核':r.status==='rejected'?'申請未通過':'申請已取消')+`<p class="gl-ticket-destination">${h(g.name)}</p><p>${waiting?'申請已送出，核准後才會加入旅團。':r.status==='rejected'?'可以回到車站選擇其他旅團。':'可以重新選擇同行的旅團。'}</p><div class="gl-actions">${btn('close','返回入口')}${waiting?btn('cancel-application','取消申請',false,'gl-plain'):''}</div>${waiting&&C.members.some(m=>m.id===g.leader)?btn('review-demo','本機審核測試',false,'gl-plain'):''}`;
    }
    function applicationList(g, simulate=false) {
        const requests=S.snapshot().applications.filter(r=>r.guildId===g.id&&r.status==='pending'&&(!simulate||r.applicantId===C.player.id));
        return `<section class="gl-applications"><h3>${simulate?'本機團長審核':'加入申請'}</h3>${simulate?'<p class="gl-subtle">本機模擬審核，不會跨裝置同步。</p>':''}${requests.length?requests.map(r=>`<article class="gl-application-row">${avatar(r.applicantId)}<div><strong>${h(memberInfo(r.applicantId).name)}</strong><small>${date(r.at)} 申請</small></div><div class="gl-actions"><button type="button" class="gl-button" data-review="${h(r.id)}" data-approve="true" data-simulate="${simulate}">核准</button><button type="button" class="gl-button gl-plain" data-review="${h(r.id)}" data-approve="false" data-simulate="${simulate}">拒絕</button></div></article>`).join(''):'<p class="gl-subtle">目前沒有等待審核的申請。</p>'}</section>`;
    }
    function rosterGuilds() {
        const groups=S.directory(search).filter(g=>g.open);
        if(!groups.some(g=>g.id===selectedGuildId))selectedGuildId=groups[0]?.id||null;
        return groups;
    }
    function directoryRows() {
        return rosterGuilds().map(g=>`<button type="button" class="gl-roster-row" data-select-guild="${h(g.id)}" aria-pressed="${g.id===selectedGuildId}"><span aria-hidden="true">${g.id===selectedGuildId?'◆':'◇'}</span><span>${h(g.name)}</span></button>`).join('')||'<p class="gl-subtle">找不到符合條件的旅團</p>';
    }
    function guildDetail() {
        const g=S.snapshot().guilds.find(g=>g.id===selectedGuildId);
        if(!g)return '<p class="gl-subtle">目前沒有可顯示的旅團。</p>';
        const p=C.puzzles[0],pieces=g.puzzles[p.id].owned.length,total=p.rows*p.cols,request=S.latestApplication(),waiting=request?.status==='pending',full=g.members.length>=C.maxMembers;
        return `<div class="gl-roster-info"><header><span class="gl-guild-emblem" role="img" aria-label="預設鐵道徽章">🚆</span><h3>${h(g.name)}</h3></header><p>目前旅伴：${g.members.length} / ${C.maxMembers} 人${full?' · 旅團已滿':''}</p><p class="gl-guild-introduction">${h(g.introduction||'尚未填寫旅團介紹。')}</p><p>共同拼圖：${pieces} / ${total} 片</p><progress max="${total}" value="${pieces}" aria-label="共同拼圖進度"></progress><p>旅行牆紀錄：${g.posts.length} 則</p>${g.code===C.invite?'<small class="gl-subtle">本機模擬旅團</small>':''}</div><footer class="gl-roster-apply"><button type="button" class="gl-button" data-apply="${h(g.id)}"${full||!g.openApplications||waiting?' disabled':''}>${full?'旅團已滿':!g.openApplications?'暫停申請':waiting?'等待團長審核':'申請加入旅團'}</button>${waiting?btn('pending','查看申請',false,'gl-plain'):''}</footer>`;
    }
    function updateRoster(preserveScroll=false) {
        const list=ctx.query('.gl-guild-directory'),top=list.scrollTop;
        ctx.query('.gl-guild-directory').innerHTML=directoryRows();
        ctx.query('.gl-roster-detail').innerHTML=guildDetail();
        if(preserveScroll){list.scrollTop=top;[...list.querySelectorAll('button')].find(b=>b.dataset.selectGuild===selectedGuildId)?.focus({preventScroll:true});}
    }
    function welcome(mode='welcome') {
        const issue=S.status().issue, localNote='<p class="gl-subtle">本機旅團 · 邀請碼與審核不跨裝置同步</p>';
        if(mode==='pending')return pending();
        if(mode==='review-demo'){
            const r=S.latestApplication(),g=r&&S.snapshot().guilds.find(g=>g.id===r.guildId);
            return title('審核旅程通行證')+(g?applicationList(g,true):'')+btn('pending','← 申請狀態',false,'gl-plain');
        }
        if(mode==='create')return title('旅團成立登記')+`<p class="gl-clip-subtitle">為這段旅程取個名字吧。</p><form id="gl-create-form"><div class="gl-clip-fields"><label>旅團名稱<input name="name" maxlength="24" required autocomplete="off" placeholder="旅團名稱"></label><label>旅團介紹（選填）<textarea name="introduction" maxlength="120" rows="2" placeholder="簡短寫下想一起走的旅程"></textarea></label></div><footer class="gl-clip-footer"><button class="gl-button">確認建立</button></footer></form>`;
        if(mode==='join'){
            const request=S.latestApplication();
            if(joinMethod==='code')return title('邀請碼加入')+`<form id="gl-join-form"><div class="gl-clip-fields"><label>請輸入旅伴提供的邀請碼<input name="code" maxlength="24" required autocomplete="off" placeholder="邀請碼"></label></div><footer class="gl-clip-footer"><button type="button" class="gl-button gl-plain" data-join-mode="apply">返回旅團列表</button><button class="gl-button">確認加入</button></footer></form>`;
            rosterGuilds();
            return title('尋找同行旅伴')+`<div class="gl-roster"><section class="gl-roster-detail" aria-live="polite">${guildDetail()}</section><section class="gl-roster-list"><form id="gl-search-form"><label><span class="gl-search-label">搜尋旅團名稱</span><input name="query" maxlength="24" value="${h(search)}" autocomplete="off" placeholder="搜尋旅團名稱"></label></form><div class="gl-guild-directory" role="group" aria-label="旅團名冊">${directoryRows()}</div><footer><button type="button" class="gl-button gl-plain" data-join-mode="code">✦ 使用邀請碼加入</button></footer></section></div>`;
        }
        return title('旅團入口')+(issue?`<p role="alert">${h(issue)}</p>${btn('reset','重置旅團資料')}`:'')+btn('close','返回車站');
    }
    function board(operation,label) {
        boarding=true;
        const r=operation();
        if(!result(r)){boarding=false;renderRoom();return;}
        stampLabel=label;panel='stamp';renderPanel();
        if(!dialog.open)dialog.showModal();
        ctx.delay(()=>{boarding=false;panel='';dialog.close();renderRoom();},900);
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
        return title('旅團手帳')+`<section class="gl-manage"><h3>${h(g.name)}</h3>${g.introduction?`<p>${h(g.introduction)}</p>`:""}<p>${g.members.length}/${C.maxMembers} 位旅人 · ${leader?'你是團長':h(memberInfo(g.leader).name)+'帶隊'}</p>${g.code!==C.invite?`<p class="gl-code" id="gl-invite-code">${h(g.code)}</p>`:""}<div class="gl-actions">${g.code!==C.invite?btn('copy','複製邀請碼'):""}${btn('invite','邀請示範同伴',!leader||g.members.length>=C.maxMembers)}</div><p class="gl-subtle">本機模擬，邀請碼只適用這個瀏覽器。示範同行者、初始拼圖與點數由本機設定提供。</p><div class="gl-actions">${btn('leave','退出旅團',false,'gl-plain')}${btn('reset','重置旅團示範',false,'gl-plain')}</div><p class="gl-subtle">退出不影響主線；團長退出後由下一位成員接任，不足 2 人則解散。</p>${leader?`<div class="gl-actions">${btn('toggle-applications',g.openApplications?'暫停申請':'開放申請',false,'gl-plain')}${btn('test-application','產生本機測試申請',!g.openApplications||g.members.length>=C.maxMembers,'gl-plain')}</div>${applicationList(g)}`:""}</section>`;
    }
    function reward(g) {
        const p=C.puzzles.find(p=>p.id===puzzleId);
        if(g.puzzles[p.id].owned.length!==p.rows*p.cols) return puzzle(g);
        return title(p.title)+`<img class="gl-unlocked-cg" src="${p.image}" alt="${h(p.title)}完整示意 CG"><article class="gl-story"><h3>阿明的補充日記</h3><p>${h(p.story)}</p></article>${btn('puzzle','← 回到拼圖')}`;
    }
    function show(next) {
        const g=S.current(); panel=g?next:['create','join','pending','review-demo'].includes(next)?next:'welcome';
        if(!g&&panel==='join')result(S.prepareDirectory());
        if(panel==='puzzle') reveal=null;
        renderPanel();
        // SPA 掛載時先隱藏 root，待掛載完成再進入原生對話框頂層。
        ctx.delay(()=>{if(!disposed&&panel&&!dialog.open)dialog.showModal();},0);
    }
    function renderPanel() {
        const g=S.current();
        dialog.dataset.panel=panel;
        dialog.classList.toggle('gl-clipboard',boarding||(!g&&['create','join'].includes(panel)));
        ctx.query('.gl-close').disabled=boarding;
        ctx.query('.gl-close').setAttribute('aria-label',g?'返回旅團小屋':'返回車站入口');
        body.innerHTML=boarding ? title(stampLabel)+`<div class="gl-boarding-stamp" role="status">${h(stampLabel)}</div>${stampLabel==='旅程啟程'?`<p class="gl-ticket-destination">${h(g?.name)}</p><p class="gl-code">${h(g?.code)}</p>`:''}` : !g ? welcome(panel) : panel==='wall'?wall(g):panel==='puzzle'?puzzle(g):panel==='members'?members(g):panel==='reward'?reward(g):manage(g);
        dialog.setAttribute('aria-busy',String(drawing||boarding));
    }
    function close() { if(drawing||boarding){return;} panel='';dialog.close(); }
    renderRoom();
    ctx.on(ctx.root,'click',async e=>{
        const button=e.target.closest('button');if(!button||button.disabled)return;
        const action=button.dataset.gl;
        if(boarding)return;
        if(button.dataset.joinMode){joinMethod=button.dataset.joinMode;if(joinMethod==='apply')search='';renderPanel();return;}
        if(button.dataset.selectGuild){selectedGuildId=button.dataset.selectGuild;updateRoster(true);return;}
        if(button.dataset.apply){if(result(S.apply(button.dataset.apply)))show('pending');return;}
        if(button.dataset.review){
            const approve=button.dataset.approve==='true',simulate=button.dataset.simulate==='true';
            const operation=()=>S.reviewApplication(button.dataset.review,approve,simulate);
            if(approve&&simulate)board(operation,'同行確認');
            else if(result(operation(),approve?'申請已核准。':'申請已拒絕。')){if(simulate)show('pending');else renderPanel();}
            return;
        }
        if(button.dataset.member){show('members');ctx.delay(()=>ctx.id('gl-member-'+button.dataset.member)?.scrollIntoView({block:'nearest'}),0);return;}
        if(button.dataset.puzzle){if(drawing)return;puzzleId=button.dataset.puzzle;show('puzzle');return;}
        if(button.dataset.piece!==undefined){if(drawing)return;const r=S.exchange(puzzleId,Number(button.dataset.piece));if(result(r,'這片回憶已加入共同拼圖。')){reveal=null;renderPanel();}return;}
        if(action==='close'){close();return;}
        if(['welcome','create','join','pending','review-demo','wall','puzzle','members','manage','reward'].includes(action)){if(!drawing)show(action);return;}
        if(action==='explore'){close();ctx.go('explore.html');return;}
        if(action==='draw'){
            if(drawing)return;drawing=true;reveal=null;
            const r=S.draw(puzzleId);if(!r.ok){drawing=false;notify(r.message);renderPanel();return;}
            reveal=r.value;renderPanel();ctx.delay(()=>{drawing=false;renderPanel();},650);return;
        }
        if(action==='cancel-application'){if(result(S.cancelApplication()))close();return;}
        if(action==='toggle-applications'){if(result(S.setApplications(!S.current().openApplications)))renderPanel();return;}
        if(action==='test-application'){if(result(S.addDemoApplication()))renderPanel();return;}
        if(action==='copy'){
            const code=S.current()?.code;if(!code)return;
            try{await navigator.clipboard.writeText(code);if(!disposed)notify('邀請碼已複製。');}catch(_){notify('無法自動複製，請選取手帳中的邀請碼。');}return;
        }
        if(action==='invite'){if(result(S.inviteDemo(),'示範同伴已加入小屋。'))renderPanel();}
        if(action==='leave'&&confirm('要退出旅團嗎？不足 2 人的小屋會解散，主線日記與回憶不受影響。')){if(result(S.leave()))close();}
        if(action==='reset'&&confirm('清除本機旅團示範？主線與活動存檔不受影響。')){if(result(S.reset())){draft='';reveal=null;close();}}
    });
    ctx.on(ctx.root,'submit',e=>{
        if(!['gl-create-form','gl-join-form','gl-share-form','gl-search-form'].includes(e.target.id))return;e.preventDefault();const f=new FormData(e.target);
        if(boarding)return;
        if(e.target.id==='gl-search-form'){search=String(f.get('query'));if(result(S.prepareDirectory()))renderPanel();return;}
        if(e.target.id==='gl-share-form'){
            const r=S.share(f.get('station'),f.get('summary'));
            if(result(r,r.value?.earned?'已分享日記，獲得 1 次拼圖抽取機會。':'已分享日記。')){draft='';renderPanel();}return;
        }
        if(e.target.id==='gl-create-form')board(()=>S.create(f.get('name'),f.get('introduction')),'旅程啟程');
        else board(()=>S.join(f.get('code')),'同行確認');
    });
    ctx.on(ctx.root,'input',e=>{if(e.target.name==='summary')draft=e.target.value;
        if(e.target.name==='query'){search=e.target.value;updateRoster();}});
    ctx.on(ctx.root,'change',e=>{if(e.target.name==='station'){selectedStation=e.target.value;draft='';renderPanel();}});
    ctx.on(dialog,'close',()=>ctx.root.append(noticeElement));
    ctx.on(dialog,'cancel',e=>{e.preventDefault();close();});
    ctx.on(window,'storage',e=>{if(e.key===C.storageKey||e.key===null)S.refresh();});
    ctx.cleanup(S.subscribe(()=>{
        const g=S.current(), entryPanels=['welcome','create','join','pending','review-demo'];
        if(panel&&!drawing&&!boarding&&((g&&entryPanels.includes(panel))||(!g&&!entryPanels.includes(panel)))){
            panel='';dialog.close();
        }
        renderRoom();
        if(panel&&!drawing&&!boarding)renderPanel();
    }));
    ctx.subscribe(()=>{if(panel==='wall')renderPanel();});
    ctx.beforeLeave(()=>!drawing&&!boarding);
    ctx.cleanup(()=>{disposed=true;if(dialog.open)dialog.close();});
    ctx.delay(()=>{
        const room=ctx.query('.gl-room');room.scrollLeft=(room.scrollWidth-room.clientWidth)/2;
        if(!S.current()&&S.latestApplication()?.status==='pending')show('pending');
        else if(S.status().blocked)show('welcome');
    },0);
});
