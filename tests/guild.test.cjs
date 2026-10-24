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
