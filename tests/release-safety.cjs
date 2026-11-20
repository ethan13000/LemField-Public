const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const source=fs.readFileSync(require.resolve('../content.js'),'utf8');let normalizations=0;
 const state={capturedDeck:{version:10},cards:[],fingerprint:'',R:{normalizeDeck:d=>{normalizations++;return [{name:d.name,qty:1}];}},queueRender(){}};
 vm.createContext(state);vm.runInContext(source.slice(source.indexOf('function deckSignature('),source.indexOf('async function refresh(')),state);
 state.acceptDeck({version:9,name:'Stale',boards:{}},'page');assert.equal(normalizations,0,'Out-of-order native response cannot roll counts back');
 state.acceptDeck({version:11,name:'Fresh',boards:{}},'api');assert.equal(state.capturedDeck.version,11,'Authenticated/API reads become the current snapshot');
 const opened=[];const artContext={Blob,IDBKeyRange:{bound:()=>null},MoxPrintPreferences:{prefix:()=>'',key:()=>''},indexedDB:{databases:async()=>[{name:'previous-print-art-v1'}],open:name=>{opened.push(name);const req={};queueMicrotask(()=>{req.result={close(){},transaction(){const tx={objectStore:()=>({getAll(){const request={};queueMicrotask(()=>{request.result=[];request.onsuccess();queueMicrotask(()=>tx.oncomplete());});return request;}})};return tx;}};req.onsuccess();});return req;}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../print-art-store.js'),'utf8'),artContext);await artContext.MoxPrintArtStore.read('deck');assert.equal(opened[0],'previous-print-art-v1','Brand change retains the existing same-extension artwork database');
 console.log('PASS: stale response rejection, fresh snapshot retention and saved artwork identity across branding.');
})().catch(error=>{console.error(error);process.exitCode=1;});
