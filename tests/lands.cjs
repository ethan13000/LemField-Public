const assert=require('node:assert/strict');require('../rules.js');const R=globalThis.MoxRules;
for(const template of R.templates){const lands=template.rules.filter(rule=>rule.id==='lands');assert.equal(lands.length,1,template.id);assert.equal(lands[0].min,template.id==='landfall'?39:32);assert.equal(lands[0].max,41,template.id);}
assert.equal(R.asRule('lands').max,41);
const legacy=JSON.parse(JSON.stringify(R.defaults));legacy.schemaVersion=1;
for(const profile of legacy.profiles)profile.rules=profile.rules.filter(rule=>rule.id!=='lands');
let migrated=R.sanitizeSettings(legacy);assert.equal(migrated.schemaVersion,3);for(const profile of migrated.profiles){assert.equal(profile.rules.find(rule=>rule.id==='lands').min,32);assert.equal(profile.rules.find(rule=>rule.id==='lands').max,41);}
migrated.profiles[0].rules.find(rule=>rule.id==='lands').min=37;assert.equal(R.sanitizeSettings(migrated).profiles[0].rules.find(rule=>rule.id==='lands').min,37);
migrated.profiles[0].rules=migrated.profiles[0].rules.filter(rule=>rule.id!=='lands');assert(!R.sanitizeSettings(migrated).profiles[0].rules.some(rule=>rule.id==='lands'));
const custom=R.sanitizeSettings({profiles:[{id:'custom',name:'Custom',rules:[]}]});assert.equal(custom.profiles[0].rules.length,0);
const saved=JSON.parse(JSON.stringify(R.defaults));saved.schemaVersion=2;
for(const profile of saved.profiles)profile.rules.find(rule=>rule.id==='lands').max=null;
saved.profiles[1].rules.find(rule=>rule.id==='lands').max=45;
saved.profiles.push({id:'custom',name:'Custom',rules:[R.asRule('lands',{min:35,max:48})]});
saved.profiles.push({id:'custom-uncapped',name:'Custom uncapped',rules:[R.asRule('lands',{max:null})]});
const updated=R.sanitizeSettings(saved);
for(const profile of updated.profiles.slice(0,R.templates.length))assert.equal(profile.rules.find(rule=>rule.id==='lands').max,41);
assert.equal(updated.profiles.at(-2).rules[0].max,48);assert.equal(updated.profiles.at(-1).rules[0].max,null);
const landRule=updated.profiles[0].rules.find(rule=>rule.id==='lands');
for(const qty of [41,42]){const [result]=R.evaluate([{name:'Forest',type:'Basic Land — Forest',qty,tags:[],section:'mainboard'}],[landRule],['mainboard']);assert.equal(result.count>result.max,qty===42);}
landRule.max=46;assert.equal(R.sanitizeSettings(updated).profiles[0].rules.find(rule=>rule.id==='lands').max,46);
landRule.max=null;assert.equal(R.sanitizeSettings(updated).profiles[0].rules.find(rule=>rule.id==='lands').max,null);
saved.profiles[0].rules.find(rule=>rule.id==='lands').min=43;
const highMinimum=R.sanitizeSettings(saved).profiles[0].rules.find(rule=>rule.id==='lands');assert.equal(highMinimum.min,43);assert.equal(highMinimum.max,43);
console.log('PASS: land maximum 41 in all 14 templates, boundary counts, one-time migration, custom targets/profiles and later edits/deletions preserved.');
