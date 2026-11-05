const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs=require('node:fs'), crypto=require('node:crypto').webcrypto;
function setup(raw) {
 const data=new Map(raw?[['aming-diary-guild-v1',raw]]:[]);let full=false, unlocked=false, random=0;
 const math=Object.create(Math);math.random=()=>random;
 const ctx=vm.createContext({window:{},crypto,Math:math,console,localStorage:{getItem:k=>data.get(k)??null,setItem(k,v){if(full)throw new DOMException('full','QuotaExceededError');data.set(k,v);},removeItem:k=>data.delete(k)},GameProgress:{hasMemory:()=>unlocked},DOMException});
 vm.runInContext(fs.readFileSync('aming-game/js/guild-config.js','utf8'),ctx);ctx.GuildConfig=ctx.window.GuildConfig;
 vm.runInContext(fs.readFileSync('aming-game/js/guild-store.js','utf8'),ctx);
 return {s:ctx.window.GuildStore,c:ctx.GuildConfig,data,full:v=>full=v,unlock:()=>unlocked=true,rng:v=>random=v};
}
test('建立／邀請／滿團、唯一成員資格、退出與加入',()=>{
 const {s,c}=setup();assert.equal(s.create('').ok,false);assert(s.create('山線小隊').ok);assert.equal(s.current().members.length,1);assert.equal(s.join(c.invite).ok,false);
 while(s.current().members.length<6)assert(s.inviteDemo().ok);
 assert.equal(s.inviteDemo().ok,false);const code=s.current().code;assert(s.leave().ok);assert.equal(s.current(),null);assert(s.join(code).ok);assert.equal(s.current().members.length,6);
 assert(s.leave().ok);assert(s.join(c.invite).ok);assert.equal(s.current().members.length,4);assert.equal(s.inviteDemo().ok,false);
});
test('只分享解鎖日記，每團每站領一次抽取',()=>{
 const {s,c,unlock}=setup();s.create('風');assert.equal(s.share('ruisui','心得').ok,false);unlock();const before=s.current().draws;
 assert.equal(s.share('ruisui','心得').value.earned,true);assert.equal(s.current().draws,before+1);assert.equal(s.share('ruisui','再次').ok,false);
 s.leave();s.join('20060119');const n=s.current().draws;assert.equal(s.share('ruisui','另一段心得').value.earned,true);assert.equal(s.current().draws,n+1);
});
test('新片、重複轉點、兌換及完成兩種尺寸',()=>{
 const {s,c,rng}=setup();s.join(c.invite);const old=s.current();rng(0);let r=s.draw('spring');assert(r.ok&&r.value.duplicate);assert.equal(s.current().points,old.points+c.duplicatePoints);assert.equal(s.current().draws,old.draws-1);
 rng(.99);r=s.draw('spring');assert(r.ok&&!r.value.duplicate);assert(s.current().puzzles.spring.owned.includes(11));
 assert.equal(s.exchange('spring',11).ok,false);assert.equal(s.exchange('spring',12).ok,false);
 for(const p of c.puzzles)for(let n=0;n<p.rows*p.cols;n++)if(!s.current().puzzles[p.id].owned.includes(n))assert(s.exchange(p.id,n).ok);
 assert.equal(s.current().puzzles.spring.owned.length,12);assert.equal(s.current().puzzles.limited.owned.length,20);assert.equal(s.draw('spring').ok,false);
});
test('儲存失敗不扣次數、不虛報分享與抽取成功，壞存檔不覆寫',()=>{
 const {s,data,c,full,unlock}=setup();s.join(c.invite);unlock();const before=JSON.stringify(s.snapshot()), raw=data.get(c.storageKey);full(true);
 assert.equal(s.draw('spring').ok,false);assert.equal(s.share('ruisui','心得').ok,false);assert.equal(JSON.stringify(s.snapshot()),before);assert.equal(data.get(c.storageKey),raw);
 const bad=setup('{broken');assert(bad.s.status().blocked);assert.equal(bad.s.create('團').ok,false);assert.equal(bad.data.get(c.storageKey),'{broken');assert(bad.s.reset().ok);assert(bad.s.create('新團').ok);
});
test('重新讀取及重置只作用旅團資料',()=>{
 const {s,data,c}=setup();data.set('aming-diary-progress','main');data.set('aming-diary-events-demo-v1','events');s.join(c.invite);s.refresh();assert.equal(s.current().name,c.demoName);s.reset();assert.equal(s.current(),null);assert.equal(data.get('aming-diary-progress'),'main');assert.equal(data.get('aming-diary-events-demo-v1'),'events');
});

