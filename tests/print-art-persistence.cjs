const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const records=new Map();
 const db={close(){},transaction(){const tx={objectStore:()=>({
  put:record=>request(()=>records.set(record.key,record)),delete:key=>request(()=>records.delete(key)),getAll:range=>request(()=>[...records.values()].filter(record=>record.key>=range[0]&&record.key<=range[1]))
 })};function request(work){const result={};queueMicrotask(()=>{result.result=work();result.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return result;}return tx;}};
 const indexedDB={open(){const request={};queueMicrotask(()=>{request.result=db;request.onsuccess();});return request;}};
 const card={name:'Kaalia of the Vast',section:'commanders',id:'old',set:'cmd',collectorNumber:'1'};
 const key=(deck,card)=>deck+':'+card.section+':'+card.name.toLowerCase()+(card.section==='tokens'?':'+(card.tokenSourceId||card.cardId||card.id||card.scryfallId||''):'');
 const setup=()=>{const context={indexedDB,IDBKeyRange:{bound:(a,b)=>[a,b]},Blob,MoxPrintPreferences:{key,prefix:deck=>deck+':'}};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../print-art-store.js'),'utf8'),context);return context.MoxPrintArtStore;};
 const first=setup(),blob=new Blob(['image bytes'],{type:'image/png'});
 await first.save('deckA',card,blob);
 const reopened=setup(),changed={...card,id:'new',set:'mh3',collectorNumber:'489'};
 assert.equal((await reopened.read('deckA')).get(key('deckA',changed)),blob,'Reopening Print and changing deck edition preserves uploaded art');
 assert.equal((await reopened.read('deckB')).size,0);
 await reopened.clear('deckA',changed);assert.equal((await reopened.read('deckA')).size,0,'Only explicit reset removes uploaded art');
 const tokenA={name:'Elf Warrior',section:'tokens',id:'variant-a'},tokenB={...tokenA,id:'variant-b'};await first.save('deckA',tokenA,blob);assert.equal((await reopened.read('deckA')).get(key('deckA',tokenA)),blob,'Token upload retains its source identity after reopening');assert(!(await reopened.read('deckA')).has(key('deckA',tokenB)),'Token variants keep separate uploads');
 await assert.rejects(reopened.save('deckA',card,new Blob(['svg'],{type:'image/svg+xml'})),/PNG/);
 const source=fs.readFileSync(require.resolve('../export.js'),'utf8'),timers=new Map();let timerId=0,clicks=0;
 const context={deck:{id:'deckA'},uploadsInFlight:0,generation:0,preparedGeneration:-1,prepareTimer:null,prepare:{disabled:false,click:()=>clicks++},print:{disabled:false},status:{},$:()=>({replaceChildren(){}}),setProgress(){},renderCardList(){},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function schedulePrepare('),source.indexOf("controls.forEach(")),context);
 context.invalidate();context.invalidate();assert.equal(timers.size,1,'Option changes debounce to one automatic prepare');
 [...timers.values()][0]();assert.equal(clicks,1);assert.equal(context.print.disabled,true,'Old preview cannot print while rebuilding');
 // Reset must clear an upload whose persistence started before its preview appeared.
 let releaseSave;const pendingSave=new Promise(resolve=>{releaseSave=resolve;});let persisted=true,invalidated=0;
 const resetContext={deck:{id:'deckA'},uploadRuns:new Map(),customArt:new Map(),undoChoices:new Map(),printChoices:new Map([['art-key',{}]]),URL:{revokeObjectURL(){}},browser:{storage:{local:{remove:async()=>{}}}},MoxPrintArtStore:{clear:async()=>{await pendingSave;persisted=false;}},MoxPrintPreferences:{clear:async()=>null},invalidate:()=>invalidated++};
 vm.createContext(resetContext);vm.runInContext(source.slice(source.indexOf('async function resetArtwork('),source.indexOf('function renderCardList(')),resetContext);
 const reset=resetContext.resetArtwork(card,'art-key');releaseSave();await reset;
 assert.equal(persisted,false,'Reset clears queued first upload even before customArt contains it');assert.equal(invalidated,1);assert.equal(resetContext.printChoices.has('art-key'),false,'Use deck printing also clears the old edition');
 let releaseClear;resetContext.MoxPrintArtStore.clear=()=>new Promise(resolve=>{releaseClear=resolve;});
 const laterReset=resetContext.resetArtwork(card,'art-key');const newTicket={};resetContext.uploadRuns.set('art-key',newTicket);resetContext.customArt.set('art-key','new-upload');releaseClear();await laterReset;
 assert.equal(resetContext.customArt.get('art-key'),'new-upload','A newer upload supersedes an older reset');
 // Associated-token failures stay visible instead of being overwritten by success text.
 const statusNode={textContent:''};let autoPrepared=0;
 const loadContext={URLSearchParams,location:{search:'?tab=1'},deck:null,printChoices:new Map(),undoChoices:new Map(),customArt:new Map(),tokenQuantities:new Map(),URL:{createObjectURL:()=>''},document:{title:''},prepare:{disabled:true},progress:{},$:()=>statusNode,renderCardList(){},schedulePrepare:()=>autoPrepared++,browser:{tabs:{sendMessage:async()=>({ok:true,deck:{id:'deckA',name:'Test',cards:[]}})},runtime:{sendMessage:async()=>({ok:false,error:'Offline token service'})},storage:{local:{get:async()=>({})},onChanged:{addListener(){}}}},MoxPrintPreferences:{read:async()=>new Map(),prefix:()=>''},MoxPrintArtStore:{read:async()=>new Map()}};
 vm.createContext(loadContext);const initStart=source.lastIndexOf('try{',source.indexOf(' const tab=Number'));
 await vm.runInContext('(async()=>{'+source.slice(initStart,source.lastIndexOf('})();'))+'})()',loadContext);
 assert.match(statusNode.textContent,/Some associated tokens could not be loaded/);assert.match(statusNode.textContent,/Offline token service/);assert.equal(autoPrepared,0,'Failed token discovery waits for an explicit prepare rather than hiding its warning');assert.equal(loadContext.prepare.disabled,false);
 console.log('PASS: uploaded art survives reopen and edition changes, explicit reset/deck isolation, supported image types and debounced automatic preview preparation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
