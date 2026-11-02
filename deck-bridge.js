/* Moxfield session operations. Authorization stays in the page closure.
 * The same-origin page message channel is not an extension-only authentication boundary. */
(()=>{
'use strict';
if(window.__mrdDeckBridgeInstalled)return;window.__mrdDeckBridgeInstalled=true;
const nativeFetch=window.fetch,api='https://api2.moxfield.com';
let authorization=null;
const validID=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
function remember(url,headers){
 try{
  if(!/^https:\/\/api2?\.moxfield\.com$/.test(new URL(String(url),location.href).origin))return;
  let auth=headers?.get?.('authorization');
  if(!auth&&headers)for(const [key,value] of (Array.isArray(headers)?headers:Object.entries(headers)))if(key.toLowerCase()==='authorization')auth=value;
  if(typeof auth==='string'&&/^Bearer \S+$/.test(auth))authorization=auth;
 }catch{}
}
window.fetch=function(...args){const input=args[0];remember(typeof input==='string'?input:input?.url||input?.href,args[1]?.headers||input?.headers);return nativeFetch.apply(this,args);};
const xhrURLs=new WeakMap(),open=XMLHttpRequest.prototype.open,setHeader=XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.open=function(method,url,...args){xhrURLs.set(this,url);return open.call(this,method,url,...args);};
XMLHttpRequest.prototype.setRequestHeader=function(name,value){remember(xhrURLs.get(this),{[name]:value});return setHeader.call(this,name,value);};
async function request(path,body,deadline=Date.now()+45000,methodOverride){
 if(!authorization)throw new Error('Sign in to Moxfield, then refresh this page to connect your decks.');
 const remaining=deadline-Date.now();if(remaining<=0)throw new Error('Deck action timed out. Check the deck before retrying.');
 const controller=new AbortController();let timer,response;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Moxfield request timed out.'));},Math.min(15000,remaining));});
 try{
  const method=methodOverride||(body?'POST':'GET');
  response=await Promise.race([nativeFetch.call(window,api+path,{method,credentials:'include',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json',Authorization:authorization,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),timeout]);
  if(response.status===401){authorization=null;throw new Error('Your Moxfield session expired. Sign in and refresh this page.');}
  if(!response.ok)throw new Error(`Moxfield returned HTTP ${response.status}.`);
  if(method==='DELETE')return {};
  return await Promise.race([response.json(),timeout]);
 }catch(error){if((body||methodOverride)&&(!response||response.ok||response.status>=500||error.name==='AbortError'))throw new Error(methodOverride==='DELETE'?'Printing change may be incomplete. Check the deck before retrying.':'Deck update result unknown. Check the deck before trying again.');throw error;}
 finally{clearTimeout(timer);}
}
async function decks(deadline){
 const data=await request('/v3/decks',undefined,deadline);
 const list=Array.isArray(data)?data:data.decks;
 if(!Array.isArray(list))throw new Error('Moxfield returned an unfamiliar deck list.');
 return list.filter(d=>validID(d.id)&&validID(d.publicId)).map(d=>({id:d.id,publicId:d.publicId,name:String(d.name||'Untitled deck')}));
}
const completed=new Map(),pending=new Map();
async function execute(message,deadline=Date.now()+45000){
 if(message.action==='decks')return {decks:await decks(deadline)};
 if(message.action==='preview'&&validID(message.deck))return {deck:await request('/v3/decks/all/'+message.deck)};
 if(message.action!=='add'||!validID(message.deck)||typeof message.name!=='string'||!message.name.trim()||message.name.length>160||!['mainboard','sideboard','maybeboard'].includes(message.board))throw new Error('Invalid deck action.');
 const owned=await decks(deadline),deck=owned.find(d=>d.publicId===message.deck);
 if(!deck)throw new Error('Choose one of your own Moxfield decks. The current deck may belong to another player.');
 const printing=message.printing;
 if(printing&&(!/^[a-z0-9]{2,10}$/i.test(printing.set||'')||typeof printing.collectorNumber!=='string'||!printing.collectorNumber||printing.collectorNumber.length>30))throw new Error('Invalid printing selection.');
 const query=message.name+(printing?' set:'+printing.set:'');
 const search=await request('/v2/cards/search/user?q='+encodeURIComponent(query)+'&page=1',undefined,deadline);
 const key=name=>String(name).normalize('NFKC').toLowerCase().replace(/[’]/g,"'").trim();
 const matches=c=>{
  if(key(c.name)!==key(message.name))return false;
  if(!printing)return true;
  const scryfallId=c.scryfall_id||c.scryfallId;
  if(scryfallId&&printing.scryfallId)return scryfallId===printing.scryfallId;
  return key(typeof c.set==='object'?c.set?.code:c.set)===key(printing.set)&&String(c.cn??c.collector_number??c.collectorNumber??'')===printing.collectorNumber;
 };
 let card=(search.data||[]).find(matches);
 if(printing&&!card)for(let page=2;page<=20&&search.hasMore===true;page++){
  const next=await request('/v2/cards/search/user?q='+encodeURIComponent(query)+'&page='+page,undefined,deadline);card=(next.data||[]).find(matches);if(card||next.hasMore!==true)break;
 }
 if(printing&&!card)throw new Error('The selected printing could not be matched on Moxfield. No card was added.');
 if(!card||!validID(card.id))throw new Error('An exact Moxfield card match was not found. No card was added.');
 const result=await request(`/v2/decks/${deck.id}/cards/${message.board}`,{cardId:card.id,quantity:1,usePrefPrinting:!printing},deadline);
 if(!result?.card)throw new Error('Moxfield did not confirm the add. Check the deck before trying again.');
 // Update requirements counts when the destination deck is open in this tab.
 if(location.pathname.split('/')[2]===deck.publicId){
  request('/v3/decks/all/'+deck.publicId).then(data=>{
   if(location.pathname.split('/')[2]===deck.publicId)window.postMessage({source:'mrd-deck-response-v2',id:deck.publicId,deck:data},location.origin);
  }).catch(()=>{});
  window.postMessage({source:'mrd-deck-add-complete-v1',id:deck.publicId},location.origin);
 }
 return {deck,card:{name:card.name},board:message.board};
}
async function changePrinting(message,deadline=Math.min(Date.now()+10000,Number(message.deadline)||Infinity)){
 if(!validID(message.deck)||typeof message.name!=='string'||!message.name.trim()||message.name.length>160||!message.printing||(message.board&&!['mainboard','commanders','sideboard','maybeboard'].includes(message.board)))throw new Error('Invalid printing change.');
 const chosen=message.printing;
 const progress=stage=>window.postMessage({source:'mrd-deck-progress-v1',requestId:message.requestId,stage},location.origin);
 if(!/^[a-z0-9]{2,10}$/i.test(chosen.set||'')||typeof chosen.collectorNumber!=='string'||!chosen.collectorNumber||chosen.collectorNumber.length>30)throw new Error('Invalid printing selection.');
 progress('Reading deck');
 const [owned,raw]=await Promise.all([decks(deadline),request('/v3/decks/all/'+message.deck,undefined,deadline)]),deck=owned.find(d=>d.publicId===message.deck);
 if(!deck)throw new Error('Choose one of your own Moxfield decks.');
 const boards=raw.boards||raw;
 const key=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[’]/g,"'").trim(),matches=[];
 for(const section of ['mainboard','commanders','sideboard','maybeboard']){
  if(message.board&&section!==message.board)continue;
  const board=boards[section],entries=board?.cards||board?.cardEntries||board||{};
  for(const [entryKey,entry] of Object.entries(Array.isArray(entries)?Object.fromEntries(entries.map((value,index)=>[String(index),value])):entries)){
   const card=entry?.card||entry?.cardData||entry,cardId=String(entry?.cardId||card?.id||entryKey),set=typeof card?.set==='object'?card.set?.code:card?.set,collector=String(card?.cn??card?.collector_number??card?.collectorNumber??'');
   if(key(card?.name||entry?.name)!==key(message.name))continue;
   if(message.sourceCard?.cardId&&cardId!==message.sourceCard.cardId)continue;
   if(message.sourceCard?.set&&message.sourceCard?.collectorNumber&&(key(set)!==key(message.sourceCard.set)||collector!==String(message.sourceCard.collectorNumber)))continue;
   const quantity=Number(entry?.quantity??entry?.count??1);
   if(!validID(cardId)||!Number.isInteger(quantity)||quantity<1)continue;
   matches.push({section,cardId,quantity,set,collector,finish:entry?.finish||(entry?.isFoil?'foil':'nonFoil'),isAlter:entry?.isAlter===true});
  }
 }
 if(!matches.length)throw new Error('This card is not in the selected deck. No card was added.');
 if(matches.length>1)throw new Error('More than one matching deck entry was found. Open the menu on the exact card entry and try again.');
 const existing=matches[0];
 progress('Finding selected printing');
 if(key(existing.set)===key(chosen.set)&&existing.collector===chosen.collectorNumber)return {deck,card:{name:message.name},alreadySelected:true};
 const query=message.name+' set:'+chosen.set,search=await request('/v2/cards/search/user?q='+encodeURIComponent(query)+'&page=1',undefined,deadline);
 const nameKey=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s*\/\/\s*/g,' // ').replace(/[^a-z0-9/' ]/gi,'').replace(/\s+/g,' ').trim().toLowerCase();
 const matchesPrinting=card=>nameKey(card?.name)===nameKey(message.name)&&key(typeof card?.set==='object'?card.set?.code:card?.set)===key(chosen.set)&&String(card?.cn??card?.collector_number??card?.collectorNumber??'').trim()===String(chosen.collectorNumber).trim();
 let replacement=(search.data||[]).find(matchesPrinting);
 if(!replacement)for(let page=2;page<=20&&search.hasMore===true;page++){const next=await request('/v2/cards/search/user?q='+encodeURIComponent(query)+'&page='+page,undefined,deadline);replacement=(next.data||[]).find(matchesPrinting);if(replacement||next.hasMore!==true)break;}
 if(!replacement||!validID(replacement.id))throw new Error('The selected printing could not be matched on Moxfield. The existing card is unchanged.');
 progress('Applying selected printing');
 let updated;
 try{updated=await request(`/v2/decks/${deck.id}/cards/${encodeURIComponent(existing.cardId)}/edition`,{newEditionCardId:replacement.id,finish:existing.finish,isAlter:existing.isAlter},deadline,'PUT');}
 catch(error){throw new Error('Moxfield could not confirm this card edition change. Refresh and check the deck before retrying. '+error.message);}
 const responseCard=updated?.card?.card||updated?.card;
 if(!responseCard)throw new Error('Moxfield did not confirm the edition change. Refresh and check the deck before retrying.');
 progress('Verifying replacement');
 const boardRows=data=>{const board=(data.boards||data)[existing.section],entries=board?.cards||board?.cardEntries||board||{};return Object.values(entries).map(entry=>({card:entry?.card||entry?.cardData||entry,id:String(entry?.cardId||(entry?.card||entry?.cardData||entry)?.id||''),quantity:Number(entry?.quantity??entry?.count??0)}));};
 const printingMatches=(card,set,number)=>key(typeof card?.set==='object'?card.set?.code:card?.set)===key(set)&&String(card?.cn??card?.collector_number??card?.collectorNumber??'').trim()===String(number).trim();
 let checked,verified,newRows=[];
 // Moxfield switches an edition on the existing entry. Verify the same quantity
 // remains attached to the requested set and collector number before reporting success.
 for(let attempt=0;attempt<4;attempt++){
  try{checked=await request('/v3/decks/all/'+deck.publicId+'?mrdVerify='+Date.now(),undefined,deadline);}
  catch(error){throw new Error('Printing change may be incomplete: Moxfield accepted the edition update but verification failed. Refresh and check the card. '+error.message);}
  verified=boardRows(checked);newRows=verified.filter(row=>nameKey(row.card?.name)===nameKey(message.name)&&row.quantity===existing.quantity&&printingMatches(row.card,chosen.set,chosen.collectorNumber));
  if(newRows.length===1)break;
  if(attempt<3&&Date.now()<deadline-250)await new Promise(resolve=>setTimeout(resolve,Math.min(250*(attempt+1),Math.max(0,deadline-Date.now()-100))));
 }
 if(newRows.length!==1){const seen=verified.filter(row=>nameKey(row.card?.name)===nameKey(message.name)).map(row=>`${row.card?.set||'?'} #${row.card?.cn||row.card?.collector_number||row.card?.collectorNumber||'?'} x${row.quantity}`).join(', ')||'no matching card entries',ackSet=typeof responseCard.set==='object'?responseCard.set?.code:responseCard.set,ackNumber=responseCard.cn??responseCard.collector_number??responseCard.collectorNumber,acknowledgement=ackSet&&ackNumber?` Moxfield acknowledged ${ackSet} #${ackNumber}.`:'';throw new Error(`Printing change may be incomplete: expected ${chosen.set} #${chosen.collectorNumber} x${existing.quantity}; Moxfield returned ${seen}.${acknowledgement} Refresh and check the card.`);}
 if(location.pathname.split('/')[2]===deck.publicId){
  window.postMessage({source:'mrd-deck-printing-complete-v1',id:deck.publicId},location.origin);
  request('/v3/decks/all/'+deck.publicId,undefined,deadline).then(updated=>{
   if(location.pathname.split('/')[2]===deck.publicId)window.postMessage({source:'mrd-deck-response-v2',id:deck.publicId,deck:updated},location.origin);
  }).catch(()=>{});
 }
 return {deck,card:{name:message.name},cardId:replacement.id,printing:{set:chosen.set,collectorNumber:chosen.collectorNumber},board:existing.section,quantity:existing.quantity};
}
window.addEventListener('message',event=>{
 const message=event.data;
 if(event.source===window&&event.origin===location.origin&&message?.source==='mrd-deck-bridge-ping-v1'){window.postMessage({source:'mrd-deck-bridge-ready-v1',version:6},location.origin);return;}
 if(event.source!==window||event.origin!==location.origin||message?.source!=='mrd-deck-command-v1'||typeof message.requestId!=='string'||! /^[a-f0-9-]{20,80}$/.test(message.requestId))return;
 const reply=result=>window.postMessage({source:'mrd-deck-result-v1',requestId:message.requestId,...result},location.origin);
 if(completed.has(message.requestId)){reply(completed.get(message.requestId));return;}
 let task=pending.get(message.requestId);
 if(!task){
  if(pending.size>=16){reply({ok:false,error:'Too many deck actions are pending. Wait for them to finish.'});return;}
  task=Promise.resolve().then(()=>message.action==='changePrinting'?changePrinting(message):execute(message)).then(data=>({ok:true,data}),error=>({ok:false,error:error?.message||'Moxfield action failed.'})).then(result=>{
   if(completed.size>=100)completed.delete(completed.keys().next().value);completed.set(message.requestId,result);pending.delete(message.requestId);return result;
  });
  pending.set(message.requestId,task);
 }
 task.then(reply,error=>reply({ok:false,error:error?.message||'Moxfield action failed.'}));
});})();
