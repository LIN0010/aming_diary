GameScenes.register('group', ctx => {
    'use strict';
    const C = GuildConfig, S = GuildStore, dialog = ctx.id('gl-dialog'), body = ctx.id('gl-dialog-content');
    const noticeElement=ctx.id('gl-notice');
    let panel = '', puzzleId = C.puzzles[0].id, drawing = false, reveal = null, noticeTimer, draft = '', selectedStation = '', disposed = false;
    let storyCount=0, storyPlaying=false, skipStoryAnimation=false;
    let sceneMode='', joinMethod='apply', search='', boarding=false, stampLabel='', selectedGuildId=null;
    const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const btn = (action,label,off=false,extra='') => `<button type="button" class="gl-button ${extra}" data-gl="${action}"${off?' disabled':''}>${h(label)}</button>`;
    const date = s => new Date(s).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    const memberInfo = id => id===C.player.id ? C.player : C.members.find(m=>m.id===id) || {name:'旅人',avatar:C.memberAvatars[Array.from(String(id)).reduce((hash,char)=>(hash*31+char.charCodeAt(0))>>>0,0)%C.memberAvatars.length]};
    const avatar = id => `<img class="gl-avatar" src="${memberInfo(id).avatar}" alt="${h(memberInfo(id).name)}">`;
    const title = text => `<h2 id="gl-dialog-title">${h(text)}</h2>`;
    function notify(text) {
        (dialog.open?dialog:ctx.root).append(noticeElement);
        ctx.cancelTimer(noticeTimer); ctx.id('gl-notice').textContent=text; ctx.id('gl-notice').hidden=false;
        noticeTimer=ctx.delay(()=>ctx.id('gl-notice').hidden=true,4500);
    }
    function result(r, text) { if (!r.ok) {notify(r.message);return false;} ctx.cancelTimer(noticeTimer); noticeElement.hidden=true; if(text)notify(text);return true; }
    // 輕量內嵌手指提示；不載入額外圖示套件。
    const pointerIcon='<svg class="gl-pointer-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 13V4a2 2 0 0 1 4 0v7-2a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v5c0 4-2 6-6 6h-2c-2 0-3-1-4-2l-5-6a2 2 0 0 1 3-2l2 1Z"/></svg>';
    function background(mode) {
        const setting=mode==='entry'?C.entrance:C.room;
        sceneMode=mode; ctx.root.classList.toggle('gl-entry-mode',mode==='entry');
        ctx.root.style.setProperty('--gl-room-ratio',setting.width/setting.height);
        ctx.root.style.setProperty('--gl-entry-image',`url('${new URL(C.entrance.image,document.baseURI).href}')`);
        ctx.query('.gl-room-bg').src=setting.image;
        ctx.query('.gl-room-bg').alt=mode==='entry'?'水彩車站：左側售票窗口，右側剪票口':'旅團小屋：窗邊鐵道、沙發、旅行手帳與拼圖牆';
        ctx.id('gl-hotspots').innerHTML=setting.hotspots.map(t=>`<button type="button" class="gl-hotspot ${mode==='entry'?'gl-entry-hotspot':''}" data-gl="${t.id}" aria-label="${h(t.label)}" style="left:${t.x*100}%;top:${t.y*100}%;width:${t.w*100}%;height:${t.h*100}%"><span>${h(t.label)}${mode==='entry'?'':pointerIcon}</span></button>`).join('');
        ctx.delay(()=>{const room=ctx.query('.gl-room');room.scrollLeft=(room.scrollWidth-room.clientWidth)/2;},0);
    }
    function renderRoom() {
        const g=S.current(), entry=!g||boarding, request=S.latestApplication();
        if(sceneMode!==(entry?'entry':'room'))background(entry?'entry':'room');
        if(entry){
            ctx.id('gl-hud').innerHTML=`<header class="gl-entry-heading"><h1>下一段旅程，你想與誰同行？</h1></header>`;
        }else{
            ctx.id('gl-hud').innerHTML=`<div class="gl-room-heading">${guildPortrait(g)}<h1>${h(g.name)}</h1><button type="button" class="gl-member-count" data-gl="members" aria-label="查看旅團成員，${g.members.length}/${C.maxMembers} 位旅人">${g.members.length}/${C.maxMembers} 位旅人</button><div class="gl-avatars">${g.members.map(m=>`<button type="button" data-member="${m.id}" aria-label="查看${h(memberInfo(m.id).name)}">${avatar(m.id)}</button>`).join('')}</div></div>`;
        }
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
    function portraitCrop(src) {
        const preset=C.avatars.find(a=>a.image===src),crop=C.avatarCrops[preset?.id]||{scale:1,x:0,y:0};
        return `--gl-crop-scale:${crop.scale};--gl-crop-x:${crop.x}%;--gl-crop-y:${crop.y}%`;
    }
    function guildPortrait(g) {
        const record=S.snapshot().guilds.find(x=>x.id===g.id)||g;
        const fallback=C.avatars.find(a=>a.id===C.defaultAvatar).image;
        return `<span class="gl-guild-portrait" style="${portraitCrop(S.avatar(record))}"><img class="gl-portrait-image" data-fallback="${h(fallback)}" src="${h(S.avatar(record))}" alt="${h(g.name)}旅團徽章"></span>`;
    }

    function applicationLabel(g) {
        if(S.current()?.id===g.id)return '已加入';
        return ({pending:'審核中',rejected:'未通過'})[S.latestApplication(g.id)?.status]||'';
    }
    function directoryRows() {
        return rosterGuilds().map(g=>`<button type="button" class="gl-roster-row" data-select-guild="${h(g.id)}" aria-pressed="${g.id===selectedGuildId}">${guildPortrait(g)}<span>${h(g.name)}</span><small class="gl-roster-mark" aria-hidden="true">${g.id===selectedGuildId?'◆':''}</small>${applicationLabel(g)?`<small class="gl-application-status">${applicationLabel(g)}</small>`:''}</button>`).join('')||'<p class="gl-subtle">找不到符合條件的旅團</p>';
    }
    function guildDetail() {
        const g=S.snapshot().guilds.find(g=>g.id===selectedGuildId);
        if(!g)return '<p class="gl-subtle">目前沒有可顯示的旅團。</p>';
        const p=C.puzzles[0],pieces=g.puzzles[p.id].owned.length,total=p.rows*p.cols,request=S.latestApplication(g.id),waiting=request?.status==='pending',full=g.members.length>=C.maxMembers,joined=S.current();
        return `<div class="gl-roster-info"><header>${guildPortrait(g)}<h3>${h(g.name)}</h3></header><p class="gl-guild-count">目前旅伴：${g.members.length} / ${C.maxMembers} 人${full?' · 旅團已滿':''}</p><p class="gl-guild-introduction">${h(g.introduction||'尚未填寫旅團介紹。')}</p><p>🧩 共同拼圖：${pieces} / ${total} 片</p></div><footer class="gl-roster-apply">${waiting?`<button type="button" class="gl-button" data-cancel-application="${h(g.id)}">取消申請</button>`:`<button type="button" class="gl-button" data-apply="${h(g.id)}"${joined||full||!g.openApplications?' disabled':''}>${joined?(joined.id===g.id?'已加入旅團':'已加入其他旅團'):full?'旅團已滿':!g.openApplications?'暫停申請':'申請加入旅團'}</button>`}${request?.status==='rejected'?'<small class="gl-subtle">申請未通過，可重新申請。</small>':''}</footer>`;
    }
    function updateRoster(preserveScroll=false) {
        const list=ctx.query('.gl-guild-directory'),top=list.scrollTop;
        ctx.query('.gl-guild-directory').innerHTML=directoryRows();
        ctx.query('.gl-roster-detail').innerHTML=guildDetail();
        if(preserveScroll){list.scrollTop=top;[...list.querySelectorAll('button')].find(b=>b.dataset.selectGuild===selectedGuildId)?.focus({preventScroll:true});}
    }
    function welcome(mode='welcome') {
        const issue=S.status().issue, localNote='<p class="gl-subtle">本機旅團 · 邀請碼與審核不跨裝置同步</p>';
        if(mode==='create')return title('旅團成立登記')+`<form id="gl-create-form"><div class="gl-clip-fields"><fieldset class="gl-avatar-picker"><legend>選擇旅團大頭貼</legend><div>${C.avatars.map(a=>`<label title="${h(a.name)}"><input type="radio" name="avatarId" value="${h(a.id)}" aria-label="${h(a.name)}"${a.id===C.defaultAvatar?' checked':''}><span class="gl-guild-portrait" style="${portraitCrop(a.image)}"><img class="gl-portrait-image" src="${h(a.image)}" alt="${h(a.name)}"></span></label>`).join('')}</div></fieldset><label>旅團名稱<input name="name" maxlength="24" required autocomplete="off" placeholder="旅團名稱"></label><label>旅團介紹（選填）<textarea name="introduction" maxlength="120" rows="2" placeholder="簡短寫下想一起走的旅程"></textarea></label></div><footer class="gl-clip-footer"><button class="gl-button">確認建立</button></footer></form>`;
        if(mode==='join'){
            const request=S.latestApplication();
            if(joinMethod==='code')return title('邀請碼加入')+`<form id="gl-join-form"><div class="gl-clip-fields"><label>請輸入旅伴提供的邀請碼<input class="gl-paper-input" name="code" maxlength="24" required autocomplete="off" placeholder="邀請碼"></label></div><footer class="gl-clip-footer"><button type="button" class="gl-button gl-plain" data-join-mode="apply">返回旅團列表</button><button class="gl-button">確認加入</button></footer></form>`;
            rosterGuilds();
            return title('尋找同行旅伴')+`<div class="gl-roster"><section class="gl-roster-detail" aria-live="polite">${guildDetail()}</section><section class="gl-roster-list"><form id="gl-search-form"><label><span class="gl-search-label">搜尋旅團名稱</span><span class="gl-search-icon" aria-hidden="true"></span><input class="gl-paper-input" name="query" maxlength="24" value="${h(search)}" autocomplete="off" placeholder="搜尋旅團名稱"></label></form><div class="gl-guild-directory" role="group" aria-label="旅團名冊">${directoryRows()}</div><footer><button type="button" class="gl-button gl-plain" data-join-mode="code">✦ 使用邀請碼加入</button></footer></section></div>`;
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
        return title('旅團旅行牆')+`<div class="gl-wall-layout"><section class="gl-share-paper"><h3>分享一頁旅行</h3>${available.length ? `<form id="gl-share-form"><label>已解鎖的日記<select name="station">${available.map(t=>`<option value="${t.id}"${selectedStation===t.id?' selected':''}>${h(t.name)}</option>`).join('')}</select></label><label>旅程摘要<textarea name="summary" maxlength="500" rows="4" required placeholder="寫下想分享的風景…">${h(draft||GameProgress.snapshot().notes[selectedStation]||C.stations.find(t=>t.id===selectedStation)?.summary||'')}</textarea></label><p class="gl-subtle">首次分享同一車站，可獲得 1 次拼圖抽取機會。</p><button class="gl-button">貼上旅行牆</button></form>` : `<p>${unlocked.length?'已解鎖的日記都分享過了。':'探索瑞穗並取得回憶後，就能分享自己的車站日記。'}</p>${btn('explore','前往探索',false,'gl-plain')}`}</section><div class="gl-post-wall">${g.posts.length?[...g.posts].reverse().map(p=>`<article class="gl-post"><header>${avatar(p.memberId)}<span>${h(memberInfo(p.memberId).name)}${p.memberId!==C.player.id?' · 示範團員':''}<small>${date(p.at)}</small></span></header><h3>${h(p.station)}站</h3>${p.photo?`<img class="gl-post-photo" src="${h(p.photo)}" alt="${h(p.station)}旅行照片" loading="lazy">`:''}<p>${h(p.summary)}</p></article>`).join(''):'<p class="gl-wall-empty">旅團的第一段回憶，就從這裡開始。</p>'}</div></div>`;
    }
    function puzzle(g) {
        const p=C.puzzles.find(p=>p.id===puzzleId), r=g.puzzles[p.id], total=p.rows*p.cols, complete=r.owned.length===total;
        return title('一起拼回旅途的光')+`<div class="gl-puzzle-tabs">${C.puzzles.map(p=>`<button type="button" class="gl-button ${p.id===puzzleId?'is-selected':'gl-plain'}" data-puzzle="${p.id}" aria-pressed="${p.id===puzzleId}">${h(p.title)} · ${p.rows}×${p.cols}</button>`).join('')}</div><div class="gl-puzzle-layout"><section><div class="gl-puzzle-board" style="--cols:${p.cols};--rows:${p.rows};--puzzle-aspect:${p.aspect};aspect-ratio:${p.aspect}">${Array.from({length:total},(_,n)=>{
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
            return `<article id="gl-member-${m.id}" class="gl-member">${avatar(m.id)}<div><h3>${h(info.name)} ${g.leader===m.id?'<span class="gl-label">團長</span>':''}</h3><p>${m.id===C.player.id?'你':'示範團員'} · ${date(m.joinedAt)} 加入</p><p>分享 ${shares} 篇 · 拼圖貢獻 ${contribution+(!g.origin&&m.id!==C.player.id?info.contribution:0)} 次</p></div></article>`;
        }).join('')}</div>`;
    }
    function manage(g) {
        const leader=g.leader===C.player.id;
        return title('旅團資訊')+`<section class="gl-manage">${guildPortrait(g)}<h3>${h(g.name)}</h3>${g.introduction?`<p>${h(g.introduction)}</p>`:""}<p>${g.members.length}/${C.maxMembers} 位旅人 · ${leader?'你是團長':h(memberInfo(g.leader).name)+'帶隊'}</p>${g.code!==C.invite?`<p class="gl-code" id="gl-invite-code">${h(g.code)}</p>`:""}<div class="gl-actions">${g.code!==C.invite?btn('copy','複製邀請碼'):""}${btn('invite','邀請示範同伴',!leader||g.members.length>=C.maxMembers)}</div><p class="gl-subtle">本機模擬，邀請碼只適用這個瀏覽器。</p><div class="gl-actions">${btn('leave','退出旅團',false,'gl-plain')}${btn('reset','重置旅團示範',false,'gl-plain')}</div><p class="gl-subtle">退出不影響主線；團長退出後由下一位成員接任，沒有成員時才會解散。</p>${leader?`<div class="gl-actions">${btn('toggle-applications',g.openApplications?'暫停申請':'開放申請',false,'gl-plain')}${btn('test-application','產生本機測試申請',!g.openApplications||g.members.length>=C.maxMembers,'gl-plain')}</div>${applicationList(g)}`:""}</section>`;
    }
    function storyAllowed(g) {
        const p=C.puzzles.find(p=>p.id===puzzleId);
        return g&&g.puzzles[p.id].storyUnlocked&&g.puzzles[p.id].owned.length===p.rows*p.cols;
    }
    function reward(g) {
        const p=C.puzzles.find(p=>p.id===puzzleId);
        if(!storyAllowed(g)) return puzzle(g);
        return title(p.title)+`<div class="gl-memory-layout"><img class="gl-memory-cg" src="${p.image}" alt="${h(p.title)}完整 CG"><section class="gl-memory-reader" aria-label="童年回憶"><div class="gl-memory-messages" role="log" aria-label="回憶對話" aria-live="polite"></div><div class="gl-memory-controls"></div></section></div>`;
    }
    function updateStory() {
        if(panel!=='reward'||!storyAllowed(S.current()))return;
        const lines=C.puzzles.find(p=>p.id===puzzleId).dialogue, log=body.querySelector('.gl-memory-messages'), controls=body.querySelector('.gl-memory-controls');
        if(!log)return;
        if(log.children.length>storyCount)log.replaceChildren();
        for(let n=log.children.length;n<storyCount;n++){
            const line=lines[n],bubble=document.createElement('article');
            bubble.className='gl-memory-bubble '+(line.speaker==='阿明'?'is-aming':'is-mother')+(skipStoryAnimation?' no-animation':'');
            const speaker=document.createElement('strong'),text=document.createElement('p');speaker.textContent=line.speaker;text.textContent=line.text;
            bubble.append(speaker,text);log.append(bubble);
        }
        if(skipStoryAnimation)log.querySelectorAll('.gl-memory-bubble').forEach(b=>b.classList.add('no-animation'));
        const ended=storyPlaying&&storyCount===lines.length;
        controls.innerHTML=!storyPlaying?btn('watch-memory','觀看回憶'):
            `${ended?'<p role="status">回憶已找回</p>':btn('next-memory','下一句')+btn('all-memory','全部顯示',false,'gl-plain')+btn('skip-memory',skipStoryAnimation?'已跳過動畫':'跳過動畫',skipStoryAnimation,'gl-plain')}${btn('replay-memory','重新觀看',false,'gl-plain')}`;
        controls.innerHTML+=btn('puzzle','← 回到拼圖',false,'gl-plain');
        log.scrollTop=log.scrollHeight;
    }
    function show(next) {
        const g=S.current(); panel=g?next:['create','join'].includes(next)?next:'welcome';
        if(!g&&panel==='join')result(S.prepareDirectory());
        if(panel==='puzzle') reveal=null;
        if(panel==='reward'){storyPlaying=false;storyCount=0;skipStoryAnimation=false;ctx.cancelTimer(noticeTimer);noticeElement.hidden=true;}
        renderPanel();
        // SPA 掛載時先隱藏 root，待掛載完成再進入原生對話框頂層。
        ctx.delay(()=>{if(!disposed&&panel&&!dialog.open)dialog.showModal();},0);
    }
    function renderPanel() {
        const g=S.current();
        dialog.dataset.panel=panel;
        dialog.classList.toggle('gl-clipboard',boarding||(!g&&['create','join'].includes(panel)));
        const back=dialog.classList.contains('gl-clipboard');
        ctx.query('.gl-close').classList.toggle('gl-clipboard-back',back);
        ctx.query('.gl-close').textContent=back?'← 返回':'×';
        ctx.query('.gl-close').disabled=boarding;
        ctx.query('.gl-close').setAttribute('aria-label',g?'返回旅團小屋':'返回車站入口');
        body.innerHTML=boarding ? title(stampLabel)+`<div class="gl-boarding-stamp" role="status">${h(stampLabel)}</div>${stampLabel==='旅程啟程'?`<p class="gl-ticket-destination">${h(g?.name)}</p><p class="gl-code">${h(g?.code)}</p>`:''}` : !g ? welcome(panel) : panel==='wall'?wall(g):panel==='puzzle'?puzzle(g):panel==='members'?members(g):panel==='reward'?reward(g):manage(g);
        updateStory();
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
        if(button.dataset.cancelApplication){if(result(S.cancelApplication(button.dataset.cancelApplication)))renderPanel();return;}
        if(button.dataset.apply){if(result(S.apply(button.dataset.apply)))renderPanel();return;}
        if(button.dataset.review){
            const approve=button.dataset.approve==='true',simulate=button.dataset.simulate==='true';
            const operation=()=>S.reviewApplication(button.dataset.review,approve,simulate);
            if(approve&&simulate)board(operation,'同行確認');
            else if(result(operation(),approve?'申請已核准。':'申請已拒絕。')){renderPanel();}
            return;
        }
        if(button.dataset.member){show('members');ctx.delay(()=>ctx.id('gl-member-'+button.dataset.member)?.scrollIntoView({block:'nearest'}),0);return;}
        if(button.dataset.puzzle){if(drawing)return;puzzleId=button.dataset.puzzle;show('puzzle');return;}
        if(button.dataset.piece!==undefined){if(drawing)return;const r=S.exchange(puzzleId,Number(button.dataset.piece));if(result(r,'這片回憶已加入共同拼圖。')){reveal=null;if(storyAllowed(S.current()))show('reward');else renderPanel();}return;}
        if(['watch-memory','next-memory','all-memory','skip-memory','replay-memory'].includes(action)){
            if(panel!=='reward'||!storyAllowed(S.current()))return;
            const total=C.puzzles.find(p=>p.id===puzzleId).dialogue.length;
            if(action==='watch-memory'||action==='replay-memory'){storyPlaying=true;storyCount=1;skipStoryAnimation=false;body.querySelector('.gl-memory-messages').replaceChildren();}
            if(action==='next-memory')storyCount=Math.min(total,storyCount+1);
            if(action==='all-memory'){skipStoryAnimation=true;storyCount=total;}
            if(action==='skip-memory')skipStoryAnimation=true;
            updateStory();return;
        }
        if(action==='close'){close();return;}
        if(['welcome','create','join','wall','puzzle','members','manage','reward'].includes(action)){if(!drawing)show(action);return;}
        if(action==='explore'){close();ctx.go('explore.html');return;}
        if(action==='draw'){
            if(drawing)return;drawing=true;reveal=null;
            const r=S.draw(puzzleId);if(!r.ok){drawing=false;notify(r.message);renderPanel();return;}
            reveal=r.value;renderPanel();ctx.delay(()=>{drawing=false;if(storyAllowed(S.current()))show('reward');else renderPanel();},650);return;
        }
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
        if(e.target.id==='gl-create-form')board(()=>S.create(f.get('name'),f.get('introduction'),f.get('avatarId')),'旅程啟程');
        else board(()=>S.join(f.get('code')),'同行確認');
    });
    ctx.on(ctx.root,'error',e=>{
        const img=e.target;
        if(img.matches?.('img.gl-portrait-image[data-fallback]')&&img.src!==new URL(img.dataset.fallback,document.baseURI).href){img.src=img.dataset.fallback;img.parentElement.style.cssText=portraitCrop(img.dataset.fallback);}
    },{capture:true});
    ctx.on(ctx.root,'input',e=>{if(e.target.name==='summary')draft=e.target.value;
        if(e.target.name==='query'){search=e.target.value;updateRoster();}});
    ctx.on(ctx.root,'change',e=>{if(e.target.name==='station'){selectedStation=e.target.value;draft='';renderPanel();}});
    ctx.on(dialog,'close',()=>ctx.root.append(noticeElement));
    ctx.on(dialog,'cancel',e=>{e.preventDefault();close();});
    ctx.on(window,'storage',e=>{if(e.key===C.storageKey||e.key===null)S.refresh();});
    ctx.cleanup(S.subscribe(()=>{
        const g=S.current(), entryPanels=['welcome','create','join'];
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
        if(S.status().blocked)show('welcome');
    },0);
});
