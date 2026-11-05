const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const calls=[],replies=[],events={};let changed=false,mode='ok';
 const original={id:'greenOld',uniqueCardId:'greenFamily',name:'Elf Warrior',layout:'token',type_line:'Token Creature � Elf Warrior',colors:['G'],power:'1',toughness:'1',set:'tc14',cn:'23'},sibling={...original,id:'whiteOld',uniqueCardId:'whiteFamily',colors:['W'],set:'tema',cn:'12'},selected={...original,id:'greenNew',set:'tcmm',cn:'32'};
 const deck=()=>({boards:{mainboard:{cards:{regular:{quantity:2,card:{id:'regular',name:'Forest'}}}},tokens:{cards:{}}},tokens:[changed?selected:original,sibling]});
 const window={addEventListener:(name,fn)=>events[name]=fn,postMessage:message=>replies.push(message),fetch:async(url,options={})=>{
  calls.push({url,options});let data={};
  if(url.endsWith('/v3/decks'))data={decks:[{id:'internal',publicId:'public',name:'Token deck'}]};
  else if(url.includes('/v3/decks/all/public'))data=deck();
  else if(url.endsWith('/v3/cards/editions/greenFamily'))data=[{cardId:'greenNew',uniqueCardId:mode==='wrongFamily'?'whiteFamily':'greenFamily',abbreviation:'tcmm',cn:'32'}];
  else if(options.method==='PUT'){
   if(mode==='rejected')return {ok:false,status:400};
   assert(url.endsWith('/cards/greenOld/edition'));if(mode!=='unconfirmed')changed=true;data={card:{card:selected}};
  }
  return {ok:true,json:async()=>data};
 }};
 function XHR(){}XHR.prototype.open=function(){};XHR.prototype.setRequestHeader=function(){};
 const context={window,XMLHttpRequest:XHR,URL,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,5)),clearTimeout,location:{origin:'https://moxfield.com',href:'https://moxfield.com/cards/x',pathname:'/cards/x'}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../deck-bridge.js'),'utf8'),context);
 await window.fetch('https://api2.moxfield.com/profile',{headers:{Authorization:'Bearer test-session'}});
 let seq=0;async function command(){changed=false;const requestId='00000000-0000-4000-8000-'+String(++seq).padStart(12,'0');events.message({source:window,origin:context.location.origin,data:{source:'mrd-deck-command-v1',requestId,action:'changePrinting',deck:'public',name:'Elf Warrior',board:'tokens',sourceCard:{cardId:'greenOld',set:'tc14',collectorNumber:'23'},printing:{set:'tcmm',collectorNumber:'32'}}});for(let i=0;i<200;i++){await new Promise(resolve=>setImmediate(resolve));const reply=replies.find(row=>row.requestId===requestId&&row.source==='mrd-deck-result-v1');if(reply)return reply;await new Promise(resolve=>setTimeout(resolve,1));}throw Error('No reply');}
 const success=await command();assert(success.ok,success.error);assert.equal(success.data.cardId,'greenNew');assert.equal(success.data.board,'tokens');assert.equal(success.data.quantity,1);
 assert.deepEqual(JSON.parse(calls.find(row=>row.options.method==='PUT').options.body),{newEditionCardId:'greenNew',finish:'nonFoil',isAlter:false});assert.equal(deck().tokens[1].id,'whiteOld');assert.equal(deck().boards.mainboard.cards.regular.quantity,2);
 const writes=()=>calls.filter(row=>row.options.method==='PUT').length,before=writes();mode='wrongFamily';assert.equal((await command()).ok,false);assert.equal(writes(),before,'Different token family never produces a deck write');
 mode='rejected';assert.equal((await command()).ok,false);mode='unconfirmed';const unconfirmed=await command();assert.equal(unconfirmed.ok,false);assert.match(unconfirmed.error,/incomplete/);
 assert(!calls.some(row=>['POST','DELETE'].includes(row.options.method)),'Changing token editions never adds or deletes copies');
 console.log('PASS: generated token source resolution, exact family/edition lookup, real update payload, sibling preservation, rejection and read-back verification.');
})().catch(error=>{console.error(error);process.exitCode=1;});