test('單人旅團可保存；最後一位成員退出才解散',()=>{
 const {s}=setup();s.create('一人旅行');assert.equal(s.current().members.length,1);assert(s.leave().ok);assert.equal(s.snapshot().guilds.length,0);
});

test('舊 v1 旅團原地補欄位，保存收藏、邀請碼與主線隔離',()=>{
 const old=setup();old.s.join(old.c.invite);const raw=JSON.parse(old.data.get(old.c.storageKey));delete raw.applications;raw.guilds.forEach(g=>{delete g.introduction;delete g.openApplications;});
 const saved=JSON.stringify(raw),{s,data,c}=setup(saved);assert.equal(s.current().code,old.c.invite);assert.equal(s.current().puzzles.spring.owned.length,7);assert.equal(s.current().introduction,'');assert.equal(s.current().openApplications,true);assert.equal(data.get(c.storageKey),saved);
 assert(s.leave().ok);assert.equal(JSON.parse(data.get(c.storageKey)).applications.length,0);
});
test('申請須等待審核，無團長權限不核准，本機測試核准後才入團',()=>{
 const {s}=setup();s.prepareDirectory();const g=s.directory('慢慢')[0];assert(g&&g.open);assert(s.apply(g.id).ok);assert.equal(s.current(),null);assert.equal(s.latestApplication().status,'pending');
 assert.equal(s.apply(g.id).ok,false);const r=s.latestApplication();assert.equal(s.reviewApplication(r.id,true).ok,false);assert.equal(s.current(),null);
 assert(s.reviewApplication(r.id,true,true).ok);assert.equal(s.current().id,g.id);assert.equal(s.latestApplication().status,'approved');assert.equal(s.current().members.length,4);assert.equal(s.reviewApplication(r.id,true,true).ok,false);
});
test('拒絕、取消、重新申請與邀請碼直接加入',()=>{
 const {s,c}=setup();s.prepareDirectory();const g=s.directory()[0];s.apply(g.id);assert(s.reviewApplication(s.latestApplication().id,false,true).ok);assert.equal(s.latestApplication().status,'rejected');assert.equal(s.current(),null);
 assert(s.apply(g.id).ok);assert(s.cancelApplication().ok);assert.equal(s.latestApplication().status,'cancelled');s.apply(g.id);assert(s.join(c.invite).ok);assert.equal(s.latestApplication().status,'cancelled');assert.equal(s.current().id,g.id);
});
test('團長管理可關閉申請、核准或拒絕本機測試旅人',()=>{
 const {s}=setup();s.create('車票','一起走山線');assert.equal(s.current().introduction,'一起走山線');assert(s.addDemoApplication().ok);const r=s.snapshot().applications[0];assert.equal(s.current().members.length,1);
 assert(s.reviewApplication(r.id,false).ok);assert.equal(s.current().members.length,1);assert(s.addDemoApplication().ok);assert(s.reviewApplication(s.snapshot().applications.at(-1).id,true).ok);assert.equal(s.current().members.length,2);
 assert(s.setApplications(false).ok);assert.equal(s.directory('車票')[0].open,false);assert.equal(s.addDemoApplication().ok,false);
});
test('等待期間滿團不能核准，失敗不修改申請；儲存失敗不虛報成功',()=>{
 const {s,data,c,full}=setup();s.prepareDirectory();const g=s.directory()[0];s.apply(g.id);const raw=JSON.parse(data.get(c.storageKey));const target=raw.guilds.find(x=>x.id===g.id);
 for(const m of c.members.slice(3,6))target.members.push({id:m.id,joinedAt:new Date().toISOString()});data.set(c.storageKey,JSON.stringify(raw));s.refresh();
 assert.equal(s.reviewApplication(s.latestApplication().id,true,true).ok,false);assert.equal(s.latestApplication().status,'pending');assert.equal(s.current(),null);
 assert.equal(s.join(c.invite).ok,false);const before=JSON.stringify(s.snapshot());full(true);assert.equal(s.reviewApplication(s.latestApplication().id,false,true).ok,false);assert.equal(JSON.stringify(s.snapshot()),before);
});

