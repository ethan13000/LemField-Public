/* Metadata-only discovery beyond EDHREC's recommendation pool. */
(()=>{
 'use strict';
 const R=globalThis.MoxRules,C=globalThis.MoxCardSearch;
 const metadata=new Map(),results=new Map(),nameKey=name=>String(name||'').normalize('NFKC').trim().toLowerCase();
 let active=null,timer=null;
 function remember(cards){for(const card of cards||[]){if(typeof card?.name!=='string'||!card.detailsLoaded)continue;if(metadata.size>=3000&&!metadata.has(nameKey(card.name)))metadata.delete(metadata.keys().next().value);metadata.set(nameKey(card.name),{time:Date.now(),card});}}
 function get(name){const hit=metadata.get(nameKey(name));return hit&&Date.now()-hit.time<3600000?hit.card:null;}
 async function find({rule,queryOverride='',commanders=[],excludeNames=new Set(),target=50,isCurrent=()=>true,onPage=()=>{},accept}){
  const search=rule?R.requirementSearch(rule,commanders):{query:'f:commander'};if(search.error)throw Error(search.error);
  let query=search.query.replace(/ sort:edhrec dir:asc$/,'');if(queryOverride){if(typeof queryOverride!=='string'||queryOverride.length>500)throw Error('Scryfall query must be 500 characters or fewer.');query+=' '+queryOverride.trim();}const exclude=new Set([...excludeNames].map(nameKey));
  const known=commanders.length&&commanders.every(card=>card.colorIdentityKnown!==false&&typeof card.colors==='string'),colors=known?[...new Set(commanders.flatMap(card=>card.colors.split('')))].join(''):null;
  if(!rule&&colors!==null)query+=' id<='+(colors||'c');
  const key=JSON.stringify([query,rule?.logic,rule?.criteria,[...exclude].sort()]),cached=results.get(key),found=new Map(),all=new Map();
  let nextPage=1,exhausted=false;
  if(cached&&Date.now()-cached.time<3600000){
   nextPage=cached.nextPage;exhausted=cached.exhausted;onPage(cached.cards);for(const card of cached.cards){all.set(card.oracleId||nameKey(card.name),card);if(!accept||accept(card))found.set(card.oracleId||nameKey(card.name),card);}
   if(found.size>=target||cached.exhausted)return {cards:[...found.values()].slice(0,target),exhausted:cached.exhausted};
  }
  for(let page=nextPage;isCurrent()&&found.size<target&&!exhausted;page++){
   const reply=await browser.runtime.sendMessage({type:'mrd-role-cards',query,page});
   if(!isCurrent())return {cards:[...found.values()].slice(0,target),cancelled:true,exhausted:false};
   if(!reply?.ok)throw Error(reply?.error||'Role search unavailable.');
   const cards=Array.isArray(reply.cards)?reply.cards:[];remember(cards);
   const eligible=C.filter(cards,{rule,colors,condense:true}).filter(card=>!exclude.has(nameKey(card.name)));
   for(const card of eligible)all.set(card.oracleId||nameKey(card.name),card);
   nextPage=page+1;
   onPage(eligible);
   for(const card of eligible)if(!accept||accept(card))found.set(card.oracleId||nameKey(card.name),card);
   exhausted=!reply.hasMore;
   if(isCurrent()){if(results.size>=48&&!results.has(key))results.delete(results.keys().next().value);results.set(key,{time:Date.now(),cards:[...all.values()],exhausted,nextPage});}
  }
  const cards=[...found.values()].slice(0,target);
  return {cards,exhausted,cancelled:!isCurrent()};
 }
 function notify(){window.dispatchEvent(new CustomEvent('mrd-role-prefetch-ready'));}
 async function warm(){
  const route=location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)/)?.[1];if(!route){if(active)active.cancelled=true;return;}
  try{
   const stored=await browser.storage.local.get(['mrd_settings','mrd_features']),flags=stored.mrd_features||{};
   if(flags.prefetchRoles===false||flags.edhrec===false||flags.explorer===false){if(active)active.cancelled=true;return;}
   const deck=await globalThis.MoxDecks?.preview?.();if(!deck?.id||deck.id!==route||location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)/)?.[1]!==route||!Array.isArray(deck.cards))return;
   const settings=R.sanitizeSettings(stored.mrd_settings),profileId=settings.perDeck?.[deck.id]||settings.selectedProfile,base=settings.profiles.find(profile=>profile.id===profileId)||settings.profiles[0],profile=settings.deckProfiles?.[deck.id]?.[base.id]||base;
   const commanders=deck.cards.filter(card=>card.section==='commanders'&&card.qty>0),excludeNames=new Set(deck.cards.filter(card=>card.qty>0&&['mainboard','commanders'].includes(card.section)).map(card=>nameKey(card.name)));
   if(!commanders.length)return;
   const signature=JSON.stringify([deck.id,commanders.map(card=>[card.name,card.colors,card.colorIdentityKnown]),profile.rules,[...excludeNames].sort()]);
   if(active?.signature===signature&&!active.cancelled)return active.promise;
   if(active)active.cancelled=true;
   const state={deckId:deck.id,signature,cancelled:false,cards:new Map(),counts:new Map()};active=state;
   const isCurrent=()=>active===state&&!state.cancelled&&location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)/)?.[1]===deck.id;
   state.promise=(async()=>{
    for(const rule of profile.rules){
     if(!isCurrent()){state.cancelled=true;break;}
     try{const result=await find({rule,commanders,excludeNames,target:50,isCurrent,onPage:cards=>{for(const card of cards)state.cards.set(card.oracleId||nameKey(card.name),card);notify();}});state.counts.set(rule.id,result.cards.length);}
     catch(error){state.counts.set(rule.id,0);if(/rate limit|timed out|unavailable/i.test(error.message))break;}
    }
    if(!isCurrent())state.cancelled=true;notify();
   })();return state.promise;
  }catch{/* Foreground role searches still report errors when explicitly requested. */}
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(warm,500);}
 globalThis.MoxRoleSearch={find,get,remember,rowsForDeck:id=>active?.deckId===id?[...active.cards.values()]:[]};
 window.addEventListener('mrd-current-deck-updated',schedule);window.addEventListener('popstate',schedule);
 window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.source==='mrd-route-v3')schedule();});
 browser.storage.onChanged?.addListener?.((changes,area)=>{if(area==='local'&&(changes.mrd_settings||changes.mrd_features)){if(active)active.cancelled=true;schedule();}});
 schedule();
})();
