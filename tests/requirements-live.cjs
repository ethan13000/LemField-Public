const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
(async()=>{
const messages=[],events={},location={pathname:'/decks/one',origin:'https://moxfield.com',href:'https://moxfield.com/decks/one'};let resolveFetch;
class XHR{open(){}send(){}addEventListener(type,fn){this[type]=fn;}}
const window={fetch:async()=>({ok:true}),postMessage:m=>messages.push(m),addEventListener:(name,fn)=>events[name]=fn};
const ctx={window,location,XMLHttpRequest:XHR,URL,WeakMap,history:{pushState(){},replaceState(){}},document:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../page-hook.js'),'utf8'),ctx);
const invalidations=()=>messages.filter(m=>m.source==='mrd-deck-invalidated-v1');
await window.fetch('https://api2.moxfield.com/v2/decks/internal/cards/mainboard',{method:'POST'});await Promise.resolve();assert.equal(invalidations().length,1);
await window.fetch('https://other.example/v2/decks/internal/cards',{method:'POST'});await Promise.resolve();assert.equal(invalidations().length,1);
const xhr=new XHR();xhr.open('DELETE','https://api2.moxfield.com/v2/decks/internal/cards/mainboard/card');xhr.send();xhr.status=204;xhr.load();assert.equal(invalidations().length,2);
const failed=new XHR();failed.open('PUT','https://api2.moxfield.com/v2/decks/internal/cards/mainboard');failed.send();failed.status=403;failed.load();assert.equal(invalidations().length,2);
const stale=new XHR();stale.open('PATCH','https://api2.moxfield.com/v2/decks/internal');stale.send();location.pathname='/decks/two';stale.status=200;stale.load();assert.equal(invalidations().length,2,'Old route writes cannot refresh a new deck');
const source=fs.readFileSync(require.resolve('../content.js'),'utf8');let callback,fetching=true,refreshes=0;
const state={deckId:()=> 'one',routeGeneration:1,clearTimeout(){},setTimeout:fn=>{callback=fn;return 1;},get fetching(){return fetching;},refresh:force=>{assert(force);refreshes++;}};
vm.createContext(state);vm.runInContext(source.slice(source.indexOf('let liveRefreshTimer='),source.indexOf("window.addEventListener('message',event=>",source.indexOf('let liveRefreshTimer='))),state);
state.scheduleLiveRefresh();callback();assert.equal(refreshes,0);fetching=false;callback();assert.equal(refreshes,1,'Queued update survives an in-flight read');
state.scheduleLiveRefresh();state.routeGeneration++;callback();assert.equal(refreshes,1,'Drop stale route refresh');
console.log('PASS: successful fetch/XHR deck writes, failed/unrelated writes, route isolation, debouncing and in-flight refresh queue.');
})().catch(error=>{console.error(error);process.exitCode=1;});