test('展示名冊穩定排序、不重複新增、不覆寫舊團與玩家資料',()=>{
 const {s,c,data}=setup();assert(s.create('我的旅團','保留介紹').ok);const player=JSON.stringify(s.current());
 assert(s.prepareDirectory().ok);assert.equal(JSON.stringify(s.current()),player);
 assert.deepEqual(Array.from(s.directory().slice(0,3),g=>g.name),['沿線慢慢走','星光末班車','迷途旅人協會']);
 const demos=s.snapshot().guilds.filter(g=>g.code!==s.current().code);assert.deepEqual(demos.map(g=>g.members.length).join(','),'3,4,2');assert.equal(new Set(demos.map(g=>g.avatar)).size,3);
 const raw=JSON.parse(data.get(c.storageKey)),old=raw.guilds.find(g=>g.code===c.invite);old.id='legacy-rail-id';old.introduction='既有介紹';old.puzzles.spring.owned=[0,2];raw.guilds=raw.guilds.filter(g=>!['STAR2027','LOST2027'].includes(g.code));data.set(c.storageKey,JSON.stringify(raw));s.refresh();
 assert(s.prepareDirectory().ok);const preserved=s.snapshot().guilds.find(g=>g.code===c.invite);assert.equal(preserved.id,'legacy-rail-id');assert.equal(preserved.introduction,'既有介紹');assert.equal(preserved.puzzles.spring.owned.join(','),'0,2');assert.equal(JSON.stringify(s.current()),player);
 const once=JSON.stringify(s.snapshot());assert(s.prepareDirectory().ok);s.refresh();assert(s.prepareDirectory().ok);assert.equal(JSON.stringify(s.snapshot()),once);assert.equal(setup(data.get(c.storageKey)).s.directory()[0].id,'legacy-rail-id');
});

test('內建頭貼選擇保存、舊存檔預設與玩家自訂圖片保留',()=>{
 const {s,c,data}=setup();assert(s.create('海旅','介紹','ocean').ok);assert.equal(s.current().avatarId,'ocean');assert.equal(s.avatar(s.current()),'images/guild-ocean.png');assert.equal(setup(data.get(c.storageKey)).s.avatar(s.current()),'images/guild-ocean.png');
 assert.equal(s.avatar({id:'old'}),'images/guild-station.png');assert.equal(s.avatar({id:'old',avatar:'images/cow.png'}),'images/cow.png');
 assert.equal(s.avatar({id:'legacy',code:c.invite,avatar:'images/guild-station-bg.png'}),'images/guild-station.png');assert.equal(s.avatar({id:'legacy',code:c.invite,avatar:'images/cow.png'}),'images/cow.png');
 s.reset();assert(s.create('預設').ok);assert.equal(s.current().avatarId,'station');s.reset();assert.equal(s.create('錯誤','','unknown').ok,false);
 s.prepareDirectory();assert.equal(s.snapshot().guilds.map(g=>s.avatar(g)).join(','),'images/guild-station.png,images/guild-moon.png,images/guild-compass.png');
});

test('三團獨立申請、取消、首個核准優先、舊審核失效與重載',()=>{
 const {s,c,data}=setup();s.prepareDirectory();const [a,b,d]=s.directory();
 for(const g of [a,b,d])assert(s.apply(g.id).ok);
 assert.equal(s.snapshot().applications.filter(r=>r.status==='pending').length,3);assert.equal(s.apply(a.id).ok,false);
 const ar=s.latestApplication(a.id),cr=s.latestApplication(d.id);assert(s.cancelApplication(b.id).ok);
 assert.equal(s.latestApplication(b.id).status,'cancelled');assert.equal(s.latestApplication(a.id).status,'pending');assert.equal(s.latestApplication(d.id).status,'pending');
 assert(s.reviewApplication(ar.id,true,true).ok);assert.equal(s.current().id,a.id);assert.equal(s.latestApplication(d.id).status,'cancelled');assert.equal(s.reviewApplication(cr.id,true,true).ok,false);
 assert.equal(s.apply(b.id).ok,false);assert.equal(s.apply(d.id).ok,false);
 const restored=setup(data.get(c.storageKey)).s;assert.equal(restored.current().id,a.id);assert.equal(restored.latestApplication(d.id).status,'cancelled');assert.equal(restored.snapshot().guilds.filter(g=>g.members.some(m=>m.id==='you')).length,1);
 assert(s.leave().ok);assert(s.apply(b.id).ok);assert(s.reviewApplication(s.latestApplication(b.id).id,false,true).ok);assert.equal(s.latestApplication(b.id).status,'rejected');assert(s.apply(b.id).ok);
});

