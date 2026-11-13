const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const context={window:{}};vm.runInNewContext(fs.readFileSync('aming-game/js/journal-spread.js','utf8'),context);const {choose,overlap}=context.window.JournalSpread;
const rect=(x,w)=>[{x,y:100},{x:x+w,y:100},{x:x+w,y:200},{x,y:200}];
assert.equal(choose(rect(550,100),'left'),'left');assert.equal(choose(rect(550,100),'right'),'right');assert.equal(choose(rect(500,100),'right'),'left');assert.equal(choose(rect(590,100),'left'),'right');assert.equal(overlap(rect(550,100),0),5000);
console.log('PASS overlap area, left/right majority, exact tie retains owner');
