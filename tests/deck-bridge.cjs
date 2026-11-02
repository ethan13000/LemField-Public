const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const events={},replies=[],calls=[];
 const window={addEventListener:(name,fn)=>events[name]=fn,postMessage:message=>replies.push(message)};
 function XHR(){}XHR.prototype.open=function(){};XHR.prototype.setRequestHeader=function(){};
 let mode='ok',clock=0,verifyPending=false;
 window.fetch=async(url,options={})=>{
  calls.push({url,options});if(mode==='slow')clock+=16000;
  if(mode==='hung')return new Promise(()=>{});
  if(mode==='hungBody')return {ok:true,json:()=>new Promise(()=>{})};
  if(mode==='forbidden')return {ok:false,status:403};
  if(mode==='sameId'&&url.includes('/cards/search/user'))return {ok:true,json:async()=>({data:[{id:'card1',name:'Sol Ring',set:'sld',cn:'123'}]})};
  const deckRead=new URL(url).pathname==='/v3/decks/all/public1';
  if(options.method==='PUT'){
   if(mode==='putForbidden')return {ok:false,status:403};
   if(mode==='putUnknown')throw new TypeError('network lost');
   if(mode==='put500')return {ok:false,status:500};
   if(mode==='putBadJSON')return {ok:true,json:async()=>{throw new SyntaxError('Bad response');}};
   verifyPending=true;
   return {ok:true,json:async()=>({card:{card:{id:'card2',name:'Sol Ring',set:'sld',cn:'123'},quantity:3}})};
  }
  if(deckRead){
   const changed=verifyPending&&mode!=='missingReplacement';
   const card={id:mode==='sameId'?'card1':changed?'card2':'card1',name:'Sol Ring',set:changed?'sld':'cmm',cn:changed?'123':'396'};
   const entry={quantity:changed&&mode==='wrongQuantity'?6:3,card};
   return {ok:true,json:async()=>mode==='directBoard'?{mainboard:{card1:{quantity:entry.quantity,cardData:card}}}:{boards:{mainboard:{cards:{card1:entry}}}}};
  }
  if(url.endsWith('/v3/decks'))return {ok:true,json:async()=>({decks:[{id:'internal1',publicId:'public1',name:'My deck'}]})};
  if(url.endsWith('/v3/decks/all/public1'))return {ok:true,json:async()=>({boards:{mainboard:{cards:{card1:{quantity:3,card:{id:'card1',name:'Sol Ring',set:'cmm',cn:'396'}}}}}})};
  if(url.includes('/cards/search/user'))return {ok:true,json:async()=>({hasMore:mode==='slow',data:[{id:'wrong',name:'Sol Talisman'},{id:'card1',name:mode==='mismatch'?'Not Sol Ring':'Sol Ring',set:'cmm',cn:'396'},{id:'card2',name:'Sol Ring',set:'sld',cn:mode==='slow'?'999':'123',scryfall_id:'selected-print'}]})};
  if(options.method==='POST'){
   if(mode==='unknown')throw new TypeError('network lost');if(mode==='post500')return {ok:false,status:500};if(mode==='badJSON')return {ok:true,json:async()=>{throw new SyntaxError('Bad response');}};
   const body=JSON.parse(options.body);if(body.quantity===3){verifyPending=true;return {ok:true,json:async()=>({card:{card:{id:'card2',name:'Sol Ring',set:'sld',cn:'123'},quantity:3}})};}
   return {ok:true,json:async()=>({card:{card:{name:'Sol Ring'},quantity:1}})};
  }
  return {ok:true,json:async()=>({})};
 };
 const ctx={Date:{now:()=>clock},window,XMLHttpRequest:XHR,URL,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,mode.startsWith('hung')?5:ms),clearTimeout,TypeError,location:{href:'https://moxfield.com/cards/test',origin:'https://moxfield.com',pathname:'/cards/test'}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'deck-bridge.js'),'utf8'),ctx);
 let counter=0;
 const command=async(values,id)=>{
  verifyPending=false;
  const requestId=id||'00000000-0000-4000-8000-'+String(++counter).padStart(12,'0');
  events.message({source:window,origin:ctx.location.origin,data:{source:'mrd-deck-command-v1',requestId,...values}});
  for(let i=0;i<300;i++){await new Promise(r=>setTimeout(r,10));const reply=replies.findLast(r=>r.source==='mrd-deck-result-v1'&&r.requestId===requestId);if(reply)return reply;}
  throw new Error('No bridge reply');
 };
 assert.match((await command({action:'decks'})).error,/Sign in/);assert.equal(calls.length,0);
 // Authorization on unrelated origins is never captured.
 await window.fetch('https://example.com/data',{headers:{Authorization:'Bearer external'}});
 assert.match((await command({action:'decks'})).error,/Sign in/);
 await window.fetch('https://api2.moxfield.com/v3/profile',{headers:{Authorization:'Bearer session-secret'}});
 const list=await command({action:'decks'});assert.equal(list.data.decks[0].publicId,'public1');assert(!JSON.stringify(list).includes('session-secret'));
 const add={action:'add',name:'Sol Ring',deck:'public1',board:'mainboard'};
 let result=await command({...add,deck:'other-person'});assert.equal(result.ok,false);assert.match(result.error,/own Moxfield decks/);
 result=await command({...add,board:'commanders'});assert.equal(result.ok,false);
 mode='mismatch';result=await command({...add,name:'Absent card'});assert.equal(result.ok,false);assert.match(result.error,/exact Moxfield card match/);assert.equal(calls.filter(c=>c.options.method==='POST').length,0);
 mode='ok';const id='00000000-0000-4000-8000-000000009999';result=await command(add,id);assert.equal(result.ok,true);
 const write=calls.find(c=>c.options.method==='POST');assert.equal(write.url,'https://api2.moxfield.com/v2/decks/internal1/cards/mainboard');assert.deepEqual(JSON.parse(write.options.body),{cardId:'card1',quantity:1,usePrefPrinting:true});
 await command(add,id);assert.equal(calls.filter(c=>c.options.method==='POST').length,1);
 mode='unknown';result=await command(add);assert.match(result.error,/result unknown/);assert.equal(calls.filter(c=>c.options.method==='POST').length,2);
 mode='ok';result=await command({...add,printing:{set:'sld',collectorNumber:'123',scryfallId:'selected-print'}});assert.equal(result.ok,true);
 assert.deepEqual(JSON.parse(calls.findLast(c=>c.options.method==='POST').options.body),{cardId:'card2',quantity:1,usePrefPrinting:false});
 const writes=calls.filter(c=>c.options.method==='POST').length;
 result=await command({...add,printing:{set:'sld',collectorNumber:'999',scryfallId:'missing'}});assert.equal(result.ok,false);assert.match(result.error,/selected printing/);
 assert.equal(calls.filter(c=>c.options.method==='POST').length,writes,'Missing printing never adds a preferred replacement');
 mode='post500';result=await command(add);assert.match(result.error,/result unknown/);mode='badJSON';result=await command(add);assert.match(result.error,/result unknown/);
 const beforeSlow=calls.filter(c=>c.options.method==='POST').length;mode='slow';result=await command({...add,printing:{set:'sld',collectorNumber:'123',scryfallId:'missing'}});assert.match(result.error,/timed out/);assert.equal(calls.filter(c=>c.options.method==='POST').length,beforeSlow,'No delayed write after action deadline');
 assert(!JSON.stringify(replies).includes('session-secret'));
 assert(calls.filter(c=>c.options.headers?.Authorization==='Bearer session-secret').every(c=>new URL(c.url).origin==='https://api2.moxfield.com'));
 mode='ok';clock=0;
 const printing={action:'changePrinting',name:'Sol Ring',deck:'public1',printing:{set:'sld',collectorNumber:'123'}};
 const printingRequest='00000000-0000-4000-8000-000000008888';
 result=await command(printing,printingRequest);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.data.quantity,3);
 const editionWrite=calls.findLast(c=>c.options.method==='PUT');
 assert.equal(editionWrite.url,'https://api2.moxfield.com/v2/decks/internal1/cards/card1/edition');
 assert.deepEqual(JSON.parse(editionWrite.options.body),{newEditionCardId:'card2',finish:'nonFoil',isAlter:false});
 const writeCount=()=>calls.filter(c=>['POST','PUT','DELETE'].includes(c.options.method)).length;
 const afterPrintingWrites=writeCount();
 await command(printing,printingRequest);assert.equal(writeCount(),afterPrintingWrites,'Replayed printing command must not repeat writes');
 mode='directBoard';result=await command(printing);assert.equal(result.ok,true,'Direct board dictionaries and cardData support edition updates');
 for(const failure of ['putForbidden','putUnknown','put500','putBadJSON']){
  mode=failure;result=await command(printing);assert.equal(result.ok,false);
  if(failure!=='putForbidden')assert.match(result.error,/unknown.*check the deck/i,'Uncertain edition updates must ask the user to check the deck');
 }
 const beforeTimeoutWrites=writeCount();
 mode='slow';clock=0;result=await command(printing);assert.match(result.error,/timed out/);
 assert.equal(writeCount(),beforeTimeoutWrites,'No printing writes may start after the ten-second deadline');
 mode='ok';clock=0;result=await command({...printing,deadline:-1});assert.match(result.error,/timed out/,'Expired client deadline must be respected');
 mode='hung';result=await command(printing);assert.match(result.error,/timed out/,'Unresponsive fetch must reject even when it ignores abort');
 mode='hungBody';result=await command(printing);assert.match(result.error,/timed out/,'Unresponsive JSON body must reject');
 mode='sameId';result=await command(printing);assert.equal(result.ok,true,'Edition updates may retain the entry ID');
 for(const failure of ['wrongQuantity','missingReplacement']){
  mode=failure;result=await command(printing);assert.match(result.error,/may be incomplete: expected/,'Wrong quantity or printing must never report success');
 }
 assert.equal(calls.filter(c=>c.options.method==='DELETE').length,0,'Edition updates never delete a deck entry');
 assert.equal(calls.filter(c=>c.options.method==='POST').length,beforeSlow,'Edition updates never add a new copy');
 console.log('PASS: sign-in, owned decks, printing replacement preserving quantity, command reply/replay, hard fetch/body timeouts, uncertain-write failure, and credential isolation.');
})().catch(error=>{console.error(error);process.exitCode=1});
