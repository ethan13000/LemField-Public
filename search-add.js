/* One explicit add to the remembered deck from Moxfield card search results. */
(async()=>{
 'use strict';
 const prefs=await browser.storage.local.get('mrd_features');if(prefs?.mrd_features?.searchAdd===false)return;
 const valid=deck=>typeof deck?.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(deck.id)&&typeof deck.name==='string'&&deck.name.trim();
 const clean=value=>String(value||'').replace(/^card (?:art|image) (?:for|of)\s+/i,'').replace(/\s+/g,' ').trim();
 function cardFor(action){
  for(let scope=action.parentElement,depth=0;scope&&scope!==document.body&&depth<10;scope=scope.parentElement,depth++){
   const names=new Set([...scope.querySelectorAll('a[href*="/cards/"]')].filter(a=>!a.closest('[data-mrd-owned]')).map(a=>clean(a.getAttribute('data-card-name')||a.querySelector('img[alt]')?.alt||a.textContent)).filter(name=>name&&name.length<=160&&!/^(?:details|view details|card image)$/i.test(name)));
   if(names.size>1)return null;
   if(names.size===1)return {name:[...names][0]};
  }
  return null;
 }
 let remembered=null,timer=null;const entries=new Map();
 async function updateDeck(){
  try{const current=await globalThis.MoxDecks?.current?.();remembered=valid(current)?current:(await browser.storage.local.get('mrd_last_deck')).mrd_last_deck;if(!valid(remembered))remembered=null;}catch{remembered=null;}
  schedule();
 }
 function install(native,card){
  const wrap=document.createElement('div');wrap.className='mrd-search-add';wrap.setAttribute('data-mrd-owned','search-add');wrap.style.cssText='width:100%;margin:6px 0';
  const button=document.createElement('button');button.type='button';button.className=native.className;
  const style=getComputedStyle(native);for(const property of ['font-family','font-size','font-weight','line-height','padding','border-radius','min-height'])button.style.setProperty(property,style.getPropertyValue(property));
  button.style.cssText+=';display:block;width:100%;background:#623478;border:1px solid #805594;color:#fff;white-space:normal;cursor:pointer';
  const status=document.createElement('span');status.hidden=true;status.setAttribute('role','status');status.style.cssText='display:block;font-size:12px;line-height:1.4;margin-top:4px';
  const entry={wrap,button,status,card,locked:false,target:null};
  button.addEventListener('click',async event=>{
   event.preventDefault();event.stopPropagation();if(entry.locked||!entry.target)return;
   const target={...entry.target};entry.locked=true;button.disabled=true;button.textContent='Adding to '+target.name+'…';status.textContent='';status.hidden=true;
   try{const result=await globalThis.MoxDecks.add({name:card.name},target.id,'mainboard');button.textContent='✓ Added to '+(result.deck?.name||target.name);button.style.background='#244c3b';status.textContent='Added one copy to the main deck.';status.hidden=false;}
   catch(error){status.hidden=false;status.textContent=error.message||'Could not add this card.';if(!/unknown|may be incomplete|timed out|did not respond/i.test(status.textContent)){entry.locked=false;button.disabled=false;button.textContent='Add to '+target.name;}else button.textContent='Check '+target.name+' before retrying';}
  });
  wrap.append(button,status);native.after(wrap);entries.set(native,entry);return entry;
 }
 function scan(){
  const searching=/^\/search\/cards\/?$/.test(location.pathname);
  for(const [native,entry] of entries)if(!searching||!native.isConnected){entry.wrap.remove();entries.delete(native);}
  if(!searching)return;
  for(const native of document.querySelectorAll('button,a,[role="button"]')){
   if(native.closest('[data-mrd-owned],#mrd-root,#mrd-sidebar')||!/^add to deck$/i.test(clean(native.textContent)))continue;
   const card=cardFor(native);if(!card)continue;
   let entry=entries.get(native);if(entry&&entry.card.name!==card.name){entry.wrap.remove();entries.delete(native);entry=null;}
   entry=entry||install(native,card);if(!entry.wrap.isConnected)native.after(entry.wrap);if(entry.locked)continue;
   entry.target=remembered?{id:remembered.id,name:remembered.name}:null;
   const text=entry.target?'Add to '+entry.target.name:'Open a deck first';if(entry.button.textContent!==text)entry.button.textContent=text;
   entry.button.disabled=!entry.target;entry.button.title=entry.target?'Add one copy to '+entry.target.name+'’s main deck using your preferred printing.':'Open a Moxfield deck, then return to search.';
  }
 }
 function schedule(){if(timer!==null)return;timer=setTimeout(()=>{timer=null;scan();},150);}
 new MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('[data-mrd-owned="search-add"]')))schedule();}).observe(document.body,{childList:true,subtree:true,characterData:true});
 browser.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.mrd_last_deck)updateDeck();});
 window.addEventListener('popstate',updateDeck);window.addEventListener('mrd-current-deck-updated',updateDeck);
 window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.source==='mrd-route-v3')updateDeck();});
 await updateDeck();
})();
