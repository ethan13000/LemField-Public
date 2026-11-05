/* Optional filter for Moxfield's native deck card search. */
(async()=>{
'use strict';
const prefs=await browser.storage.local.get('mrd_features');
if(prefs?.mrd_features?.deckSearch===false)return;
const deckId=()=>location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)/)?.[1]||null;
const isDeckSearch=()=>!!deckId()&&!/^\/decks\/[A-Za-z0-9_-]+\/?$/.test(location.pathname)&&(/search/i.test(location.pathname)||!!document.querySelector('input[type="search"],[placeholder*="Search" i],[aria-label*="Search" i]'));
const isGlobalSearch=()=>/^\/search\/cards\/?$/.test(location.pathname);
const isSearchPage=()=>isGlobalSearch()||isDeckSearch();

const key=name=>String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
let id=null,deckName='',loading=true,loadError='',loadRun=0;
let names=new Set(),enabled=false,observer=null,timer=null;
let control=null,checkbox=null,labelText=null,template=null;
const controlRow=document.createElement('div');controlRow.id='mrd-deck-search-filter-row';controlRow.style.cssText='display:block;flex:0 0 100%;width:100%;clear:both;margin-top:4px';
// Keep native/React checkbox handlers from also toggling this independent control.
for(const event of ['click','input','change'])controlRow.addEventListener(event,event=>event.stopPropagation());
function makeControl(collection){
 template=collection;
 control=document.createElement('label');control.id='mrd-deck-search-filter';
 const textStyle=getComputedStyle(collection.querySelector('label')||collection);
 control.style.cssText='display:flex;align-items:center;gap:8px;margin:0;padding:0;cursor:pointer';
 for(const property of ['font-family','font-size','font-weight','line-height','color'])control.style.setProperty(property,textStyle.getPropertyValue(property));
 const nativeInput=collection.querySelector('input[type="checkbox"]')||collection.closest('label')?.querySelector('input[type=checkbox]')||collection.parentElement?.querySelector('input[type=checkbox]');
 checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='mrd-deck-search-filter-toggle';checkbox.checked=enabled;checkbox.style.margin='0';checkbox.style.flexShrink='0';
 if(nativeInput)checkbox.className=nativeInput.className;
 checkbox.disabled=false;
 if(nativeInput){const nativeStyle=getComputedStyle(nativeInput);for(const property of ['width','height','appearance','border-radius','vertical-align'])checkbox.style.setProperty(property,nativeStyle.getPropertyValue(property));}
 labelText=document.createTextNode(' Exclude cards already in this deck');control.append(checkbox,labelText);
 checkbox.addEventListener('change',()=>{enabled=checkbox.checked;apply();});
 controlRow.replaceChildren(control);
}
function resultCard(anchor){
 let node=anchor,candidate=null;
 for(let depth=0;depth<14&&node.parentElement;depth++){
  const parent=node.parentElement;
  const resultBranches=[...parent.children].filter(child=>child.matches?.('a[href*="/cards/"]')||child.querySelector?.('a[href*="/cards/"]'));
  if(resultBranches.length>=2&&resultBranches.includes(node)){
   candidate=node;
   const controls=[...node.querySelectorAll('button,[role="button"],input,select')];
   const hasDeckControls=controls.some(control=>/sideboard|quantity|add to deck|add card|copies/i.test([control.textContent,control.getAttribute('aria-label'),control.getAttribute('title'),control.getAttribute('placeholder')].join(' ')));
   // Prefer the repeated card entry that also owns its deck action controls.
   if(hasDeckControls)return node;
  }
  if(node.matches('article,li,[role="listitem"]'))candidate=node;
  node=parent;
 }
 return candidate||anchor.closest('article,li,[role="listitem"]')||anchor.parentElement;
}
function apply(){
 if(!isSearchPage()||(deckId()&&deckId()!==id)){restoreResults();return;}
 const entries=new Map();
 for(const anchor of document.querySelectorAll('a[href*="/cards/"]')){
  if(anchor.closest('#mrd-deck-search-filter-row'))continue;
  const card=resultCard(anchor);if(!card)continue;
  const name=anchor.getAttribute('data-card-name')||anchor.getAttribute('title')||anchor.querySelector('img')?.alt||anchor.getAttribute('aria-label')||anchor.textContent.trim();
  entries.set(card,entries.get(card)===true||enabled&&names.has(key(name)));
 }
 let excluded=0;
 for(const [card,hide] of entries){
  if(!card.dataset.mrdSearchOriginalDisplay)card.dataset.mrdSearchOriginalDisplay=card.style.getPropertyValue('display')||'__unset__';
  if(hide)excluded++;
  if(hide)card.style.setProperty('display','none','important');
  else if(card.dataset.mrdSearchOriginalDisplay==='__unset__')card.style.removeProperty('display');
  else card.style.setProperty('display',card.dataset.mrdSearchOriginalDisplay);
 }
 const label=' Exclude cards already in '+(isGlobalSearch()&&deckName?deckName:'this deck')+(loadError?' ('+loadError+')':loading?' (loading deck…)':' ('+excluded+' excluded)');
 if(labelText&&labelText.nodeValue!==label)labelText.nodeValue=label;
}
function restoreResults(){for(const card of document.querySelectorAll('[data-mrd-search-original-display]')){const original=card.dataset.mrdSearchOriginalDisplay;if(original==='__unset__')card.style.removeProperty('display');else card.style.setProperty('display',original);}}
function place(){
 if(!isSearchPage()||(deckId()&&id&&deckId()!==id)){controlRow.remove();restoreResults();return;}
 const collection=[...document.querySelectorAll('label,[role="checkbox"],div,span')].find(node=>/^search only cards in your collection\s*$/i.test((node.textContent||'').trim()));
 if(collection){
  if(!control||template!==collection)makeControl(collection);
  const nativeInput=collection.querySelector('input[type=checkbox]')||collection.closest('label')?.querySelector('input[type=checkbox]');
  let anchor=collection;
  if(nativeInput){
   for(let depth=0;depth<5&&anchor.parentElement;depth++){
    if(anchor.parentElement.querySelectorAll('input[type=checkbox]:not(#mrd-deck-search-filter-toggle)').length>1)break;
    anchor=anchor.parentElement;
   }
  }
  if(controlRow.parentElement!==anchor.parentElement||controlRow.previousElementSibling!==anchor)anchor.after(controlRow);
  if(nativeInput){const offset=nativeInput.getBoundingClientRect().left-controlRow.getBoundingClientRect().left;const padding=Math.max(0,offset)+'px';if(controlRow.style.paddingLeft!==padding)controlRow.style.paddingLeft=padding;}
 }else if(isGlobalSearch()){
  const advanced=[...document.querySelectorAll('a,button')].find(node=>/^advanced search$/i.test((node.textContent||'').trim())&&!node.closest('dialog,[role="dialog"],.modal'));
  const anchor=advanced?.parentElement;
  if(anchor&&anchor!==document.body&&!anchor.matches('main')&&(anchor.textContent||'').length<600){
   if(!control||template!==anchor)makeControl(anchor);
   if(controlRow.parentElement!==anchor.parentElement||controlRow.previousElementSibling!==anchor)anchor.after(controlRow);
   controlRow.style.paddingLeft='0';
  }else if(controlRow.isConnected)controlRow.remove();
 }else if(controlRow.isConnected)controlRow.remove();
 if(checkbox)checkbox.disabled=loading||!id||!!loadError;
 apply();
}
async function loadDeck(){
 const run=++loadRun;loading=true;loadError='';
 try{
  const current=await globalThis.MoxDecks?.current?.(),recent=(await browser.storage.local.get('mrd_last_deck')).mrd_last_deck;
  const selected=deckId()?{id:deckId(),name:current?.id===deckId()?current.name:''}:current?.id?current:recent;
  if(run!==loadRun)return;
  if(typeof selected?.id!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(selected.id)){id=null;names.clear();throw Error('open a deck first');}
  if(id!==selected.id){names.clear();restoreResults();}id=selected.id;deckName=String(selected.name||'the previous deck');place();
  let deck=current?.id===id?await globalThis.MoxDecks?.preview(false):null;
  if(!deck?.cards?.length){const reply=await browser.runtime.sendMessage({type:'mrd-read-deck',id:selected.id});if(reply?.ok)deck={id:selected.id,cards:globalThis.MoxRules.normalizeDeck(reply.data)};}
  if(run!==loadRun)return;
  if(deck?.id!==selected.id||!Array.isArray(deck?.cards))throw Error('deck list unavailable; refresh to retry');
  names=new Set(deck.cards.filter(c=>c.qty>0&&['mainboard','commanders'].includes(c.section)).map(c=>key(c.name)));
 }catch(error){if(run===loadRun){names.clear();loadError=error.message||'deck list unavailable';}}
 finally{if(run===loadRun){loading=false;place();}}
}
function start(){place();if(!observer)observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(place,100);});observer.observe(document.body,{childList:true,subtree:true});loadDeck();}
window.addEventListener('mrd-current-deck-updated',loadDeck);window.addEventListener('popstate',loadDeck);
window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.source==='mrd-route-v3')loadDeck();});
browser.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.mrd_last_deck)loadDeck();});
start();
})();
