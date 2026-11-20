'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 // A request started before a write cannot repopulate the read-only replay cache.
 const messages=[],events={},location={pathname:'/decks/one',origin:'https://moxfield.com',href:'https://moxfield.com/decks/one'};let finishRead;
 class XHR{open(){}send(){}addEventListener(type,fn){this[type]=fn;}}
 const window={fetch:async(url,options={})=>options.method?{ok:true}:new Promise(resolve=>{finishRead=resolve;}),postMessage:m=>messages.push(m),addEventListener:(name,fn)=>events[name]=fn};
 let removed=0;const document={getElementById:()=>({remove(){removed++;}})};
 const ctx={window,location,XMLHttpRequest:XHR,URL,WeakMap,TextEncoder,TextDecoder,history:{pushState(){location.pathname='/decks/two';},replaceState(){}},document};
 vm.runInNewContext(read('page-hook.js'),ctx);
 const reply=data=>({ok:true,clone:()=>({text:async()=>JSON.stringify(data)})});
 const old=window.fetch('https://api2.moxfield.com/v3/decks/all/one');await tick();
 await window.fetch('https://api2.moxfield.com/v2/decks/internal/cards/mainboard',{method:'POST'});await tick();
 finishRead(reply({version:1,boards:{}}));await old;await tick();assert(!messages.some(m=>m.source==='mrd-deck-response-v2'),'Pre-write fetch never republishes stale snapshot');
 const fresh=window.fetch('https://api2.moxfield.com/v3/decks/all/one');await tick();finishRead(reply({version:2,boards:{}}));await fresh;await tick();assert.equal(messages.filter(m=>m.source==='mrd-deck-response-v2').length,1);
 const xhr=new XHR();xhr.open('GET','https://api2.moxfield.com/v3/decks/all/one');xhr.send();await window.fetch('https://api2.moxfield.com/v2/decks/internal/cards/mainboard',{method:'PUT'});await tick();xhr.status=200;xhr.responseText=JSON.stringify({version:1,boards:{}});xhr.load();assert.equal(messages.filter(m=>m.source==='mrd-deck-response-v2').length,1,'Pre-write XHR never republishes stale snapshot');
 const other=window.fetch('https://api2.moxfield.com/v3/decks/all/one');await tick();ctx.history.pushState();finishRead(reply({boards:{}}));await other;await tick();assert.equal(messages.filter(m=>m.source==='mrd-deck-response-v2').length,1);assert.equal(removed,1,'Refresh notice removed on route navigation');events.popstate();assert.equal(removed,2,'Refresh notice removed on back/forward navigation');
 // MoxDecks preview invalidates cached native cards when a successful native write is observed.
 const listeners={},clientLocation={pathname:'/decks/one',origin:'https://moxfield.com'};let previews=0;
 const clientWindow={addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent(){},postMessage:message=>{
  if(message.source==='mrd-deck-bridge-ping-v1')queueMicrotask(()=>send({source:'mrd-deck-bridge-ready-v1',version:6}));
  if(message.action==='preview'){previews++;queueMicrotask(()=>send({source:'mrd-deck-result-v1',requestId:message.requestId,ok:true,data:{deck:{boards:{mainboard:{cards:[{quantity:previews+1,card:{name:'Forest',type_line:'Basic Land'}}]}}}}}));}
 }};
 const send=data=>listeners.message({source:clientWindow,origin:clientLocation.origin,data});
 const client={window:clientWindow,location:clientLocation,browser:{runtime:{onMessage:{addListener(){}}}},crypto,setTimeout,clearTimeout,CustomEvent:class{},sessionStorage:{getItem:()=>null,setItem(){}}};
 vm.createContext(client);vm.runInContext(read('rules.js'),client);vm.runInContext(read('deck-client.js'),client);
 send({source:'mrd-deck-response-v2',id:'one',deck:{boards:{mainboard:{cards:[{quantity:1,card:{name:'Forest',type_line:'Basic Land'}}]}}}});
 assert.equal((await client.MoxDecks.preview()).activeCount,1);send({source:'mrd-deck-invalidated-v1',id:'other'});assert.equal((await client.MoxDecks.preview()).activeCount,1);assert.equal(previews,0);
 send({source:'mrd-deck-invalidated-v1',id:'one'});assert.equal((await client.MoxDecks.preview()).activeCount,2);assert.equal(previews,1);
 send({source:'mrd-deck-updated-v1',id:'one'});assert.equal((await client.MoxDecks.preview()).activeCount,3);assert.equal(previews,2);
 clientLocation.pathname='/decks/two';await assert.rejects(client.MoxDecks.removeDuplicates([], 'one'),/deck changed/);clientLocation.pathname='/decks/one';
 const panelReads=[];clientWindow.dispatchEvent=()=>{if(panelReads.length>=3)throw Error('Recursive panel refresh');panelReads.push(client.MoxDecks.readCurrent());};
 const beforePanel=previews;send({source:'mrd-deck-response-v2',id:'one',deck:{name:'Changed',boards:{mainboard:{cards:[]}}}});await tick();await Promise.all(panelReads);
 assert.equal(panelReads.length,1,'A panel refresh that calls readCurrent must not dispatch itself again');assert.equal(previews,beforePanel+1,'Native snapshot causes exactly one requested panel read');
 await Promise.all([client.MoxDecks.readCurrent(),client.MoxDecks.readCurrent()]);assert.equal(panelReads.length,1,'Concurrent explicit API reads do not emit change notifications or invalidate each other');

 // All mutation kinds share a lock; read-only commands can continue, request replays do not write twice.
 const bridgeEvents={},results=[],writes=[];let releaseDecks,held=true,unknownWrite=false;
 class AuthXHR{open(){}setRequestHeader(){}}
 const bridgeWindow={addEventListener:(name,fn)=>bridgeEvents[name]=fn,postMessage:value=>results.push(value),fetch:async(url,options={})=>{
  if(url.endsWith('/session'))return {ok:true};
  if(url.endsWith('/v3/decks')){if(held)await new Promise(resolve=>{releaseDecks=resolve;});return {ok:true,json:async()=>({decks:[{id:'internal',publicId:'one',name:'Deck'}]})};}
  if(url.includes('/cards/search/user'))return {ok:true,json:async()=>({data:[{id:'card',name:'Forest'}]})};
  if(options.method==='POST'){writes.push(url);if(unknownWrite)throw Error('Connection lost');return {ok:true,json:async()=>({card:{name:'Forest'}})};}
  throw Error('Unexpected '+url);
 }};
 const bridge={window:bridgeWindow,XMLHttpRequest:AuthXHR,location:{pathname:'/cards/forest',origin:'https://moxfield.com'},URL,AbortController,setTimeout,clearTimeout};vm.createContext(bridge);vm.runInContext(read('deck-bridge.js'),bridge);
 await bridgeWindow.fetch('https://api2.moxfield.com/session',{headers:{Authorization:'Bearer test'}});
 const command=(action,n)=>bridgeEvents.message({source:bridgeWindow,origin:bridge.location.origin,data:{source:'mrd-deck-command-v1',requestId:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),action,deck:'one',name:'Forest',board:'mainboard'}});
 command('add',1);await tick();command('bulkSelection',2);await tick();assert.match(results.find(r=>r.requestId?.endsWith('000000000002')).error,/Another deck update/);assert.equal(writes.length,0);
 held=false;releaseDecks();await tick();assert(results.find(r=>r.requestId?.endsWith('000000000001')).ok);assert.equal(writes.length,1);command('add',1);await tick();assert.equal(writes.length,1);
 bridge.location.pathname='/decks/one';unknownWrite=true;command('add',3);await tick();assert.match(results.find(r=>r.requestId?.endsWith('000000000003')).error,/result unknown/);assert(results.some(r=>r.source==='mrd-deck-invalidated-v1'&&r.id==='one'),'Unknown write outcomes invalidate cached data without retry');assert.equal(writes.length,2);
 // Closing extension dialogs never reloads; a route change discards stale refresh notices.
 const explorerSource=read('edhrec.js'),notices=[],dialogs=new Set(),ui={openDialogs:dialogs,changedDeckID:null,addedInEDHRECPlus:false,printingChangedInDialog:false,location:{pathname:'/decks/one',origin:'https://moxfield.com',reload(){throw Error('Unexpected forced reload');}},window:{postMessage:m=>notices.push(m)}};
 vm.createContext(ui);vm.runInContext(explorerSource.slice(explorerSource.indexOf('function notifyDeckChanged('),explorerSource.indexOf('const button=')),ui);
 ui.noteDeckChanged(false,'other');assert.equal(notices.length,0);ui.noteDeckChanged(false,'one');assert.equal(notices.length,1);
 dialogs.add({});ui.noteDeckChanged(true,'one');assert.equal(notices.length,1);ui.location.pathname='/decks/two';dialogs.clear();ui.notifyDeckChanged();assert.equal(notices.length,1,'Old deck update never creates a notice on the new deck');
 assert(!explorerSource.includes('location.reload()'),'Explorer must not force a full page reload');
 console.log('PASS: stale fetch/XHR suppression, route cleanup, native/extension preview invalidation, mutation serialization/replay, no forced reload and route-safe refresh notices.');
})().catch(error=>{console.error(error);process.exitCode=1;});
