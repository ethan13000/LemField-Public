/* Resolve missing card art through Scryfall, serialized at <=2 requests/second. */
(()=>{
'use strict';
const cache=new Map(),pending=new Map(),normalJobs=[],priorityJobs=[],hoverJobs=[],queuedJobs=new Map();let draining=false,artTagNamesCache=null,artTagNamesPending=null;
function enqueue(run,priority=false,key=null){
 const result=new Promise((resolve,reject)=>{const job={run,resolve,reject,key};if(key)queuedJobs.set(key,job);if(priority===2)hoverJobs.unshift(job);else (priority?priorityJobs:normalJobs).push(job);});
 drain();return result;
}
function promote(key){const job=queuedJobs.get(key);if(!job)return;for(const jobs of [normalJobs,priorityJobs,hoverJobs]){const index=jobs.indexOf(job);if(index>=0)jobs.splice(index,1);}hoverJobs.unshift(job);}
async function yieldToHover(){
 while(hoverJobs.length){const job=hoverJobs.shift();if(job.key)queuedJobs.delete(job.key);try{job.resolve(await job.run());}catch(error){job.reject(error);}await new Promise(resolve=>setTimeout(resolve,500));}
}
async function drain(){
 if(draining)return;draining=true;
 try{while(hoverJobs.length||priorityJobs.length||normalJobs.length){const job=hoverJobs.shift()||priorityJobs.shift()||normalJobs.shift();if(job.key)queuedJobs.delete(job.key);try{job.resolve(await job.run());}catch(error){job.reject(error);}await new Promise(resolve=>setTimeout(resolve,500));}}
 finally{draining=false;}
}
function cardResult(card){const images=globalThis.MoxEDHREC.imageURLs(card);return {ok:true,url:images[0]||null,images,description:String(card.oracle_text||card.card_faces?.map(face=>face.oracle_text).filter(Boolean).join('\n')||'').trim(),manaCost:String(card.mana_cost||''),details:globalThis.MoxCardSearch?.metadata(card)};}
function store(name,result){if(cache.size>=300&&!cache.has(name))cache.delete(cache.keys().next().value);cache.set(name,{time:Date.now(),result});}
function artTagNames(message){
 const relevant=tags=>{const ids=Array.isArray(message?.illustrationIds)?message.illustrationIds.filter(id=>typeof id==='string'):[],counts=new Map();for(const id of ids)counts.set(id,(counts.get(id)||0)+1);return {ok:true,tags:tags.map(tag=>({label:tag.label,count:tag.ids.reduce((sum,id)=>sum+(counts.get(id)||0),0)})).filter(tag=>tag.count>0&&tag.count<ids.length).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label))};};
 if(artTagNamesCache)return Promise.resolve(relevant(artTagNamesCache));
 if(artTagNamesPending)return artTagNamesPending.then(()=>relevant(artTagNamesCache||[]));
 artTagNamesPending=enqueue(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch('https://api.scryfall.com/private/tags/illustration',{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json','User-Agent':'MoxfieldRequirements/1.9'}});
   if(!response.ok)throw Error(response.status===429?'Scryfall rate limit reached. Try again shortly.':'Scryfall art tags are unavailable.');
   const payload=await (globalThis.MoxResponses?globalThis.MoxResponses.json(response):response.json());if(!Array.isArray(payload.data)||payload.data.length>100000)throw Error('Unrecognized Scryfall art tag list.');
   const tags=[...new Set(payload.data.map(row=>typeof row?.label==='string'?row.label.trim():'').filter(label=>label.length>0&&label.length<=100))].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true}));
   if(!tags.length)throw Error('Scryfall returned no art tags.');artTagNamesCache=payload.data.filter(row=>typeof row?.label==='string'&&Array.isArray(row.illustration_ids)).map(row=>({label:row.label,ids:[...new Set(row.illustration_ids)]}));return relevant(artTagNamesCache);
  }catch(error){return {ok:false,error:error.name==='AbortError'?'Scryfall art tag lookup timed out.':error.message};}
  finally{clearTimeout(timer);artTagNamesPending=null;}
 },true);return artTagNamesPending;
}
async function deckTokens(message){
 if(!Array.isArray(message.names)||message.names.length>500||message.names.some(name=>typeof name!=='string'||name.length>160))return {ok:false,error:'Invalid deck token request.'};
 const collection=identifiers=>enqueue(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',credentials:'omit',signal:controller.signal,headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({identifiers})});if(!response.ok)throw Error('Token lookup failed: HTTP '+response.status);const data=await (globalThis.MoxResponses?globalThis.MoxResponses.json(response):response.json());if(!Array.isArray(data.data)||data.data.length>75)throw Error('Invalid token response.');return data.data;}finally{clearTimeout(timer);}},true);
 try{const ids=new Set(),names=[...new Set(message.names)];for(let i=0;i<names.length;i+=75){const cards=await collection(names.slice(i,i+75).map(name=>({name})));for(const card of cards)for(const part of card.all_parts||[])if(part.component==='token'&&/^[a-f0-9-]{36}$/i.test(part.id))ids.add(part.id);}
 const tokens=[],all=[...ids];for(let i=0;i<all.length;i+=75)tokens.push(...await collection(all.slice(i,i+75).map(id=>({id}))));return {ok:true,cards:tokens.map(card=>({...globalThis.MoxCardSearch.metadata(card),id:'scryfall-token:'+card.id,tokenSourceId:'scryfall-token:'+card.id,name:card.name,section:'tokens',qty:1,isToken:true,type:card.type_line||'Token',scryfallId:card.id,set:card.set,collectorNumber:card.collector_number,image:globalThis.MoxEDHREC.imageURLs(card)[0]||null}))};
 }catch(error){return {ok:false,error:error.message};}
}
function readBatch(message){
 if(!Array.isArray(message.names)||!message.names.length||message.names.length>75||message.names.some(name=>typeof name!=='string'||!name.trim()||name.length>160))return;
 const names=[...new Set(message.names.map(name=>name.trim()))],batchKey='batch:'+JSON.stringify([...names].sort());
 if(pending.has(batchKey))return pending.get(batchKey);
 const results=new Map(),missing=[];
 for(const name of names){const hit=cache.get(name);if(hit?.result.ok&&hit.result.details&&Date.now()-hit.time<86400000)results.set(name,{name,...hit.result});else missing.push(name);}
 if(!missing.length)return Promise.resolve({ok:true,cards:names.map(name=>results.get(name))});
 const work=enqueue(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',credentials:'omit',signal:controller.signal,headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'MoxfieldRequirements/1.9'},body:JSON.stringify({identifiers:missing.map(name=>({name}))})});
   if(!response.ok)throw Error(response.status===429?'Scryfall rate limit reached. Try again shortly.':'Card detail batch unavailable.');
   const payload=await (globalThis.MoxResponses?globalThis.MoxResponses.json(response):response.json());if(!Array.isArray(payload.data)||payload.data.length>75)throw Error('Unrecognized card detail batch.');
   const normalized=name=>String(name||'').normalize('NFKC').trim().toLowerCase();
   for(const name of missing){
    const card=payload.data.find(card=>card&&[card.name,...(Array.isArray(card.card_faces)?card.card_faces.map(face=>face?.name):[])].some(alias=>normalized(alias)===normalized(name)));
    if(!card){results.set(name,{name,ok:false,error:'Card details unavailable.'});continue;}
    const result=cardResult(card);store(name,result);results.set(name,{name,...result});
   }
   return {ok:true,cards:names.map(name=>results.get(name))};
  }catch(error){return {ok:false,error:error.name==='AbortError'?'Scryfall batch timed out.':error.message};}
  finally{clearTimeout(timer);}
 },true).finally(()=>pending.delete(batchKey));
 pending.set(batchKey,work);return work;
}
function searchRole(message){
 if(typeof message.query!=='string'||!message.query.trim()||message.query.length>6000||!Number.isSafeInteger(message.page)||message.page<1)return;
 const key='role:'+JSON.stringify([message.query,message.page]),cached=cache.get(key);
 if(cached&&Date.now()-cached.time<3600000)return Promise.resolve(cached.result);
 if(pending.has(key))return pending.get(key);
 const work=enqueue(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch('https://api.scryfall.com/cards/search?'+new URLSearchParams({q:message.query,unique:'cards',order:'edhrec',dir:'asc',page:String(message.page)}),{credentials:'omit',signal:controller.signal,headers:{Accept:'application/json','User-Agent':'MoxfieldRequirements/1.9'}});
   if(response.status===404)return {ok:true,cards:[],hasMore:false};
   if(!response.ok)throw Error(response.status===429?'Scryfall rate limit reached. Try again shortly.':'Role search unavailable.');
   const payload=await (globalThis.MoxResponses?globalThis.MoxResponses.json(response):response.json());if(!Array.isArray(payload.data)||payload.data.length>200)throw Error('Unrecognized role search response.');
   const cards=payload.data.filter(card=>typeof card?.name==='string'&&card.name.length<=160).map(card=>({...globalThis.MoxCardSearch.metadata(card),name:card.name,key:globalThis.MoxEDHREC.slug(card.name),url:'https://edhrec.com/cards/'+globalThis.MoxEDHREC.slug(card.name),image:globalThis.MoxEDHREC.imageURLs(card)[0]||null,images:globalThis.MoxEDHREC.imageURLs(card),edhrecRank:Number.isFinite(card.edhrec_rank)?card.edhrec_rank:null,source:'scryfall',lift:null,inclusion:null,numDecks:null}));
   const result={ok:true,cards,hasMore:payload.has_more===true};store(key,result);return result;
  }catch(error){return {ok:false,error:error.name==='AbortError'?'Role search timed out.':error.message};}
  finally{clearTimeout(timer);}
 },true).finally(()=>pending.delete(key));pending.set(key,work);return work;
}
function artChoice(message){
 if(typeof message.name!=='string'||!message.name.trim()||message.name.length>160||!['cheapest','most','oldest','newest'].includes(message.mode))return;
 const name=message.name.trim(),mode=message.mode,key='art-choice:'+JSON.stringify([name,mode,message.isToken===true]),cached=cache.get(key);
 if(cached&&Date.now()-cached.time<86400000)return Promise.resolve(cached.result);
 if(pending.has(key)){if(message.priority==='hover')promote(key);return pending.get(key);}
 const work=enqueue(async()=>{
  const query='!"'+name.split(' // ')[0].replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'" lang:en -is:artseries'+(message.isToken===true?' t:token':'');
  const order=mode==='cheapest'?'usd':'released',dir=mode==='oldest'||mode==='cheapest'?'asc':'desc',rows=[];let more=false;
  try{
   const standard=row=>!row.fullArt&&!row.textless&&row.borderColor!=='borderless'&&row.layout!=='art_series'&&!row.frameEffects.includes('extendedart');
   const queries=mode==='oldest'?[query+' -is:full -border:borderless',query]:[query];
   for(const searchQuery of queries){
   rows.length=0;
   for(let page=1;page<=(mode==='most'?100:1);page++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
     const response=await fetch('https://api.scryfall.com/cards/search?'+new URLSearchParams({q:searchQuery,unique:'prints',order,dir,include_extras:'true',page:String(page)}),{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json','User-Agent':'MoxfieldRequirements/1.9'}});
     if(response.status===404&&mode==='oldest'&&searchQuery!==query)break;
     if(!response.ok)throw Error(response.status===429?'Scryfall rate limit reached. Try again shortly.':'Artwork printings unavailable.');
     const body=await (globalThis.MoxResponses?globalThis.MoxResponses.json(response):response.json());if(!Array.isArray(body.data)||body.data.length>200)throw Error('Unrecognized artwork response.');
     rows.push(...body.data.map(globalThis.MoxCardSearch.printing).filter(row=>row.layout!=='art_series'&&row.lang==='en'&&row.image&&row.set&&row.collectorNumber&&(mode!=='oldest'||searchQuery===query||standard(row))));more=body.has_more===true;
    }finally{clearTimeout(timer);}
    if(!more||mode!=='most')break;
    await new Promise(resolve=>setTimeout(resolve,500));await yieldToHover();
   }
   if(rows.length)break;
   }
   if(mode==='most'&&more)throw Error('This card has too many printings to count its artwork accurately.');
   if(!rows.length)throw Error('No readable English artwork printing was found.');
   let chosen;
   if(mode==='most'){
    const groups=new Map();for(const row of rows){const art=row.illustrationId||row.image;const group=groups.get(art)||[];group.push(row);groups.set(art,group);}
    chosen=[...groups.values()].sort((a,b)=>b.length-a.length||b.filter(standard).length-a.filter(standard).length||(a[0].price??Infinity)-(b[0].price??Infinity))[0].sort((a,b)=>Number(!standard(a))-Number(!standard(b))||Number(a.promo||a.digital)-Number(b.promo||b.digital)||(a.price??Infinity)-(b.price??Infinity))[0];
   }else chosen=mode==='cheapest'?rows.find(row=>Number.isFinite(row.price))||rows[0]:rows[0];
   const result={ok:true,printing:chosen};if(cache.size>=300)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),result});return result;
  }catch(error){return {ok:false,error:error.name==='AbortError'?'Artwork lookup timed out.':error.message};}
 },message.priority==='hover'?2:true,key).finally(()=>pending.delete(key));pending.set(key,work);return work;
}
browser.runtime.onMessage.addListener(message=>{
 if(message?.type==='mrd-prioritize-art'&&typeof message.key==='string'&&message.key.length<=500){promote(message.key);return Promise.resolve({ok:true});}
 if(message?.type==='mrd-deck-tokens')return deckTokens(message);
 if(message?.type==='mrd-art-tag-names')return artTagNames(message);
 if(message?.type==='mrd-card-details-batch')return readBatch(message);
 if(message?.type==='mrd-role-cards')return searchRole(message);
 if(message?.type==='mrd-card-art-choice')return artChoice(message);
 if(!['mrd-card-art','mrd-card-printings'].includes(message?.type)||typeof message.name!=='string'||!message.name.trim()||message.name.length>160)return;
 const prints=message.type==='mrd-card-printings',page=message.page??1;
 const printingId=message.printingId;if(printingId!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(printingId))return;
 const printing=message.printing;if(printing&&(!/^[a-z0-9]{2,10}$/i.test(printing.set||'')||typeof printing.collectorNumber!=='string'||!printing.collectorNumber||printing.collectorNumber.length>30))return;
 if(prints&&(!Number.isInteger(page)||page<1||page>100))return;
 const artTag=prints&&typeof message.artTag==='string'?message.artTag.trim().slice(0,80):'',name=message.name.trim(),key=prints?JSON.stringify([name,page,message.secretLair===true,message.isToken===true,artTag]):printingId?'printing:'+printingId:printing?'printing:'+printing.set+'/'+printing.collectorNumber:name,cached=cache.get(key);
 if(cached&&Date.now()-cached.time<(cached.result.ok&&(prints||cached.result.url)?86400000:60000))return Promise.resolve(cached.result);
 if(pending.has(key)){if(message.priority==='hover')promote(key);return pending.get(key);}
 const work=enqueue(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  let result;
  try{
   const safeArtTag=artTag.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80),query='!"'+name.split(' // ')[0].replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"'+(safeArtTag?' art:"'+safeArtTag.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"':'')+' -is:artseries'+(message.isToken===true?' t:token':'')+(message.secretLair===true?' (set:sld or set:slx or set:slc or set:slp)':'');
   const endpoint=prints?'https://api.scryfall.com/cards/search?'+new URLSearchParams({q:query,unique:'prints',order:'released',dir:'desc',include_extras:'true',page:String(page)}):printingId?'https://api.scryfall.com/cards/'+printingId:printing?'https://api.scryfall.com/cards/'+encodeURIComponent(printing.set)+'/'+encodeURIComponent(printing.collectorNumber):'https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name);
   const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json','User-Agent':'MoxfieldRequirements/1.9'}});
   if(prints&&response.status===404)result={ok:true,cards:[],hasMore:false,total:0};
   else {
    if(!response.ok)throw new Error(response.status===429?'Scryfall rate limit reached. Try again shortly.':'Card details unavailable.');
    const card=await (globalThis.MoxResponses?globalThis.MoxResponses.json(response):response.json());
    if(prints){
     if(!Array.isArray(card.data))throw Error('Unrecognized printing response.');
     result={ok:true,cards:card.data.map(globalThis.MoxCardSearch.printing).filter(c=>c.layout!=='art_series'&&c.id&&c.name&&c.url),hasMore:card.has_more===true&&page<100,total:Number.isFinite(card.total_cards)?card.total_cards:null};
    }else result=cardResult(card);
   }
  }catch(error){result={ok:false,error:error.name==='AbortError'?'Scryfall request timed out.':error.message};}
  finally{clearTimeout(timer);}
  if(cache.size>=300)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),result});
  return result;
 },message.priority==='hover'?2:false,key).finally(()=>pending.delete(key));
 pending.set(key,work);return work;
});
})();
