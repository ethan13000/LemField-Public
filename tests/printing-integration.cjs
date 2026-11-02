const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
 const listeners=[],messages=[],writes=[],stages=[];
 let deckRows=[{quantity:3,card:{id:'old',name:'Sol Ring',set:'cmm',cn:'396'}}];
 const location={pathname:'/decks/public1',origin:'https://moxfield.com',href:'https://moxfield.com/decks/public1'};
 const window={addEventListener:(name,fn)=>{if(name==='message')listeners.push(fn);},dispatchEvent:()=>{},postMessage:message=>{
  const data=structuredClone(message);messages.push(data);queueMicrotask(()=>listeners.forEach(fn=>fn({source:window,origin:location.origin,data})));
 },fetch:async(url,options={})=>{
  if(['PUT','POST','DELETE'].includes(options.method)){writes.push({url,options});if(options.method!=='PUT')throw Error('Printing replacement must use an edition update');deckRows=[{quantity:3,card:{id:'replacement',name:'Sol Ring',set:'sld',cn:'123'}}];return {ok:true,status:200,json:async()=>({card:{id:'replacement'}})};}
  if(url.endsWith('/v3/decks'))return {ok:true,json:async()=>({decks:[{id:'internal1',publicId:'public1',name:'Test deck'}]})};
  if(new URL(url).pathname==='/v3/decks/all/public1')return {ok:true,json:async()=>({boards:{mainboard:{cards:structuredClone(deckRows)}}})};
  if(url.includes('/cards/search/user'))return {ok:true,json:async()=>({data:[{id:'replacement',name:'Sol Ring',set:'sld',cn:'123'}]})};
  return {ok:true,json:async()=>({})};
 }};
 function XHR(){}XHR.prototype.open=function(){};XHR.prototype.setRequestHeader=function(){};
 const common={window,location,setTimeout,clearTimeout,URL,AbortController,crypto,CustomEvent:class{}};
 const main=vm.createContext({...common,XMLHttpRequest:XHR});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../deck-bridge.js'),'utf8'),main);
 await window.fetch('https://api2.moxfield.com/v3/profile',{headers:{Authorization:'Bearer test-only'}});
 const client=vm.createContext({...common,browser:{runtime:{onMessage:{addListener:()=>{}}}},sessionStorage:{getItem:()=>null,setItem:()=>{}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../deck-client.js'),'utf8'),client);
 const source={name:'Sol Ring',cardId:'old',set:'cmm',collectorNumber:'396',section:'mainboard'},printing={set:'sld',collectorNumber:'123'};
 let guard;const timeout=new Promise((_,reject)=>{guard=setTimeout(()=>reject(Error('Printing command never reached its reply through the real client/bridge channel')),1000);});
 const result=await Promise.race([client.MoxDecks.changePrinting(source,printing,undefined,stage=>stages.push(stage)),timeout]);clearTimeout(guard);
 assert.equal(result.quantity,3);assert.equal(writes.length,1);
 const sent=messages.find(message=>message.action==='changePrinting');
 assert.equal(sent.source,'mrd-deck-command-v1');assert.equal(sent.sourceCard.cardId,'old');assert.equal(sent.board,'mainboard');
 assert.deepEqual(stages,['Reading deck','Finding selected printing','Applying selected printing','Verifying replacement']);
 assert.equal(deckRows.length,1);assert.equal(deckRows[0].quantity,3);assert.equal(deckRows[0].card.id,'replacement');
 assert.equal(writes[0].options.method,'PUT');assert(writes[0].url.endsWith('/cards/old/edition'));assert.deepEqual(JSON.parse(writes[0].options.body),{newEditionCardId:'replacement',finish:'nonFoil',isAlter:false});
 await assert.rejects(client.MoxDecks.changePrinting({...source,cardId:'missing'},printing),/not in the selected deck/);
 assert.equal(writes.length,1,'A different source card must not be changed');
 console.log('PASS: real client/bridge message routing, source card identity, progress delivery, printing replacement, quantity preservation, and failure reply.');
})().catch(error=>{console.error(error);process.exit(1);});
