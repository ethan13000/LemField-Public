/* Sync small print preferences only. Artwork and account credentials stay local. */
(()=>{
 'use strict';
 const local=browser.storage.local,sync=browser.storage.sync;
 const META='mrd_print_sync_meta_v1',DEVICE='mrd_print_sync_device_v1',STATUS='mrd_print_sync_status_v1',CLOUD='lfp1:';
 const sections=new Set(['mainboard','commanders','companions','sideboard','maybeboard','tokens']);
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const identity=storedKey=>{
  const quantity=storedKey.startsWith('mrd_token_quantity:');
  const key=quantity?storedKey.slice('mrd_token_quantity:'.length):storedKey;
  const match=key.match(/^mrd_print_edition_v1:([A-Za-z0-9_-]{1,100}):(.+)$/);if(!match)return null;
  try{const parts=JSON.parse(decodeURIComponent(match[2]));if(!Array.isArray(parts)||(parts.length!==2&&!(parts.length===3&&parts[0]==='tokens'&&typeof parts[2]==='string'&&parts[2].length>0&&parts[2].length<=160))||!sections.has(parts[0])||typeof parts[1]!=='string'||!parts[1].trim()||parts[1].length>160||quantity&&parts[0]!=='tokens')return null;return {quantity,deck:match[1],section:parts[0],name:parts[1],tokenSourceId:parts[2]};}catch{return null;}
 };
 function clean(key,value){
  const id=identity(key);if(!id)return undefined;
  if(!id.quantity&&id.tokenSourceId&&value?.tokenSourceId!==id.tokenSourceId)return undefined;
  if(id.quantity)return Number.isInteger(value)&&value>=0&&value<=100?value:undefined;
  if(!value||value.version!==1||typeof value.name!=='string'||value.name.length>160||value.name.normalize('NFKC').trim().toLowerCase()!==id.name||value.section!==id.section||typeof value.printingId!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.printingId)||typeof value.set!=='string'||! /^[a-z0-9]{2,10}$/i.test(value.set)||typeof value.collectorNumber!=='string'||!value.collectorNumber||value.collectorNumber.length>30)return undefined;
  return {version:1,name:value.name,section:value.section,printingId:value.printingId,set:value.set,collectorNumber:value.collectorNumber,selectedAt:Number.isSafeInteger(value.selectedAt)&&value.selectedAt>=0?value.selectedAt:0,...(id.section==='tokens'&&typeof value.tokenSourceId==='string'&&value.tokenSourceId.length<=160?{tokenSourceId:value.tokenSourceId}:{}),...(id.section==='tokens'&&value.standaloneToken===true?{standaloneToken:true}:{})};
 }
 const validRecord=(key,r)=>r?.v===1&&Number.isSafeInteger(r.t)&&r.t>0&&typeof r.d==='string'&&r.d.length>0&&r.d.length<=80&&(r.value===null||clean(key,r.value)!==undefined);
 const newer=(a,b)=>!b||a.t>b.t||a.t===b.t&&a.d>b.d||a.t===b.t&&a.d===b.d&&JSON.stringify(a.value)>JSON.stringify(b.value);
 let chain=Promise.resolve(),timer=null;const dirty=new Map();
 async function reconcile(){
  const edits=new Map(dirty),values=await local.get(null),device=values[DEVICE]||crypto.randomUUID(),meta=Object.create(null),changes=Object.create(null);
  for(const [key,r] of Object.entries(values[META]||{}))if(identity(key)&&validRecord(key,r))meta[key]=r;
  let remote={},failure=null;
  try{if(!sync)throw Error('Browser sync is unavailable. Use Export / Import to transfer print settings.');remote=await sync.get(null);}catch(error){failure=error;}
  const keys=new Set([...Object.keys(values).filter(identity),...Object.keys(meta),...Object.keys(remote).filter(k=>k.startsWith(CLOUD)).map(k=>k.slice(CLOUD.length)).filter(identity)]);
  const cloudWrites=Object.create(null);
  for(const key of keys){
   const current=values[key]==null?null:clean(key,values[key]);
   if(current===undefined)continue; // Never replace malformed local data silently.
   let record=meta[key];const candidate=remote[CLOUD+key],cloud=validRecord(key,candidate)?{...candidate,value:candidate.value===null?null:clean(key,candidate.value)}:null;
   if(record&&!equal(record.value,current))record={v:1,t:Math.max(Date.now(),record.t+1,cloud?.t+1||0),d:device,value:current};
   else if(!record&&(current!==null||edits.has(key))){
    // Existing edition timestamps survive migration. Untimestamped quantities defer to cloud.
    const t=current?.selectedAt||edits.get(key)||1;record={v:1,t,d:device,value:current};
   }
   if(cloud&&(!record||newer(cloud,record)))record=cloud;
   if(!record)continue;
   meta[key]=record;
   if(!equal(current,record.value))changes[key]=record.value;
   if(!equal(cloud,record))cloudWrites[CLOUD+key]=record;
  }
  // A user can edit a card while the cloud read is pending. Leave that key for the next pass.
  const latest=await local.get(null);
  for(const key of keys)if(!equal(values[key],latest[key])){delete changes[key];delete cloudWrites[CLOUD+key];if(latest[META]?.[key])meta[key]=latest[META][key];else delete meta[key];}else if(dirty.get(key)===edits.get(key))dirty.delete(key);
  await local.set({...changes,[DEVICE]:device,[META]:meta});
  if(!failure&&Object.keys(cloudWrites).length){try{await sync.set(cloudWrites);}catch(error){failure=error;}}
  const previous=latest[STATUS]||{};
  const status={state:failure?'error':'ready',message:failure?'Saved locally; sync unavailable: '+failure.message+' Export a backup to transfer settings.':'Browser sync is ready. Browser account sync must be enabled on both devices.',lastSyncedAt:failure?previous.lastSyncedAt||null:Date.now(),count:Object.values(meta).filter(r=>r.value!==null).length};
  await local.set({[STATUS]:status});return status;
 }
 const run=()=>{clearTimeout(timer);timer=null;const work=chain.catch(()=>{}).then(reconcile);chain=work;return work;};
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{run().catch(()=>{});},1000);};
 browser.storage.onChanged?.addListener((changes,area)=>{if(area==='local'){for(const key of Object.keys(changes))if(identity(key))dirty.set(key,Date.now());}if(area==='local'&&Object.keys(changes).some(identity)||area==='sync'&&Object.keys(changes).some(k=>k.startsWith(CLOUD)))schedule();});
 browser.runtime.onMessage.addListener(message=>{
  if(message?.type!=='mrd-print-sync')return;
  return (async()=>{
   if(message.action==='status')return {ok:true,status:(await local.get(STATUS))[STATUS]||{state:'pending',message:'Checking browser sync?'}};
   if(message.action==='now')return {ok:true,status:await run()};
   if(message.action==='export'){
    await chain.catch(()=>{});const values=await local.get(null),entries=Object.create(null);
    for(const [key,value] of Object.entries(values)){const normalized=clean(key,value);if(normalized!==undefined)entries[key]=normalized;}
    return {ok:true,backup:{format:'lemfield-print-settings',version:1,exportedAt:new Date().toISOString(),entries}};
   }
   if(message.action==='import'){
    const b=message.backup;if(!b||b.format!=='lemfield-print-settings'||b.version!==1||!b.entries||typeof b.entries!=='object'||Array.isArray(b.entries)||JSON.stringify(b).length>5*1024*1024)throw Error('Choose a LemField print-settings backup smaller than 5 MB.');
    const entries=Object.entries(b.entries);if(entries.length>5000)throw Error('Backup contains too many settings.');
    const normalized=Object.create(null);for(const [key,value] of entries){const v=clean(key,value);if(v===undefined)throw Error('Backup contains an invalid print setting. Nothing was imported.');normalized[key]=v;}
    // Explicit imports are new edits, even on a device without previous local records.
    await chain.catch(()=>{});const values=await local.get(null),meta={...(values[META]||{})},device=values[DEVICE]||crypto.randomUUID();
    for(const [key,value] of Object.entries(normalized))meta[key]={v:1,t:Math.max(Date.now(),(meta[key]?.t||0)+1),d:device,value};
    await local.set({...normalized,[META]:meta,[DEVICE]:device});return {ok:true,count:entries.length,status:await run()};
   }
   throw Error('Unknown print sync action.');
  })().catch(error=>({ok:false,error:error.message}));
 });
 run().catch(()=>{});
})();
