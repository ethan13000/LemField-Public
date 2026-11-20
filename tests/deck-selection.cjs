'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
const clone=value=>structuredClone(value);
const card=(id,name,quantity=1,extra={})=>({card:{id,name,type_line:'Creature'},quantity,...extra});
function environment(){
 const events={},responses=[],writes=[];
 const state={raw:{boards:{mainboard:{cards:[card('a','Alpha',3),card('b','Beta',1)]},sideboard:{cards:[card('a','Alpha',2)]},maybeboard:{cards:[]}}},owned:true,mode:null};
 class XHR{open(){}setRequestHeader(){}}
 const response=data=>({ok:true,status:200,json:async()=>clone(data)});
 const window={addEventListener:(type,fn)=>events[type]=fn,postMessage:value=>responses.push(value),fetch:async(url,options={})=>{
  if(url.endsWith('/session'))return response({});
  if(url.endsWith('/v3/decks'))return response({decks:state.owned?[{id:'internal',publicId:'public',name:'Deck'}]:[]});
  if(url.endsWith('/v3/decks/all/public'))return response(state.raw);
  const match=url.match(/\/v2\/decks\/internal\/cards\/(mainboard|sideboard|maybeboard)(?:\/([a-z]+))?$/);if(!match)throw Error('Unexpected URL '+url);
  const [,board,id]=match,body=options.body?JSON.parse(options.body):null;writes.push({board,id,method:options.method,body});
  if(state.mode==='copy-fail'&&options.method==='POST')throw Error('Offline');
  let entries=state.raw.boards[board].cards,row=entries.find(row=>row.card.id===id);
  if(options.method==='DELETE'){
   if(state.mode==='delete-unknown'){state.raw.boards[board].cards=entries.filter(row=>row.card.id!==id);throw Error('Response lost');}
   if(state.mode!=='delete-noop')state.raw.boards[board].cards=entries.filter(row=>row.card.id!==id);
  }else if(options.method==='POST'){
   if(state.mode!=='copy-noop')entries.push(card(state.mode==='wrong-printing'?'wrong':body.cardId,'Beta',body.quantity));
  }else if(options.method==='PUT'){
   if(state.mode!=='copy-noop')Object.assign(row,body);
  }
  return response({});
 }};
 const context={window,XMLHttpRequest:XHR,location:{pathname:'/decks/public',origin:'https://moxfield.com'},URL,AbortController,setTimeout,clearTimeout};
 vm.createContext(context);for(const file of ['deck-selection-model.js','deck-bulk.js','duplicates.js','deck-bridge.js'])vm.runInContext(read(file),context,{filename:file});
 let sequence=0;
 const send=async(plan,requestId)=>{
  requestId=requestId||'00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0');
  const start=responses.length;events.message({source:window,origin:context.location.origin,data:{source:'mrd-deck-command-v1',requestId,action:'bulkSelection',deck:'public',plan}});
  for(let i=0;i<100;i++){await new Promise(resolve=>setImmediate(resolve));const result=responses.slice(start).find(row=>row.requestId===requestId);if(result)return result;}
  throw Error('Missing bridge reply');
 };
 return {state,context,writes,send,connect:()=>window.fetch('https://api2.moxfield.com/session',{headers:{Authorization:'Bearer test'}}),plan:(ids,op='remove',dest)=>context.MoxDeckSelection.plan(state.raw,ids.map(([section,id])=>({section,id})),op,dest)};
}
(async()=>{
 let env=environment();await env.connect();let plan=env.plan([['mainboard','a']],'move','sideboard'),reply=await env.send(plan);
 assert.equal(reply.ok,true,reply.error);assert.equal(env.state.raw.boards.sideboard.cards[0].quantity,5);assert.equal(env.state.raw.boards.mainboard.cards.length,1);assert.deepEqual(env.writes.map(w=>w.method),['PUT','DELETE']);
 const count=env.writes.length;await env.send(plan,'00000000-0000-4000-8000-000000000001');assert.equal(env.writes.length,count,'Replayed request IDs never duplicate writes');
 env=environment();await env.connect();reply=await env.send(env.plan([['mainboard','b']],'move','maybeboard'));assert.equal(reply.ok,true,reply.error);assert.deepEqual(env.writes.map(w=>w.method),['POST','DELETE']);assert.equal(env.writes[0].body.usePrefPrinting,false,'Exact printing requested');
 env=environment();await env.connect();reply=await env.send(env.plan([['mainboard','a']]));assert.equal(reply.ok,true,reply.error);assert.equal(env.state.raw.boards.sideboard.cards[0].quantity,2,'Remove leaves other boards untouched');
 env=environment();await env.connect();plan=env.plan([['mainboard','a']]);env.state.raw.boards.mainboard.cards[0].quantity=4;reply=await env.send(plan);assert.equal(reply.ok,false);assert.equal(env.writes.length,0,'Stale reviewed quantities reject before writing');
 env=environment();await env.connect();env.state.owned=false;reply=await env.send(env.plan([['mainboard','a']]));assert.equal(reply.ok,false);assert.equal(env.writes.length,0,'Unowned deck rejects before writing');
 env=environment();reply=await env.send(env.plan([['mainboard','a']]));assert.equal(reply.ok,false);assert.equal(env.writes.length,0,'No signed-in session cannot write');
 for(const mode of ['copy-fail','copy-noop','wrong-printing']){
  env=environment();await env.connect();env.state.mode=mode;reply=await env.send(env.plan([['mainboard','b']],'move','maybeboard'));assert.equal(reply.ok,false,mode);assert(!env.writes.some(w=>w.method==='DELETE'),mode+': never delete an unverified source');
 }
 for(const mode of ['delete-unknown','delete-noop']){
  env=environment();await env.connect();env.state.mode=mode;reply=await env.send(env.plan([['mainboard','a']]));assert.equal(reply.ok,false);assert.match(reply.error,/partial.*Check both boards/);assert.equal(env.writes.length,1,'An uncertain removal is never retried');
 }
 env=environment();assert.throws(()=>env.plan([['mainboard','a'],['mainboard','a']]),/more than once/);assert.throws(()=>env.plan([['mainboard','a']],'move','mainboard'),/already/);assert.throws(()=>env.plan([['mainboard','a']],'move','commanders'),/valid action/);
 env.state.raw.boards.mainboard.cards[0].tags=['Custom'];assert.throws(()=>env.plan([['mainboard','a']],'move','maybeboard'),/native controls/,'Tagged move fails safely rather than discarding tags');
 const oversized=Array.from({length:21},(_,i)=>({section:'mainboard',id:'extra'+i}));assert.throws(()=>env.context.MoxDeckSelection.plan(env.state.raw,oversized,'remove'),/1 to 20/,'Page bridge plans remain bounded to 20 entries');
 console.log('PASS: reviewed owned/session bulk actions, exact printing/quantity moves, destination merge, removal isolation, stale plans, request replay, copy failures/wrong printing, unknown deletion outcomes, duplicate selections, 20-entry bridge bound and custom-card restrictions.');
})().catch(error=>{console.error(error);process.exitCode=1;});