test('玩家新團零進度、待審不計人數、20060119 三人進度獨立且重入不初始化',()=>{
 const {s,c,data,unlock,rng}=setup();data.set('aming-diary-progress','personal');
 assert(s.create('我的新團').ok);let g=s.current();const ownId=g.id,code=g.code;
 assert.equal(g.members.length,1);assert.equal(g.leader,c.player.id);assert.equal(g.posts.length,0);assert.equal(g.draws,0);assert.equal(g.points,0);
 for(const p of c.puzzles){assert.equal(g.puzzles[p.id].owned.length,0);assert.equal(Object.keys(g.puzzles[p.id].contributions).length,0);}
 const requests=s.snapshot().applications.filter(r=>r.guildId===ownId);assert.equal(requests.length,2);assert(requests.every(r=>r.status==='pending'));
 const raw=data.get(c.storageKey),reloaded=setup(raw);assert.equal(JSON.stringify(reloaded.s.current()),JSON.stringify(g));assert.equal(reloaded.data.get(c.storageKey),raw);
 assert(s.reviewApplication(requests[0].id,true).ok);assert.equal(s.current().members.length,2);
 unlock();assert(s.share('ruisui','第一篇').ok);assert.equal(s.current().posts.length,1);assert.equal(s.current().draws,1);
 rng(.99);assert(s.draw('spring').ok);assert.equal(s.current().puzzles.spring.owned.length,1);assert(s.leave().ok);
 const preserved=JSON.stringify(s.snapshot().guilds.find(g=>g.id===ownId));
 assert(s.join('20060119').ok);g=s.current();assert.notEqual(g.id,ownId);assert.equal(g.members.length,3);assert.notEqual(g.leader,c.player.id);assert.equal(g.members.filter(m=>m.id===c.player.id).length,1);
 assert(g.posts.length>0&&g.posts.every(p=>g.members.some(m=>m.id===p.memberId)&&p.photo));
 for(const p of c.puzzles){const r=g.puzzles[p.id];assert(r.owned.length>0&&r.owned.length<p.rows*p.cols);assert.equal(Object.values(r.contributions).reduce((a,b)=>a+b,0),r.owned.length);assert(p.image.includes('puzzle-'));}
 assert.equal(s.reviewApplication(requests[1].id,true).ok,false);assert.equal(s.setApplications(false).ok,false);
 assert(s.draw('limited').ok);assert(s.exchange('spring',11).ok);assert(s.share('ruisui','同行心得').ok);const updated=s.current();
 assert(s.leave().ok);assert(s.join('20060119').ok);const again=s.current();assert.equal(again.id,updated.id);assert.equal(again.points,updated.points);assert.equal(again.draws,updated.draws);assert.equal(JSON.stringify(again.puzzles),JSON.stringify(updated.puzzles));assert.equal(JSON.stringify(again.posts),JSON.stringify(updated.posts));
 assert.equal(JSON.stringify(s.snapshot().guilds.find(g=>g.id===ownId)),preserved);
 assert(s.leave().ok);assert(s.join(code).ok);assert.equal(s.current().id,ownId);assert.equal(s.current().puzzles.spring.owned.length,1);assert.equal(data.get('aming-diary-progress'),'personal');
});

test('邀請團散布固定；僅遷移未遊玩種子，不覆寫玩家已產生的收藏',()=>{
 const {s,c,data}=setup();s.join('20060119');const raw=JSON.parse(data.get(c.storageKey)),g=raw.guilds.find(g=>g.code==='20060119');
 for(const p of c.puzzles){assert.equal(g.puzzles[p.id].owned.length,p.initial.length);assert.equal(g.puzzles[p.id].owned.join(','),c.invitedGuild.pieces[p.id].join(','));g.puzzles[p.id].owned=[...p.initial];}
 delete g.puzzleLayoutVersion;const legacy=JSON.stringify(raw),migrated=setup(legacy);assert.equal(migrated.s.current().puzzles.spring.owned.join(','),c.invitedGuild.pieces.spring.join(','));assert.equal(migrated.data.get(c.storageKey),legacy);
 g.draws--;g.puzzles.spring.owned.push(11);const played=setup(JSON.stringify(raw));assert.equal(played.s.current().puzzles.spring.owned.join(','),g.puzzles.spring.owned.join(','));
});

