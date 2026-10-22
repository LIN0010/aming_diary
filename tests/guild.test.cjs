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
