const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
function environment(){
 const listeners=[],calls=[],storage={},state={document:false,created:0,fetches:0};
 const chrome={
  runtime:{id:'test-extension',getURL:name=>'chrome-extension://test-extension/'+name,onMessage:{addListener:f=>listeners.push(f),removeListener:f=>listeners.splice(listeners.indexOf(f),1)},getPlatformInfo:cb=>cb({}),
   sendMessage(message,cb){calls.push(message);if(message.fail){this.lastError={message:'Receiver unavailable'};cb();delete this.lastError;return;}
    cb({ok:true,data:message.operation==='similar'?[{key:'other',name:'Other Card'}]:{...message.data,allCards:[{key:'recovered',name:'Recovered'}],cards:[],tags:[],categories:[]}});}},
  storage:{local:{get:(key,cb)=>cb({[key]:storage[key]}),set:(values,cb)=>{Object.assign(storage,values);cb();},remove:(key,cb)=>{delete storage[key];cb();}},onChanged:{addListener(){}}},
  tabs:{query:(_query,cb)=>cb([{id:1}]),create:(options,cb)=>cb({id:2,...options}),sendMessage:(_id,_message,cb)=>cb({ok:true})},
  offscreen:{hasDocument:async()=>state.document,createDocument:async options=>{state.created++;assert.equal(options.reasons[0],'DOM_PARSER');state.document=true;}}
 };
 const context={chrome,console,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,
  fetch:async url=>{state.fetches++;return {ok:!url.includes('json.edhrec.com'),status:url.includes('json.edhrec.com')?404:200,url,text:async()=>'<html><body>Mock fallback</body></html>',json:async()=>({boards:{mainboard:{cards:{}}}})}}
 };
 vm.createContext(context);context.importScripts=(...names)=>names.forEach(name=>vm.runInContext(read(name),context,{filename:name}));
 const dispatch=message=>new Promise((resolve,reject)=>{
  let claimed=false;for(const listener of listeners){const result=listener(message,{id:chrome.runtime.id,url:'https://moxfield.com/decks/test'},resolve);claimed=claimed||result===true;}
  if(!claimed)reject(Error('No listener claimed '+message.type));
 });
 return {context,chrome,listeners,calls,state,dispatch};
}
(async()=>{
 const env=environment();vm.runInContext(read('browser-compat.js'),env.context);
 const api=env.context.browser;
 await api.storage.local.set({test:42});assert.equal((await api.storage.local.get('test')).test,42);
 await assert.rejects(api.runtime.sendMessage({fail:true}),/Receiver unavailable/);
 let response;const ignore=()=>undefined;api.runtime.onMessage.addListener(ignore);
 assert.equal(env.listeners[0]({},{},value=>{response=value;}),false);assert.equal(response,undefined,'Unrelated messages leave the channel available');api.runtime.onMessage.removeListener(ignore);
 const answer=()=>Promise.resolve({ok:true,value:9});api.runtime.onMessage.addListener(answer);assert.equal((await env.dispatch({type:'test'})).value,9);api.runtime.onMessage.removeListener(answer);
 api.runtime.onMessage.addListener(()=>Promise.reject(Error('Test failure')));assert.equal((await env.dispatch({type:'error'})).error,'Test failure');
 const native={marker:true},nativeContext={browser:native};vm.runInNewContext(read('browser-compat.js'),nativeContext);assert.equal(nativeContext.browser,native,'Firefox keeps its native API');
 for(let startup=0;startup<2;startup++){
  const worker=environment();vm.runInContext(read('service-worker.js'),worker.context,{filename:'service-worker.js'});
  assert(worker.listeners.length>=6,'All worker handlers register during startup');
  assert.equal(typeof worker.context.DOMParser,'undefined');
  const deck=await worker.dispatch({type:'mrd-read-deck',id:'test123'});assert.equal(deck.ok,true);
  const edh=await worker.dispatch({type:'mrd-read-edhrec',slug:'sol-ring',kind:'cards'});assert.equal(edh.ok,true);assert.equal(edh.data.allCards[0].name,'Recovered');
  const similar=await worker.dispatch({type:'mrd-similar-edhrec',slug:'sol-ring'});assert.equal(similar.cards[0].name,'Other Card');
  assert.equal(worker.state.created,1,'Supplement and similar parsing reuse one document');
  const count=worker.state.created;await Promise.all([worker.context.MoxHTML.similar('<p>One</p>'),worker.context.MoxHTML.similar('<p>Two</p>')]);assert.equal(worker.state.created,count);
  await assert.rejects(worker.context.MoxHTML.similar('x'.repeat(8000001)),/parsing limit/);
 }
 const fresh=environment();vm.runInContext(read('browser-compat.js'),fresh.context);vm.runInContext(read('offscreen-client.js'),fresh.context);
 await Promise.all([fresh.context.MoxHTML.similar('one'),fresh.context.MoxHTML.similar('two')]);assert.equal(fresh.state.created,1,'Concurrent cold starts share document creation');
 let handler;const parser={chrome:{runtime:{id:'test-extension',onMessage:{addListener:fn=>{handler=fn;}}}},MoxEDHREC:{similarHTML:html=>[{name:html}],pageFromHTML:()=>null,supplementHTML:data=>data}};
 vm.runInNewContext(read('offscreen-parser.js'),parser);
 const request={type:'mrd-offscreen-parse-v1',operation:'similar',html:'Safe parsed card'};
 handler(request,{id:'other'},value=>{response=value;});assert.equal(response.ok,false);
 handler(request,{id:'test-extension',tab:{id:1}},value=>{response=value;});assert.equal(response.ok,false,'Content scripts cannot drive the parser');
 handler(request,{id:'test-extension'},value=>{response=value;});assert.equal(response.data[0].name,'Safe parsed card');
 console.log('PASS: Chromium API errors, Promise message routing, unclaimed messages, Firefox passthrough, synchronous worker registration, cold restarts, offscreen fallback routing/concurrency, parser limits and sender restrictions.');
})().catch(error=>{console.error(error);process.exitCode=1;});