test('兩章分別完成才解鎖劇情；舊完整收藏向下相容且不重設進度',()=>{
 const {s,c,data}=setup();s.join('20060119');assert(!s.current().puzzles.spring.storyUnlocked);assert(!s.current().puzzles.limited.storyUnlocked);
 for(const p of c.puzzles){for(let n=0;n<p.rows*p.cols;n++)if(!s.current().puzzles[p.id].owned.includes(n))assert(s.exchange(p.id,n).ok);assert(s.current().puzzles[p.id].storyUnlocked);}
 const raw=data.get(c.storageKey),loaded=setup(raw);assert.equal(JSON.stringify(loaded.s.current()),JSON.stringify(s.current()));
 const legacy=JSON.parse(raw);for(const p of c.puzzles)delete legacy.guilds.find(g=>g.code==='20060119').puzzles[p.id].storyUnlocked;
 const old=setup(JSON.stringify(legacy));assert(old.s.current().puzzles.spring.storyUnlocked&&old.s.current().puzzles.limited.storyUnlocked);assert.equal(old.s.current().points,s.current().points);
 assert.equal(c.puzzles[0].dialogue.length,6);assert(c.puzzles[0].dialogue.every(l=>l.speaker==='阿明'));assert.equal(c.puzzles[1].dialogue.length,6);assert.equal(c.puzzles[1].dialogue.filter(l=>l.speaker==='媽媽').length,3);
});

test('旅行牆固定配對、洗牌不重複、限額抽取與顯示不寫入存檔',()=>{
 const {s,c,data,rng}=setup();s.join('20060119');assert.equal(c.travelWall.posts.length,4);assert.equal(s.current().posts.length,4);
 const before=data.get(c.storageKey),g=s.current();rng(0);const a=s.wallPosts(g.id);rng(.99);const b=s.wallPosts(g.id);assert.notEqual(a.map(p=>p.id).join(','),b.map(p=>p.id).join(','));
 for(const list of [a,b,s.wallPosts(g.id,3),s.wallPosts(g.id,100)]) {
  assert.equal(new Set(list.map(p=>p.id)).size,list.length);assert.equal(new Set(list.map(p=>p.photo)).size,list.length);
  for(const post of list){const fixed=c.travelWall.posts.find(p=>p.id===post.id);assert.equal(post.title,fixed.title);assert.equal(post.summary,fixed.content);assert.equal(post.photo,fixed.image);assert.equal(post.memberId,fixed.author);assert.equal(post.at,fixed.time);}
 }
 assert.equal(s.wallPosts(g.id,3).length,3);assert.equal(s.wallPosts(g.id,0).length,0);assert.equal(data.get(c.storageKey),before);
 const raw=JSON.parse(before),group=raw.guilds.find(x=>x.id===g.id);group.posts.push({...group.posts[0],id:'duplicate-photo'});const duplicate=setup(JSON.stringify(raw));assert.equal(duplicate.s.wallPosts(g.id).length,4);
});
test('旅行牆舊示範貼文升級只執行一次，保留玩家貼文／拼圖／點數；新建團仍空白',()=>{
 const {s,c,data}=setup();s.join('20060119');const raw=JSON.parse(data.get(c.storageKey)),g=raw.guilds.find(g=>g.code==='20060119');delete g.travelWallVersion;
 g.posts=c.demoPosts.filter(p=>['demo-mori','demo-light'].includes(p.memberId)).map((p,n)=>({...p,id:'old-'+n,at:g.createdAt,photo:'images/home-bg.jpg'}));
 const personal={id:'my-post',memberId:c.player.id,station:'瑞穗',stationId:'ruisui',summary:'玩家原文',at:g.createdAt};g.posts.push(personal);g.points=37;
 const saved=JSON.stringify(raw),old=setup(saved);assert.equal(old.s.current().posts.length,5);assert.equal(JSON.stringify(old.s.current().posts.find(p=>p.id==='my-post')),JSON.stringify(personal));assert.equal(JSON.stringify(old.s.current().puzzles),JSON.stringify(g.puzzles));assert.equal(old.s.current().points,37);assert.equal(old.data.get(c.storageKey),saved);
 assert(old.s.cancelApplication().ok);const once=old.data.get(c.storageKey);old.s.refresh();assert.equal(old.s.current().posts.length,5);assert.equal(old.data.get(c.storageKey),once);
 const fresh=setup();fresh.s.create('自己開始');fresh.s.prepareDirectory();assert.equal(fresh.s.current().posts.length,0);
});
