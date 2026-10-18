const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const config = fs.readFileSync(path.join(__dirname,'../aming-game/js/event-config.js'),'utf8');
const source = fs.readFileSync(path.join(__dirname,'../aming-game/js/event-store.js'),'utf8');
const IMAGE = 'data:image/jpeg;base64,/9j/AAAA';
function app(data = new Map(), options = {}) {
 let clock=1800000000000, blocked=!!options.blocked;
 class FakeDate extends Date { static now(){return clock;} }
 const context=vm.createContext({Date:FakeDate,DOMException,localStorage:{getItem:k=>data.get(k)??null,setItem(k,v){if(blocked)throw new DOMException('full','QuotaExceededError');data.set(k,v);}},window:{addEventListener(){}}});
 vm.runInContext(config,context);context.EventConfig=context.window.EventConfig;vm.runInContext(source,context);
 return {api:context.window.EventStore,C:context.window.EventConfig,data,state:()=>JSON.parse(JSON.stringify(context.window.EventStore.snapshot())),block(value){blocked=value;},advance(ms){clock+=ms;}};
}
test('合作投稿即時增加，三階段解鎖並可領取；重載保留而不碰主線',()=>{
 const data=new Map([['aming-diary-progress','main save']]);const a=app(data);
 assert.equal(a.api.unlocked('pose'),false); assert.equal(a.api.joinPhoto().ok,true);
 for(const id of ['pose','frame','collection']){assert.equal(a.api.submitPhoto('春天','故事',IMAGE).ok,true);assert.equal(a.api.unlocked(id),true);assert.equal(a.api.claim(id).ok,true);assert.equal(a.api.claim(id).ok,false);}
 const b=app(data);assert.equal(b.state().photos.length,3);assert.equal(b.state().claims.length,3);assert.equal(data.get('aming-diary-progress'),'main save');
});
test('未參加、無標題或不合格圖片不能投稿，超過本機上限會拒絕',()=>{
 const a=app();assert.equal(a.api.submitPhoto('春','','bad').ok,false);a.api.joinPhoto();
 assert.equal(a.api.submitPhoto('','','data:image/jpeg;base64,AAAA').ok,false);assert.equal(a.api.submitPhoto('春','','https://example.com/a.jpg').ok,false);
 for(let i=0;i<a.C.maxPhotos;i++)assert.equal(a.api.submitPhoto('照片'+i,'',IMAGE).ok,true);
 assert.equal(a.api.submitPhoto('再一張','',IMAGE).ok,false);assert.equal(a.state().photos.length,a.C.maxPhotos);
});
test('測驗決定陣營且不能換隊，不能跳過測驗或重複任務刷分',()=>{
 const a=app();assert.equal(a.api.completeTask('ticket').ok,false);assert.equal(a.api.assign([0]).ok,false);
 assert.equal(a.api.assign([0,0,1]).ok,true);assert.equal(a.state().team,'blue');assert.equal(a.api.assign([1,1,1]).ok,false);
 assert.equal(a.api.completeTask('ticket').ok,true);assert.equal(a.api.completeTask('ticket').ok,false);assert.equal(a.api.personal(),30);
 assert.equal(a.api.completeTask('compass','west').ok,false);assert.equal(a.api.completeTask('postcard','短').ok,false);
});
test('個人分數同步陣營，可追平再反超；人數不自動平衡',()=>{
 const a=app();a.api.assign([0,0,0]);assert.equal(a.api.leader(),'sage');
 assert.equal(a.api.teams()[0].members,19);assert.equal(a.api.teams()[1].members,23);
 a.api.completeTask('ticket');a.api.completeTask('compass','east');assert.equal(a.api.leader(),null);
 a.api.completeTask('postcard','祝每位旅人都一路順風');assert.equal(a.api.personal(),160);assert.equal(a.api.teams()[0].score,420);assert.equal(a.api.leader(),'blue');
 assert.equal(a.api.unlocked('personal'),true);assert.equal(a.api.unlocked('winner'),false);
});
test('結束後才可領勝方獎，敗方仍保留參與獎與個人獎',()=>{
 const winner=app();winner.api.assign([0,0,0]);winner.api.completeTask('ticket');winner.api.completeTask('compass','east');winner.api.completeTask('postcard','祝大家旅途愉快');winner.advance(12*86400000);
 assert.equal(winner.api.phase('race'),'ended');assert.equal(winner.api.claim('winner').ok,true);assert.equal(winner.api.completeTask('ticket').ok,false);
 const loser=app();loser.api.assign([0,0,0]);loser.advance(12*86400000);assert.equal(loser.api.unlocked('winner'),false);assert.equal(loser.api.claim('participation').ok,true);
});
test('另一陣營答案會自動分入拾光月台；所有隊員都有參與獎',()=>{
 const a=app();a.api.assign([1,0,1]);assert.equal(a.state().team,'sage');assert.equal(a.api.claim('participation').ok,true);
});
test('寫入失敗不發布成功或改動進度；恢復後可重試',()=>{
 const a=app();a.api.joinPhoto();const before=a.data.get(a.C.storageKey);a.block(true);
 assert.equal(a.api.submitPhoto('花','','data:image/jpeg;base64,AAAA').ok,false);assert.equal(a.state().photos.length,0);assert.equal(a.data.get(a.C.storageKey),before);
 a.block(false);assert.equal(a.api.submitPhoto('花','',IMAGE).ok,true);
});
test('未知或損壞資料保持原值，只有明確 Demo 重置可清除',()=>{
 const seed=app();const data=new Map([[seed.C.storageKey,'{broken'],['aming-diary-progress','main save']]);const a=app(data);
 assert.equal(a.api.joinPhoto().ok,false);assert.equal(data.get(a.C.storageKey),'{broken');assert.equal(a.api.reset().ok,true);assert.equal(data.get('aming-diary-progress'),'main save');
});
test('重置只清活動，重新開啟可再測驗；訂閱可以移除',()=>{
 const a=app();let calls=0;const off=a.api.subscribe(()=>calls++);a.api.assign([1,1,1]);off();const before=calls;a.api.reset();assert.equal(calls,before);
 const b=app(a.data);assert.equal(b.state().team,null);assert.equal(b.api.assign([0,0,0]).ok,true);
});
test('讀取最新活動資料再寫入，避免其他分頁的投稿與任務被覆蓋',()=>{
 const a=app();a.api.joinPhoto();const b=app(a.data);a.api.submitPhoto('我的照片','',IMAGE);b.api.assign([0,0,0]);
 assert.equal(b.state().photos.length,1);a.api.completeTask('ticket');assert.equal(a.state().team,'blue');assert.equal(a.state().photos.length,1);
});
