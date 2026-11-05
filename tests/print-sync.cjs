const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../print-sync.js'),'utf8');
const copy=value=>structuredClone(value),cloud={},devices=[];let clock=10000,failSync=false,failWrites=false;
const key='mrd_print_edition_v1:deckA:'+encodeURIComponent(JSON.stringify(['tokens','treasure'])),quantity='mrd_token_quantity:'+key;
const choice=(number,time=100)=>({version:1,name:'Treasure',section:'tokens',printingId:'00000000-0000-4000-8000-'+String(number).padStart(12,'0'),set:'tset',collectorNumber:String(number),selectedAt:time});
function device(name,initial={},noSync=false){
 const values=copy(initial),handlers=[],messages=[],timers=new Map();let next=0;
 const emit=(changes,area)=>handlers.forEach(fn=>fn(copy(changes),area));
 const area=(storage,kind)=>({
  async get(keys){if(kind==='sync'&&failSync)throw Error('Offline');if(kind==='sync'&&d.beforeCloudRead){const fn=d.beforeCloudRead;d.beforeCloudRead=null;await fn();}if(keys===null)return copy(storage);if(typeof keys==='string')return {[keys]:copy(storage[keys])};return Object.fromEntries(keys.map(k=>[k,copy(storage[k])]));},
  async set(entries){if(kind==='sync'&&(failSync||failWrites))throw Error('QUOTA_BYTES exceeded');const changes={};for(const [k,v] of Object.entries(entries))if(JSON.stringify(storage[k])!==JSON.stringify(v)){changes[k]={oldValue:copy(storage[k]),newValue:copy(v)};storage[k]=copy(v);}if(Object.keys(changes).length){if(kind==='sync')devices.forEach(d=>d.emit(changes,kind));else emit(changes,kind);}},
  async remove(keys){const changes={};for(const k of Array.isArray(keys)?keys:[keys]){if(Object.hasOwn(storage,k)){changes[k]={oldValue:storage[k]};delete storage[k];}}if(Object.keys(changes).length)emit(changes,kind);}
 });
 const local=area(values,'local'),sync=noSync?undefined:area(cloud,'sync');
 const context={browser:{storage:{local,sync,onChanged:{addListener:fn=>handlers.push(fn)}},runtime:{onMessage:{addListener:fn=>messages.push(fn)}}},crypto:{randomUUID:()=>name},Date:class extends Date{static now(){return clock;}},setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)};
 const d={values,local,emit,context,send:async(action,extra={})=>messages[0]({type:'mrd-print-sync',action,...extra}),sync:async()=>{const r=await d.send('now');assert.equal(r.ok,true,r.error);return r.status;}};devices.push(d);vm.runInNewContext(source,context);return d;
}
(async()=>{
 const a=device('A',{[key]:choice(1),[quantity]:3,mrd_uploaded_art_v1:'private-image',authorization:'secret'});await a.sync();
 assert.equal(Object.keys(cloud).length,2);assert(!JSON.stringify(cloud).includes('secret'));assert(!JSON.stringify(cloud).includes('private-image'));
 const b=device('B');await b.sync();assert.equal(b.values[key].collectorNumber,'1');assert.equal(b.values[quantity],3,'Existing token quantities migrate');
 clock++;await b.local.set({[key]:choice(2,clock),[quantity]:0});await b.sync();await a.sync();assert.equal(a.values[key].collectorNumber,'2');assert.equal(a.values[quantity],0,'Zero quantities sync without becoming defaults');
 clock++;await a.local.remove(key);await a.sync();await b.sync();assert.equal(b.values[key],null,'Reset propagates as a tombstone');
 const stale=device('stale',{[key]:choice(1,100)});await stale.sync();assert.equal(stale.values[key],null,'Old device cannot resurrect a deleted edition');
 const reloaded=device('reloaded',a.values);await reloaded.sync();assert(reloaded.values[key]==null,'Deletion survives background restart');
 clock++;await b.local.set({[key]:choice(3,clock)});await b.sync();await a.sync();assert.equal(a.values[key].collectorNumber,'3','A new selection can replace a tombstone');
 // Offline concurrent edits converge by timestamp; equal timestamps use the device ID.
 failSync=true;clock++;await a.local.set({[key]:choice(4,clock)});await a.sync();clock++;await b.local.set({[key]:choice(5,clock)});assert.equal((await b.sync()).state,'error');failSync=false;await a.sync();await b.sync();await a.sync();assert.equal(a.values[key].collectorNumber,'5');assert.equal(b.values[key].collectorNumber,'5');
 failSync=true;clock++;await a.local.set({[key]:choice(6,clock)});await a.sync();await b.local.set({[key]:choice(7,clock)});await b.sync();failSync=false;await a.sync();await b.sync();await a.sync();assert.equal(a.values[key].collectorNumber,'7','Tie breaks deterministically by device ID');
 const freshQuantity='mrd_token_quantity:mrd_print_edition_v1:deckA:'+encodeURIComponent(JSON.stringify(['tokens','goblin']));clock++;await a.local.set({[freshQuantity]:12});await a.sync();await b.sync();assert.equal(b.values[freshQuantity],12,'New quantity keys are recorded as edits');
 const backup=(await a.send('export')).backup;assert.equal(backup.entries[key].collectorNumber,'7');assert(!JSON.stringify(backup).includes('authorization'));
 const offline=device('offline',{},true);const imported=await offline.send('import',{backup});assert.equal(imported.ok,true);assert.equal(imported.status.state,'error');assert.equal(offline.values[key].collectorNumber,'7','Import works without sync');
 const before=JSON.stringify(offline.values),bad=copy(backup);bad.entries.authorization='stolen';assert.equal((await offline.send('import',{backup:bad})).ok,false);assert.equal(JSON.stringify(offline.values),before,'Invalid import is atomic');
 bad.entries={...backup.entries,[quantity]:101};assert.equal((await offline.send('import',{backup:bad})).ok,false);
 failWrites=true;clock++;await a.local.set({[quantity]:9});const failed=await a.sync();assert.equal(failed.state,'error');assert.match(failed.message,/QUOTA_BYTES/);assert.equal(a.values[quantity],9,'Quota failure retains local settings');failWrites=false;await a.sync();await b.sync();assert.equal(b.values[quantity],9,'Retry sends retained edits');
 clock++;a.beforeCloudRead=()=>a.local.set({[key]:choice(8,clock)});await a.sync();assert.equal(a.values[key].collectorNumber,'8','A concurrent user edit survives a pending cloud read');await a.sync();await b.sync();assert.equal(b.values[key].collectorNumber,'8');
 // A backup on the Moxfield origin must not resurrect a remotely cleared choice.
 const site=new Map([['lemfield_print_backup_v1:'+key,JSON.stringify(choice(1))]]),localStorage={get length(){return site.size;},key:i=>[...site.keys()][i],getItem:k=>site.get(k),setItem:(k,v)=>site.set(k,v),removeItem:k=>site.delete(k)};
 clock++;await a.local.remove(key);await a.sync();a.context.location={origin:'https://moxfield.com'};a.context.localStorage=localStorage;
 vm.runInNewContext(fs.readFileSync(require.resolve('../print-preferences.js'),'utf8'),a.context);assert.equal((await a.context.MoxPrintPreferences.read('deckA')).size,0,'Site backup respects sync tombstones');
 const variantKey='mrd_print_edition_v1:deckA:'+encodeURIComponent(JSON.stringify(['tokens','treasure','variant-a'])),otherKey='mrd_print_edition_v1:deckA:'+encodeURIComponent(JSON.stringify(['tokens','treasure','variant-b']));
 clock++;await a.local.set({[variantKey]:{...choice(9,clock),tokenSourceId:'variant-a'},[otherKey]:{...choice(10,clock),tokenSourceId:'variant-b'},['mrd_token_quantity:'+variantKey]:2,['mrd_token_quantity:'+otherKey]:4});await a.sync();await b.sync();assert.equal(b.values[variantKey].collectorNumber,'9');assert.equal(b.values[otherKey].collectorNumber,'10');assert.equal(b.values['mrd_token_quantity:'+variantKey],2);assert.equal(b.values['mrd_token_quantity:'+otherKey],4);
 const variantBackup=(await a.send('export')).backup;assert(variantBackup.entries[variantKey]);assert.equal((await offline.send('import',{backup:variantBackup})).ok,true,'Variant identities survive backup transfer');
 console.log('PASS: two-device migration, selections/zero quantities, deletion/restart/stale-device protection, offline conflicts and ties, safe backups/imports, quota retry, and site-backup tombstones.');
})().catch(error=>{console.error(error);process.exitCode=1;});
