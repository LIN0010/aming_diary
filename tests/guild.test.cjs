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
 const {s,c}=setup();assert.equal(s.create('').ok,false);assert(s.create('山線小隊').ok);assert.equal(s.current().members.length,2);assert.equal(s.join(c.invite).ok,false);
 while(s.current().members.length<6)assert(s.inviteDemo().ok);
 assert.equal(s.inviteDemo().ok,false);const code=s.current().code;assert(s.leave().ok);assert.equal(s.current(),null);assert(s.join(code).ok);assert.equal(s.current().members.length,6);
 assert(s.leave().ok);assert(s.join(c.invite).ok);assert.equal(s.current().members.length,4);assert.equal(s.inviteDemo().ok,false);
});
test('只分享解鎖日記，每站只領一次抽取，跨團不重複',()=>{
 const {s,c,unlock}=setup();s.create('風');assert.equal(s.share('ruisui','心得').ok,false);unlock();const before=s.current().draws;
 assert.equal(s.share('ruisui','心得').value.earned,true);assert.equal(s.current().draws,before+1);assert.equal(s.share('ruisui','再次').ok,false);
 s.leave();s.join(c.invite);const n=s.current().draws;assert.equal(s.share('ruisui','另一段心得').value.earned,false);assert.equal(s.current().draws,n);
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

test('不足二人的小屋解散，避免留下不符人數限制的旅團',()=>{
 const {s}=setup();s.create('兩人旅行');assert.equal(s.current().members.length,2);assert(s.leave().ok);assert.equal(s.snapshot().guilds.length,0);
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
 const {s}=setup();s.create('車票','一起走山線');assert.equal(s.current().introduction,'一起走山線');assert(s.addDemoApplication().ok);const r=s.snapshot().applications[0];assert.equal(s.current().members.length,2);
 assert(s.reviewApplication(r.id,false).ok);assert.equal(s.current().members.length,2);assert(s.addDemoApplication().ok);assert(s.reviewApplication(s.snapshot().applications.at(-1).id,true).ok);assert.equal(s.current().members.length,3);
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
