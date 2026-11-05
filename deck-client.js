/* Extension UI requests deck actions through the same-origin page bridge. */
(()=>{
'use strict';
const pending=new Map();let current=null,tracked=null,context=null,captured=null,previewPending=null,deckEpoch=0;
try{browser.storage?.local?.remove?.('mrd_printing_popularity_v1').catch(()=>{});}catch{}
try{current=JSON.parse(sessionStorage.getItem('mrd_current_deck')||'null');}catch{}
let bridgeConnection=null,bridgeResolve=null,bridgeTimer=null;
function connectBridge(){
 if(!bridgeConnection)bridgeConnection=new Promise((resolve,reject)=>{
  bridgeResolve=resolve;bridgeTimer=setTimeout(()=>{bridgeConnection=null;bridgeResolve=null;reject(new Error('The Moxfield tab is using an older or disconnected extension bridge. Reload the extension, then reload this tab before changing a printing.'));},3000);
  window.postMessage({source:'mrd-deck-bridge-ping-v1'},location.origin);
 });
 return bridgeConnection;
}
async function command(action,values={},onProgress,actionDeadline){
 const deadline=action==='changePrinting'?Math.min(Date.now()+10000,Number(actionDeadline)||Infinity):null;
 await connectBridge();
 const requestId=crypto.randomUUID();
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{const stage=pending.get(requestId)?.stage;pending.delete(requestId);reject(new Error((stage?stage+': ':'')+(action==='add'?'Add result unknown. Check the deck before trying again.':action==='changePrinting'?'Printing update timed out after 10 seconds. The result may be incomplete; close the menu to refresh and check the deck before retrying.':'Moxfield did not respond. Refresh the page and retry.')));},deadline?Math.max(0,deadline-Date.now()):105000);
  pending.set(requestId,{resolve,reject,timer,onProgress});window.postMessage({...values,...(deadline?{deadline}:{}),source:'mrd-deck-command-v1',requestId,action},location.origin);
 });
}
async function remember(name){
 const id=location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)/)?.[1];if(!id)return;
 if(tracked===id&&!name)return;tracked=id;
 current={id,name:name||(current?.id===id?current.name:`Deck ${id}`),commanders:context?.deck===id?context.commanders:current?.id===id?current.commanders:[],time:Date.now()};
 try{sessionStorage.setItem('mrd_current_deck',JSON.stringify(current));}catch{}
 // Search tabs opened separately can offer the most recently visited deck.
 // This record does not replace the per-tab current-deck context.
 try{await browser.storage?.local?.set?.({mrd_last_deck:{id:current.id,name:current.name}});}catch{}
}
window.addEventListener('message',event=>{
 if(event.source!==window||event.origin!==location.origin)return;
 const message=event.data;
 if(message?.source==='mrd-deck-progress-v1'){const entry=pending.get(message.requestId);if(entry&&typeof message.stage==='string'){entry.stage=message.stage;entry.onProgress?.(message.stage);}return;}
 if(message?.source==='mrd-deck-bridge-ready-v1'&&message.version>=6){clearTimeout(bridgeTimer);bridgeResolve?.();bridgeResolve=null;return;}
 if(message?.source==='mrd-deck-result-v1'){
  const entry=pending.get(message.requestId);if(!entry)return;
  clearTimeout(entry.timer);pending.delete(message.requestId);message.ok?entry.resolve(message.data):entry.reject(new Error((entry.stage?entry.stage+': ':'')+(message.error||'Moxfield action failed.')));
 }
 if(message?.source==='mrd-route-v3'){context=null;captured=null;previewPending=null;deckEpoch++;remember().catch(()=>{});}
 if(message?.source==='mrd-deck-response-v2'&&message.id===location.pathname.split('/')[2]){
  if(captured?.id===message.id&&Number(captured.deck.version)>Number(message.deck?.version))return;
  const commanders=message.deck?.boards?.commanders?.cards||message.deck?.commanders||{};
  const names=Object.values(commanders).map(entry=>entry?.card?.name||entry?.name).filter(Boolean);context={name:names[0]||null,commanders:names,deck:message.id};
  captured={id:message.id,deck:message.deck};previewPending=null;deckEpoch++;
  remember(message.deck?.name).catch(()=>{});
  window.dispatchEvent(new CustomEvent('mrd-current-deck-updated'));
 }
});
window.addEventListener('popstate',()=>{context=null;captured=null;previewPending=null;deckEpoch++;remember().catch(()=>{});});
remember().catch(()=>{});
globalThis.MoxDecks={context:()=>context,list:()=>command('decks'),changePrinting:async(source,printing,board,onProgress,deadline)=>{
 const deck=await globalThis.MoxDecks.current();if(!deck)throw new Error('Open the deck containing this card in this tab first.');
 const result=await command('changePrinting',{name:source.name,deck:deck.id,printing:{set:printing.set,collectorNumber:printing.collectorNumber},sourceCard:{...(source.cardId?{cardId:source.cardId}:{}),...(source.set&&source.collectorNumber?{set:source.set,collectorNumber:source.collectorNumber}:{})},...(board||source.section?{board:board||source.section}:{})},onProgress,deadline);
 captured=null;previewPending=null;deckEpoch++;window.dispatchEvent(new CustomEvent('mrd-current-deck-updated'));return result;
},add:async(card,deck,board='mainboard')=>{
 const result=await command('add',{name:card.name,deck,board,...(card.collectorNumber&&card.set?{printing:{scryfallId:card.id,set:card.set,collectorNumber:card.collectorNumber}}:{})});
 if(current?.id===deck){captured=null;previewPending=null;deckEpoch++;window.dispatchEvent(new CustomEvent('mrd-current-deck-updated'));}return result;
},current:async()=>{
 const id=location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)/)?.[1];
 if(id&&current?.id!==id){context=null;await remember();}return current;
}};
browser.runtime.onMessage.addListener(message=>{
 if(message?.type==='mrd-export-deck')return globalThis.MoxDecks.preview().then(deck=>({ok:true,deck}),error=>({ok:false,error:error.message}));
 if(message?.type!=='mrd-add-external-card'||typeof message.name!=='string'||!message.name.trim()||message.name.length>160)return;
 return (async()=>{
 try{const {decks}=await globalThis.MoxDecks.list();if(!decks.length)return {ok:false,error:'No decks found in your Moxfield account.'};
  const choice=window.prompt(`Add ${message.name} to which deck? Enter a number:\n${decks.map((d,i)=>`${i+1}. ${d.name}`).join('\n')}`);
  if(choice===null)return {ok:false,error:'Add cancelled.'};const deck=decks[Number(choice)-1];if(!deck)return {ok:false,error:'Choose a valid deck number.'};
  const result=await globalThis.MoxDecks.add({name:message.name.trim()},deck.publicId);return {ok:true,deck:result.deck.name,card:result.card.name};
 }catch(error){return {ok:false,error:error.message||'Could not add this card.'};}
 })();
});
// Read a list-row total without changing the current deck or its preview cache.
globalThis.MoxDecks.cardCount=async id=>{
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('Invalid deck ID.');
 const {deck}=await command('preview',{deck:id});
 if(!deck||typeof deck!=='object'||!(deck.boards||deck.mainboard||deck.mainBoard||deck.cards))throw Error('Deck card count unavailable.');
 return globalThis.MoxRules.normalizeDeck(deck).filter(card=>['mainboard','commanders'].includes(card.section)).reduce((sum,card)=>sum+card.qty,0);
};
globalThis.MoxDecks.preview=async(force=false)=>{
 const deck=await globalThis.MoxDecks.current();if(!deck)return null;
 if(force){captured=null;previewPending=null;deckEpoch++;}
 const epoch=deckEpoch;
 const summarize=raw=>{const cards=globalThis.MoxRules.normalizeDeck(raw);return {id:deck.id,name:raw.name||deck.name,cards,activeCount:cards.filter(c=>['mainboard','commanders'].includes(c.section)).reduce((total,c)=>total+c.qty,0)};};
 if(!force&&captured?.id===deck.id)return summarize(captured.deck);
 if(previewPending?.id===deck.id&&previewPending.epoch===epoch)return previewPending.promise;
 const promise=command('preview',{deck:deck.id}).then(result=>{
  if(epoch!==deckEpoch||current?.id!==deck.id)return globalThis.MoxDecks.preview();
  captured={id:deck.id,deck:result.deck};return summarize(result.deck);
 }).finally(()=>{if(previewPending?.promise===promise)previewPending=null;});
 previewPending={id:deck.id,epoch,promise};return promise;
};
globalThis.MoxDecks.commander=async()=>{
 const deck=await globalThis.MoxDecks.current(),currentID=location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)/)?.[1];
 if(currentID&&deck?.id!==currentID)return null;
 const names=context?.commanders?.length?context.commanders:deck?.commanders;
 if(!names?.length)return null;
 return {names,name:names.join(' + '),slug:names.map(globalThis.MoxEDHREC.slug).join('-'),deckName:deck?.name||'Current deck',deck:deck?.id};
};
})();
