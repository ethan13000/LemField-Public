/* EDHREC information for card detail routes and deckbuilder card previews. */
 (async()=>{
'use strict';
const featurePrefs=await browser.storage.local.get('mrd_features');
if(globalThis.__mrdEDHRECInstalled)return;
globalThis.__mrdEDHRECInstalled=true;
const E=globalThis.MoxEDHREC,C=globalThis.MoxCardSearch;
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
const link=(text,url)=>{const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
const edhrecReminder="Don't be an EDHREC warrior: Think about how each card fits your deck's plan. Use EDHREC for ideas, rather than adding cards just because they're popular.";
const moxfieldCardURL=name=>'https://moxfield.com/search/cards?q='+encodeURIComponent(String(name||''));
const visible=node=>node.isConnected&&!node.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(node).display!=='none'&&node.getClientRects().length>0;
let current=null,generation=0,timer=null,addedInEDHRECPlus=false,printingChangedInDialog=false;const openDialogs=new Set();
function noteDeckChanged(printing=false){if(printing)printingChangedInDialog=true;else addedInEDHRECPlus=true;if(!openDialogs.size){addedInEDHRECPlus=false;printingChangedInDialog=false;location.reload();}}
const button=(text,action,cls='')=>{const node=el('button',text,cls);node.type='button';node.onclick=action;return node;};
let windowHost=null;
function dialogHost(){
 if(!windowHost){windowHost=el('div');windowHost.setAttribute('data-mrd-dialog-host','');windowHost.setAttribute('data-mrd-owned','');const shadow=windowHost.attachShadow({mode:'open'}),css=el('link');css.rel='stylesheet';css.href=globalThis.MoxDashboardStyleURL;shadow.append(css);}
 if(!windowHost.isConnected)document.body.append(windowHost);
 return windowHost;
}
function dialog(view,title){
 const modal=el('dialog',null,'edh-dialog'),head=el('div',null,'edh-dialog-header'),heading=el('h2',title),body=el('div',null,'edh-dialog-body');
 heading.id='edh-title-'+crypto.randomUUID();modal.setAttribute('aria-labelledby',heading.id);
 const host=dialogHost(),previous=host.shadowRoot.activeElement||view.host.shadowRoot.activeElement||document.activeElement;
 let closed=false;
 const close=()=>{if(closed)return;closed=true;openDialogs.delete(modal);hideHover();if(modal.open)modal.close();modal.remove();cleanArt();if(previous?.isConnected&&previous!==document.body&&previous!==document.documentElement)previous.focus({preventScroll:true});if(!openDialogs.size&&(addedInEDHRECPlus||printingChangedInDialog)){addedInEDHRECPlus=false;printingChangedInDialog=false;location.reload();}};
 head.append(heading,button('Close',close));modal.append(head,body);host.shadowRoot.append(modal);
 modal.addEventListener('cancel',event=>{event.preventDefault();close();});modal.addEventListener('close',close);modal.showModal();openDialogs.add(modal);
 return {modal,body,close};
}
const artwork=new Map(),cardDetails=new Map(),artTargets=new Map(),deckPreviews=new Map();
function requestCardDetails(name,printingId,printing,priority=false){
 if(typeof printingId==='string'&&printingId.startsWith('mrd_uploaded_art_v1:'))return browser.storage.local.get(printingId).then(values=>({ok:!!values[printingId]?.url,url:values[printingId]?.url}));
 const key=printingId?'printing:'+printingId:printing?'printing:'+printing.set+'/'+printing.collectorNumber:name;
 if(priority==='hover'&&artwork.has(key))browser.runtime.sendMessage({type:'mrd-prioritize-art',key}).catch(()=>{});
 if(!artwork.has(key)){
  if(artwork.size>=300)artwork.delete(artwork.keys().next().value);
  artwork.set(key,Promise.resolve(browser.runtime.sendMessage({type:'mrd-card-art',name,...(priority?{priority}:{}),...(printingId?{printingId}:printing?{printing}:{})})).catch(error=>({ok:false,error:error?.message||'Extension request failed.'})).then(result=>{
   if(!result?.ok||!result.url)artwork.delete(key);
   if(result?.ok&&result.details&&!printingId&&!printing){if(cardDetails.size>=300)cardDetails.delete(cardDetails.keys().next().value);cardDetails.set(name,result.details);}
   return result;
  }));
 }
 return artwork.get(key);
}
function knownDetails(name){const hit=cardDetails.get(name)||globalThis.MoxRoleSearch?.get(name);if(!hit)return null;const {name:ignored,source,url,image,images,key,inclusion,lift,numDecks,...details}=hit;return details;}
function applyCardDetails(card){const details=knownDetails(card.name);return details?{...card,...details}:card;}
function canLeadCommander(card){return String(card?.commanderLegality||'').toLowerCase()==='legal'&&(/\blegendary\s+creature\b/i.test(String(card?.type||''))||/\bcan be your commander\b/i.test(String(card?.oracle||'')));}
const artObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
 for(const entry of entries)artTargets.get(entry.target)?.(entry.isIntersecting);
}):null;
function cleanArt(){globalThis.MoxImageLoader?.clean();for(const target of artTargets.keys())if(!target.isConnected){artObserver?.unobserve(target);artTargets.delete(target);}for(const target of deckPreviews.keys())if(!target.isConnected)deckPreviews.delete(target);}
window.addEventListener('mrd-current-deck-updated',()=>{cleanArt();for(const [aside,view] of deckPreviews)deckPreview(view,aside);});
const descriptionWaiters=new Map();let descriptionTimer=null;
function requestDescription(name,receive){
 const cached=knownDetails(name);if(cached){receive(cached);return;}
 if(!descriptionWaiters.has(name))descriptionWaiters.set(name,[]);descriptionWaiters.get(name).push(receive);
 if(descriptionTimer)return;
 descriptionTimer=setTimeout(async()=>{
  descriptionTimer=null;const entries=[...descriptionWaiters];descriptionWaiters.clear();
  for(let start=0;start<entries.length;start+=75){const group=entries.slice(start,start+75);
   try{const reply=await browser.runtime.sendMessage({type:'mrd-card-details-batch',names:group.map(([name])=>name)});
    for(const [name,callbacks] of group){const details=reply?.cards?.find(card=>card.name===name&&card.ok)?.details;if(!details)continue;if(cardDetails.size>=300)cardDetails.delete(cardDetails.keys().next().value);cardDetails.set(name,details);for(const callback of callbacks)callback(details);}
   }catch{/* Keep the available card information when details are unavailable. */}
  }
 },40);
}
function explorerPrinting(view,card){
 if(!view?.explorerArtMode)return Promise.resolve(null);
 const mode=view.explorerArtMode,key=mode+'|'+card.name+'|'+(card.isToken===true);
 if(!view.explorerPrintings)view.explorerPrintings=new Map();
 if(card.previewPriority==='hover'&&view.explorerPrintings.has(key))browser.runtime.sendMessage({type:'mrd-prioritize-art',key:'art-choice:'+JSON.stringify([card.name.trim(),mode,card.isToken===true])}).catch(()=>{});
 if(!view.explorerPrintings.has(key)){if(view.explorerPrintings.size>=300)view.explorerPrintings.delete(view.explorerPrintings.keys().next().value);view.explorerPrintings.set(key,browser.runtime.sendMessage({type:'mrd-card-art-choice',name:card.name,mode,isToken:card.isToken===true,...(card.previewPriority?{priority:card.previewPriority}:{})}).then(result=>{if(!result?.ok)throw Error(result?.error||'Artwork printing unavailable.');return result.printing;}).catch(error=>{view.explorerPrintings.delete(key);throw error;}));}
 return view.explorerPrintings.get(key);
}
async function cardForExplorerAdd(view,card){
 if(!view?.useExplorerPrinting)return {name:card.name};
 try{const printing=await explorerPrinting(view,card);if(printing?.set&&printing.collectorNumber)return {name:card.name,id:printing.id,set:printing.set,collectorNumber:printing.collectorNumber};}catch{/* Adding the card takes priority when artwork lookup fails. */}
 return {name:card.name};
}
async function addExplorerCard(view,card,deck,board='mainboard'){
 const browsing=view?.edhrecAddContext,normalize=name=>String(name||'').trim().toLowerCase(),names=browsing?.edhrecNames||new Set((view?.data?.allCards||[]).map(row=>normalize(row.name)));
 const context={fromEdhrec:card.source!=='scryfall'&&browsing?.searchMode!=='scryfall'&&names.has(normalize(card.name)),filterScore:browsing?.filterScore||0,board};
 const added=(result,fallback)=>{try{view?.explorerSession?.onAdded?.(card,deck,board);edhrecBurst.record(card,deck,context);refreshEdhrecBanners();}catch{}return {result,fallback};};
 const chosen=await cardForExplorerAdd(view,card);
 try{return added(await globalThis.MoxDecks.add(chosen,deck,board),!!view?.useExplorerPrinting&&!chosen.set);}
 catch(error){if(!chosen.set||!/selected printing could not be matched on Moxfield\. No card was added\./i.test(error.message))throw error;
  return added(await globalThis.MoxDecks.add({name:card.name},deck,board),true);}
}
function edhrecFilterScore(filters={}){
 return (filters.query?.trim()?2:0)+(filters.role?2:0)+(filters.typeLine?.trim()?2:0)+(filters.type?.trim()?0.5:0)+(filters.tag?1:0)+(filters.triggers?.length||0)+(filters.keywords?.length||0)+(filters.minMana!==''&&filters.minMana!=null?0.5:0)+(filters.maxMana!==''&&filters.maxMana!=null?0.5:0)+(filters.maxPrice!==''&&filters.maxPrice!=null?0.5:0);
}
function isEdhrecStaple(card){
 const name=String(card.name||'').normalize('NFKC').trim().toLowerCase();
 return /\bbasic\b.*\bland\b/i.test(card.type||'')||/^(?:snow-covered )?(?:plains|island|swamp|mountain|forest|wastes)$/.test(name)||/^(?:arcane|azorius|boros|dimir|golgari|gruul|izzet|orzhov|rakdos|selesnya|simic) signet$/.test(name)||/^talisman of (?:progress|dominance|indulgence|impulse|unity|hierarchy|creativity|resilience|conviction|curiosity)$/.test(name)||new Set(['sol ring','swords to plowshares','path to exile','command tower','exotic orchard','fellwar stone','mind stone','thought vessel','cultivate',"kodama's reach",'farseek',"nature's lore",'three visits','rampant growth','counterspell','swan song','negate','generous gift','beast within','chaos warp','blasphemous act','austere command','toxic deluge','cyclonic rift','lightning greaves','swiftfoot boots','rhystic study','mystic remora','smothering tithe','demonic tutor','vampiric tutor']).has(name);
}
function createEdhrecBurstMonitor({now=()=>Date.now(),load=()=>null,save=()=>{}}={}){
 let states=Object.create(null),lastDeck=null;try{const data=load();if(data&&typeof data==='object'){lastDeck=typeof data.deck==='string'?data.deck:null;if(data.states&&typeof data.states==='object')for(const [id,item] of Object.entries(data.states).slice(-16))if(/^[A-Za-z0-9_-]{1,100}$/.test(id)&&item&&Array.isArray(item.rows))states[id]={rows:item.rows.slice(-20),dismissedUntil:Number.isFinite(item.dismissedUntil)?item.dismissedUntil:0};}}catch{}
 const persist=()=>{try{save({deck:lastDeck,states});}catch{}};
 const state=deck=>{const item=states[deck];return item&&Array.isArray(item.rows)?item:{rows:[],dismissedUntil:0};};
 return {
  record(card,deck,context={}){
   if(!/^[A-Za-z0-9_-]{1,100}$/.test(deck||'')||!context.fromEdhrec||context.filterScore>=2||context.board!=='mainboard'||isEdhrecStaple(card))return false;
   const time=now(),item=state(deck),name=String(card.name||'').trim().toLowerCase();if(!name)return false;
   item.rows=item.rows.filter(row=>typeof row.name==='string'&&Number.isFinite(row.time)&&time-row.time<60000&&time>=row.time&&row.name!==name);item.rows.push({name,time});item.rows=item.rows.slice(-20);states[deck]=item;lastDeck=deck;
   const ids=Object.keys(states);if(ids.length>16)delete states[ids[0]];persist();return this.active();
  },
  active(){if(!lastDeck)return false;const time=now(),item=state(lastDeck);return time>=(item.dismissedUntil||0)&&item.rows.filter(row=>Number.isFinite(row.time)&&time>=row.time&&time-row.time<60000).length>=3;},
  dismiss(){if(lastDeck){states[lastDeck]={...state(lastDeck),rows:[],dismissedUntil:now()+120000};persist();}}
 };
}
const edhrecBurst=createEdhrecBurstMonitor({load:()=>JSON.parse(sessionStorage.getItem('mrd_edhrec_add_burst_v1')||'null'),save:value=>sessionStorage.setItem('mrd_edhrec_add_burst_v1',JSON.stringify(value))}),edhrecBanners=new Set();let edhrecBannerTimer=null;
function refreshEdhrecBanners(){
 for(const banner of edhrecBanners){if(!banner.isConnected){edhrecBanners.delete(banner);continue;}banner.hidden=!edhrecBurst.active()||(banner._edhrecView?.edhrecAddContext?.filterScore||0)>=2||banner._edhrecView?.edhrecAddContext?.searchMode==='scryfall';}
 clearTimeout(edhrecBannerTimer);if(edhrecBurst.active())edhrecBannerTimer=setTimeout(refreshEdhrecBanners,1000);
}
function edhrecReminderBanner(view){
 const banner=el('div',null,'edh-deckbuilding-reminder edh-add-burst-banner');banner._edhrecView=view;banner.hidden=!edhrecBurst.active()||(view?.edhrecAddContext?.filterScore||0)>=2||view?.edhrecAddContext?.searchMode==='scryfall';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
 banner.append(el('span',edhrecReminder),button('Dismiss',()=>{edhrecBurst.dismiss();refreshEdhrecBanners();},'compact'));edhrecBanners.add(banner);if(edhrecBurst.active()){clearTimeout(edhrecBannerTimer);edhrecBannerTimer=setTimeout(refreshEdhrecBanners,1000);}return banner;
}
function art(card,large=false,view=null){
 const wrap=el('div',null,large?'edh-art-large':'edh-art');
 const placeholder=el('span',null,'edh-art-placeholder');let imageReady=false,visible=card.previewPriority==='hover'||!artObserver,started=false;
 const describe=details=>{placeholder.textContent=[card.name,details?.manaCost||card.manaCost,details?.type||card.type,details?.oracle||card.oracle||card.description||'Card details loading…'].filter(Boolean).join('\n\n');};
 describe(knownDetails(card.name));wrap.append(placeholder);
 const candidates=E.imageURLs(card),attempted=new Set();let requested=false;
 const exact=!!(card.set&&card.collectorNumber),candidateId=card.scryfallId||card.id,printingId=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(candidateId||'')?candidateId:null;
 const unavailable=()=>{placeholder.hidden=false;if(!placeholder.textContent.includes('Image unavailable.'))placeholder.textContent+='\n\nImage unavailable.';};
 const recover=(named=false)=>{
  if(requested){unavailable();return;}requested=true;
  requestCardDetails(card.name,named?null:printingId,named?null:exact?{set:card.set,collectorNumber:card.collectorNumber}:null,card.previewPriority||false).then(result=>{
   if(result?.details)describe(result.details);else if(result?.description)describe({oracle:result.description});
   if(result?.manaCost){card.manaCost=result.manaCost;wrap._onCardDetails?.();}
   if(result?.ok)candidates.push(...E.imageURLs({image:result.url,images:result.images}));
   next();
  });
 };
 const next=()=>{
  const url=candidates.find(value=>!attempted.has(value));
  if(!url){recover();return;}attempted.add(url);placeholder.hidden=false;
  const img=el('img');img.alt=card.name;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
  img.className='edh-art-loading';wrap.append(img);
  globalThis.MoxImageLoader.enqueue(img,url,{visible:()=>visible,priority:card.previewPriority==='hover'?'hover':large,
   loaded:()=>{imageReady=true;img.className='';placeholder.hidden=true;artObserver?.unobserve(wrap);artTargets.delete(wrap);},
   failed:()=>{imageReady=false;img.remove();next();}});
 };
 const activate=inView=>{visible=inView;if(inView&&!started){started=true;requestDescription(card.name,describe);const show=()=>{if(candidates.length)next();else recover();};if(view?.explorerArtMode)explorerPrinting(view,card).then(printing=>{const urls=E.imageURLs(printing);candidates.unshift(...urls);show();},()=>{candidates.length=0;recover(true);});else show();}globalThis.MoxImageLoader.pump();};
 if(card.previewPriority==='hover')activate(true);else if(artObserver){artTargets.set(wrap,activate);artObserver.observe(wrap);}else activate(true);
 return wrap;
}
let hover=null,hoverTimer=null,hoverPending=null;
function hideHover(){clearTimeout(hoverTimer);hoverTimer=null;const previous=hover||hoverPending;hoverPending=null;if(hover){hover.anchor.removeAttribute('aria-describedby');try{hover.node.hidePopover?.();}catch{}hover.node.remove();hover=null;cleanArt();}if(previous?.onClose)queueMicrotask(previous.onClose);}
function hoverArt(view,card,anchor,{exactPrinting=false}={}){
 const identity=JSON.stringify([card.id,card.scryfallId,card.name,card.set,card.collectorNumber,exactPrinting,view?.explorerArtMode]);
 const currentPreview=hover||hoverPending;if(currentPreview?.anchor===anchor&&currentPreview.identity===identity&&(!currentPreview.node||currentPreview.node.isConnected))return;
 hideHover();hoverPending={anchor,identity,onClose:null};const pending=hoverPending;hoverTimer=setTimeout(()=>{
  if(!anchor.isConnected){if(hoverPending===pending)hoverPending=null;return;}
  const node=el('div',null,'edh-hover-preview');node.id='edh-art-'+crypto.randomUUID();node.setAttribute('role','tooltip');node.setAttribute('popover','manual');node.append(art({...card,previewPriority:'hover'},true,card.set&&card.collectorNumber?null:view));
  const details=el('div',null,'edh-hover-details');details.append(el('strong',card.name,'edh-hover-name'));
  if(exactPrinting)details.append(el('span',`${card.setName||String(card.set||'').toUpperCase()} #${card.collectorNumber}`,'edh-hover-edition'));
  if(!exactPrinting)savedPrintArt(card).then(saved=>{if(!saved||!node.isConnected)return;const badge=el('span',`Print artwork · ${saved.choice.set.toUpperCase()} #${saved.choice.collectorNumber}`,'edh-print-art-badge');details.append(badge);const img=node.querySelector('img');if(img)img.src=saved.url;});
  const mana=String(card.manaCost||card.mana_cost||'');if(mana)details.append(el('span',mana.replace(/\{([WUBRGCXYZ0-9]+)\}/gi,'$1').replace(/[{}]/g,''),'edh-hover-mana'));
  node.append(details);dialogHost().shadowRoot.append(node);
  const width=Math.min(440,innerWidth-24),height=Math.min(innerHeight-32,600),rect=anchor.getBoundingClientRect();
  let left=rect.right+14;if(left+width>innerWidth-12)left=rect.left-width-14;if(left<12)left=(innerWidth-width)/2;
  node.style.width=width+'px';node.style.left=left+'px';node.style.top=Math.max(12,Math.min(rect.top,innerHeight-height-12))+'px';
  anchor.setAttribute('aria-describedby',node.id);hover={node,anchor,identity,onClose:pending.onClose};hoverPending=null;try{node.showPopover?.();}catch{}
 },120);
}
function printingVariantPreview(view,variant,row){
 row.classList.add('edh-printing-variant-row');
 const show=()=>hoverArt(view,variant,row,{exactPrinting:true});
 row.addEventListener('mouseenter',show);row.addEventListener('mouseleave',hideHover);
 row.addEventListener('focusin',event=>{if(!row.contains(event.relatedTarget))show();});
 row.addEventListener('focusout',event=>{if(!row.contains(event.relatedTarget))hideHover();});
}
function sameDeckPrinting(card,choice){return !card.lemfieldVirtualToken&&!!choice&&(card.scryfallId===choice.printingId||(String(card.set||'').toLowerCase()===String(choice.set||'').toLowerCase()&&String(card.collectorNumber||'')===String(choice.collectorNumber||'')&&!!card.set&&!!card.collectorNumber));}
async function uploadedChoices(deck,choices){const values=await browser.storage.local.get(null);for(const [key,value] of Object.entries(values))if(key.startsWith('mrd_uploaded_art_v1:'+globalThis.MoxPrintPreferences.prefix(deck))&&/^data:image\/jpeg;base64,/.test(value?.url||'')){choices.set(key.slice('mrd_uploaded_art_v1:'.length),{...value.card,printingId:key,set:'CUSTOM',collectorNumber:'upload'});}return choices;}
function printPreviewCards(preview,choices){
 const cards=[...(preview?.cards||[])],P=globalThis.MoxPrintPreferences;
 for(const choice of choices.values())if(choice.section==='tokens'&&choice.standaloneToken===true&&!cards.some(row=>{try{return P.key(preview.id,row)===P.key(preview.id,choice);}catch{return false;}}))cards.push({...choice,id:choice.tokenSourceId||'',isToken:true,qty:1,lemfieldVirtualToken:true});
 return cards;
}
async function savedPrintArt(card){
 try{
  const deck=await globalThis.MoxDecks?.current?.();if(!deck?.id)return null;
  const preview=await globalThis.MoxDecks.preview(),choices=await uploadedChoices(deck.id,await globalThis.MoxPrintPreferences.read(deck.id)),matches=printPreviewCards(preview,choices).filter(item=>item.name?.normalize('NFKC').toLowerCase()===card.name?.normalize('NFKC').toLowerCase()&&item.section&&(!card.section||item.section===card.section));
  if(!matches.length)return null;const selected=matches.map(row=>choices.get(globalThis.MoxPrintPreferences.key(deck.id,row))).filter(Boolean);
  if(selected.length!==matches.length||new Set(selected.map(choice=>choice.printingId)).size!==1||matches.every(row=>sameDeckPrinting(row,selected[0])))return null;const choice=selected[0];
  const result=await requestCardDetails(card.name,choice.printingId);return result?.ok&&result.url?{choice,url:result.url}:null;
 }catch{return null;}
}
window.addEventListener('scroll',hideHover,true);window.addEventListener('resize',hideHover);
function inspect(view,card){
 const box=dialog(view,card.name);box.body.append(art(card,true,view),link('Find on Moxfield',moxfieldCardURL(card.name)),button('Browse printings',()=>browsePrintings(view,card),'compact'));
 const actions=el('div',null,'edh-card-actions');addActions(view,card,actions);box.body.append(actions);
}
function addActions(view,card,container){
 const status=el('span',null,'hint');status.setAttribute('role','status');
 const choose=button('⋯',()=>chooseDeck(view,card),'edh-art-add edh-art-add-other');choose.title='Add to another deck';choose.setAttribute('aria-label','Add to another deck');
 const last=button('+',async()=>{
  last.disabled=true;last.setAttribute('aria-busy','true');status.textContent='Adding…';
  try{const deck=await globalThis.MoxDecks.current();if(!deck)throw new Error('Open a deck in this tab first.');const {result,fallback}=await addExplorerCard(view,card,deck.id);noteDeckChanged();status.textContent=`Added to ${result.deck.name}${fallback?' with Moxfield’s default printing':''}.`;last.textContent='✓';last.setAttribute('data-state','added');last.setAttribute('aria-label',`Added to ${result.deck.name}`);}
  catch(error){status.textContent=error.message;last.disabled=false;}
  finally{last.setAttribute('aria-busy','false');}
 });
 if(!globalThis.MoxDecks){choose.disabled=true;last.disabled=true;status.textContent='Reload the extension to connect deck actions.';}
 else globalThis.MoxDecks.current().then(deck=>{if(!deck){last.disabled=true;last.title='Open a deck in this tab first.';}else if(card.explorerInDeck){last.disabled=true;last.title='Already in this deck';last.textContent='\u2713';last.setAttribute('data-state','added');last.setAttribute('aria-label','Already in this deck');}else last.title=`Add to ${deck.name}`;}).catch(()=>{});
 last.classList.add('edh-art-add','edh-art-add-here');last.setAttribute('aria-label','Add to current deck');
 for(const action of [choose,last])action.addEventListener('click',event=>event.stopPropagation());
 const overlays=el('span',null,'edh-art-actions');overlays.append(last,choose);container.append(overlays,status);
}
async function chooseDeck(view,card){
 const box=dialog(view,`Add ${card.name} to deck`),status=el('p','Loading your decks…','hint');status.setAttribute('role','status');box.body.append(status);
 try{
  const {decks}=await globalThis.MoxDecks.list();if(!box.modal.isConnected)return;
  status.textContent=decks.length?'Add one card to the selected deck.':'No decks found in your Moxfield account.';if(!decks.length)return;
  const search=el('input');search.type='search';search.placeholder='Find a deck';search.setAttribute('aria-label','Find a deck');
  const select=el('select');select.size=8;select.setAttribute('aria-label','Destination deck');
  const fill=()=>{const term=search.value.toLowerCase();select.replaceChildren();for(const deck of decks.filter(d=>d.name.toLowerCase().includes(term))){const option=el('option',deck.name);option.value=deck.publicId;select.append(option);}};fill();search.oninput=fill;
  const board=el('select');board.setAttribute('aria-label','Destination board');for(const [value,label] of [['mainboard','Main deck'],['maybeboard','Considering'],['sideboard','Sideboard']]){const option=el('option',label);option.value=value;board.append(option);}
  const add=button('Add to selected deck',async()=>{
   if(!select.value){status.textContent='Select a deck first.';return;}
   add.disabled=true;search.disabled=true;select.disabled=true;board.disabled=true;status.textContent='Adding…';
   try{const {result,fallback}=await addExplorerCard(view,card,select.value,board.value);noteDeckChanged();status.textContent=`Added ${card.name} to ${result.deck.name}${fallback?' with Moxfield’s default printing':''}.`;add.textContent='Added';}
   catch(error){status.textContent=error.message;add.disabled=false;search.disabled=false;select.disabled=false;board.disabled=false;}
  });
  box.body.append(search,select,board,add);
 }catch(error){status.textContent=error.message;box.body.append(button('Retry',()=>{box.close();chooseDeck(view,card);}));}
}
const cardTypeSymbols={Creature:'⚔',Instant:'ϟ',Sorcery:'✦',Artifact:'⚙',Enchantment:'✧',Planeswalker:'◈',Battle:'⚑',Land:'▲'};
const isCardTypeTag=tag=>Object.keys(cardTypeSymbols).some(type=>new RegExp('^'+type+'s?$','i').test(tag.trim()));
function typeSymbols(card){
 const typeLine=String(card.type||card.type_line||'').split(' // ').map(face=>face.split(/—|\s-\s/)[0]).join(' '),tags=C?.tags(card)||[];
 return Object.entries(cardTypeSymbols).filter(([type])=>new RegExp('\\b'+type+'\\b','i').test(typeLine)||tags.some(tag=>new RegExp('^'+type+'s?$','i').test(tag.trim()))).map(([type,symbol])=>{
  const icon=el('span',symbol,'edh-card-type');icon.title=type;icon.setAttribute('aria-label',type);icon.tabIndex=0;return icon;
 });
}
function tile(view,card,mode='art'){
 const item=el('li',null,'edh-card '+(mode==='art'?'edh-card-art':'edh-card-row'));
 item.dataset.cardName=card.name;if(card.explorerInDeck)item.classList.add('edh-card-in-deck');
 const preview=button('',()=>{hideHover();inspect(view,card);},'edh-preview');preview.setAttribute('aria-label',`View art for ${card.name}`);preview.append(art(card,false,view));
 preview.addEventListener('mouseenter',()=>hoverArt(view,card,preview));preview.addEventListener('mouseleave',hideHover);preview.addEventListener('focus',()=>hoverArt(view,card,preview));preview.addEventListener('blur',hideHover);
 const details=el('div',null,'edh-card-details'),stats=el('div',null,'edh-card-stats');
 const typeIcons=typeSymbols(card);if(typeIcons.length){const typeRow=el('span',null,'edh-card-type-icons');typeRow.append(...typeIcons);stats.append(typeRow);}
 if(card.inclusion!==null&&card.inclusion!==undefined)stats.append(el('span',`${Number(card.inclusion.toFixed(1))}% inclusion`,'edh-stat-inclusion'));
 if(card.lift!==null&&card.lift!==undefined)stats.append(el('span',`${Number(card.lift.toFixed(2))}× lift`,'edh-stat-lift'));
 if(card.explorerInDeck)details.append(el('span',card.explorerAdded?'Added to deck':'In deck','edh-in-deck-label'));
 const nameLink=link(card.name,moxfieldCardURL(card.name));nameLink.title=card.name;details.append(nameLink,stats.childElementCount?stats:el('span',card.source==='scryfall'?'Scryfall search':'Statistics unavailable','hint'));
 if(card.duplicateCount>1)details.append(el('span',card.duplicateCount+' entries condensed','edh-printing-badge'));
 const cardTags=(C?.tags(card)||[]).filter(tag=>!isCardTypeTag(tag));if(cardTags.length)details.append(el('p',cardTags.slice(0,4).join(' · '),'edh-result-tags'));
 const visual=el('div',null,'edh-card-visual'),actions=el('div',null,'edh-card-actions'+(mode==='art'?' edh-card-art-actions-overlay':''));addActions(view,card,actions);visual.append(preview);if(mode==='art')visual.append(actions);else details.append(actions);item.append(visual,details);return item;
}
function reconcileExplorerTiles(list,cards,cache,make,signature,preserve=()=>false){
 const next=new Map();let index=0;
 for(const card of cards){const key=card.oracleId||card.name.trim().toLowerCase(),version=signature(card);let entry=cache.get(key);if(!entry||entry.version!==version&&!preserve(entry.node))entry={node:make(card),version};next.set(key,entry);if(list.children[index]!==entry.node)list.insertBefore(entry.node,list.children[index]||null);index++;}
 while(list.children.length>index)list.lastElementChild.remove();cache.clear();for(const [key,entry] of next)cache.set(key,entry);
}
function prioritizeVisibleCards(candidates,names){const order=new Map(names.map((name,index)=>[name,index]));return candidates.map((card,index)=>({card,index})).sort((a,b)=>(order.get(a.card.name)??Infinity)-(order.get(b.card.name)??Infinity)||a.index-b.index).map(entry=>entry.card);}
function printingTagOrder(rows,byFrequency){
 const counts=new Map();
 for(const printing of rows)for(const tag of new Set(C.printingTags(printing)))counts.set(tag,(counts.get(tag)||0)+1);
 return [...counts].sort(([a,ac],[b,bc])=>(byFrequency?bc-ac:0)||a.localeCompare(b,undefined,{sensitivity:'base',numeric:true}));
}
function printingTokenDescription(card){
 const names={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'},colors=Array.isArray(card.tokenColors)?card.tokenColors.map(color=>names[color]||color).join('/')||'Colorless':'';
 const subtype=String(card.type||'').split(/\u2014| - /).slice(1).join(' - ').trim();
 return [colors,card.power!=null?card.power+'/'+(card.toughness??'?'):'',subtype,card.set&&card.collectorNumber?String(card.set).toUpperCase()+' #'+card.collectorNumber:''].filter(Boolean).join(' \u00b7 ');
}
function browsePrintings(view,card){
 const box=dialog(view,`Printings · ${card.name}`),tools=el('div',null,'edh-browser-tools'),search=el('input'),artTagSearch=el('input'),artTagList=el('div',null,'edh-art-tag-list'),artTagFilter=el('details',null,'edh-art-tag-picker'),sort=el('select'),order=el('select'),tag=el('details',null,'edh-printing-filters');let artSearchTimer=null,artTag='',availableArtTags=null,artTagsLoading=false;
 let tokenReference=null;let activeCard=card,deckCards=null,deckOrder=null,deckIndex=-1,selectedPrinting=null,printOnlySelection=null,deckId=null,deckLoading=null,selectionEpoch=0;
 box.modal.classList.add('edh-printings-dialog');search.type='search';search.placeholder='Search set, collector number, name, or tag';search.setAttribute('aria-label','Search printings');sort.setAttribute('aria-label','Sort loaded printings');tag.setAttribute('aria-label','Printing tag');
 order.setAttribute('aria-label','Deck list order');for(const [value,label] of [['deck','Deck order'],['name','Card name A–Z']]){const option=el('option',label);option.value=value;order.append(option);}
 for(const [value,label] of [['released','Newest first'],['oldest','Oldest first'],['secretLair','Secret Lair first'],['set','Set name'],['price','Price: low to high'],['tag','Tag']]){const option=el('option',label);option.value=value;sort.append(option);}
 const filterSummary=el('summary','Filter tags'),filterRows=el('div',null,'edh-printing-filter-rows'),states=new Map(),tagButtons=new Map();
 const clearFilters=button('Clear tag filters',()=>{states.clear();render();},'compact');
 let tagsByFrequency=true;
 const tagOrder=button('Tags: Name A–Z',()=>{tagsByFrequency=!tagsByFrequency;tagOrder.textContent=tagsByFrequency?'Tags: Frequency':'Tags: Name A–Z';tagOrder.setAttribute('aria-pressed',String(tagsByFrequency));render();},'compact');
 tagOrder.classList.add('edh-tag-sort');
 tagOrder.setAttribute('aria-label','Sort tags by frequency instead of name');tagOrder.setAttribute('aria-pressed','true');tagOrder.title='Frequency counts how many loaded printings have each tag, before filters or artwork grouping.';
 tag.append(filterSummary,el('p','+ requires a tag; − hides it. Click again to clear. All included tags must match. Finish tags indicate available finishes.','hint'),tagOrder,filterRows,clearFilters);
 const condensed=el('input');condensed.type='checkbox';condensed.checked=true;const condensedLabel=el('label');condensedLabel.append(condensed,document.createTextNode(' Condense repeated artwork'));
 const moveCard=async(direction)=>{
  nextCard.disabled=true;previousCard.disabled=true;status.textContent=`Finding ${direction>0?'next':'previous'} deck card…`;
  try{
   await ensureDeckCards();
   if(!deckCards?.length)throw Error('Open a deck in this tab to move through its cards.');
   if(deckIndex<0){deckIndex=deckCards.findIndex(row=>row.name.toLocaleLowerCase()===activeCard.name.toLocaleLowerCase());if(deckIndex<0)deckIndex=direction>0?-1:0;}
   selectDeckCard((deckIndex+direction+deckCards.length)%deckCards.length);
  }catch(error){status.textContent=error.message;}
  finally{nextCard.disabled=false;previousCard.disabled=false;}
 };
 const previousCard=button('Previous card',()=>moveCard(-1),'compact');previousCard.setAttribute('aria-label','Go to the previous card in the current deck');
 const nextCard=button('Next card',()=>moveCard(1),'compact');nextCard.setAttribute('aria-label','Go to the next card in the current deck');
 const tokenNotice=el('span',"Change a token's real printing with Moxfield's selector. Use print-only artwork only when needed.",'hint edh-token-printing-note');tokenNotice.hidden=true;
 const status=el('p',null,'hint'),list=el('ul',null,'edh-cards edh-cards-grid'),more=button('Load more printings',()=>load(false),'compact');status.setAttribute('role','status');
 const layout=el('div',null,'edh-printings-layout'),resultsPane=el('section',null,'edh-printings-results'),deckPane=el('aside',null,'edh-printings-decklist'),deckPosition=el('p','Loading deck order…','hint'),deckList=el('ol',null,'edh-printings-deck-rows');
 deckPane.append(el('h3','Deck order'),deckPosition,order,deckList);resultsPane.append(tools,status,list,more,el('p','Choose an edition to update a deck card. For tokens or unavailable editions, use Use for Print to save the exact artwork for proxy printing.','hint'));layout.append(resultsPane,deckPane);
 const footer=el('div',null,'edh-printings-footer');footer.append(tokenNotice,previousCard,nextCard);
 const artTagSummary=el('summary','Filter by art tag'),artTagStatus=el('p','Expand to load valid Scryfall illustration tags.','hint');artTagSearch.type='search';artTagSearch.placeholder='Find a valid art tag';artTagSearch.setAttribute('aria-label','Find a valid Scryfall art tag');artTagFilter.setAttribute('aria-label','Filter by valid Scryfall art tags');artTagFilter.append(artTagSummary,artTagStatus,artTagSearch,artTagList);tools.append(search,sort,tag,condensedLabel,artTagFilter);box.body.append(layout);box.modal.append(footer);
 const originalPicker=button('Open original Moxfield selector',async()=>{
  originalPicker.disabled=true;
  try{if(!globalThis.MoxPrintingShortcuts?.openOriginal)throw Error('Reload LemField and refresh Moxfield to connect the original selector.');await globalThis.MoxPrintingShortcuts.openOriginal(activeCard,()=>box.close());}
  catch(error){status.textContent=error.message;}
  finally{originalPicker.disabled=false;}
 },'compact');originalPicker.title='Open Moxfield?s own printing selector. Cards absent from this page open in a new Moxfield tab.';tools.prepend(originalPicker);
 tools.append(el('p','Tip: hold Alt when using a native Printings action or Ctrl+Shift+click to bypass LemField.','hint'));
 const uploadInput=el('input');uploadInput.type='file';uploadInput.accept='image/png,image/jpeg,image/webp';uploadInput.hidden=true;
 const uploadStatus=el('span',null,'hint'),uploadButton=button('Upload print artwork',()=>uploadInput.click(),'compact');tools.append(uploadButton,uploadInput,uploadStatus);
 uploadInput.onchange=async()=>{const file=uploadInput.files?.[0];if(!file)return;uploadButton.disabled=true;const target={...activeCard};try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Choose PNG, JPEG or WebP smaller than 20 MB.');const deck=await globalThis.MoxDecks.preview();const matches=deck.cards.filter(row=>row.name===target.name&&(!target.section||row.section===target.section));if(matches.length!==1)throw Error('Open this card from its deck entry to upload artwork.');const card=matches[0],url=URL.createObjectURL(file);let data;try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=744;canvas.height=1039;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,744,1039);ctx.drawImage(image,0,0,744,1039);data=canvas.toDataURL('image/jpeg',.95);canvas.width=canvas.height=0;}finally{URL.revokeObjectURL(url);}const key='mrd_uploaded_art_v1:'+globalThis.MoxPrintPreferences.key(deck.id,card);await browser.storage.local.set({[key]:{card,url:data}});uploadStatus.textContent='Custom print artwork saved for '+card.name;applyDeckSavedPrintArt();}catch(error){uploadStatus.textContent=error.message;}finally{uploadButton.disabled=false;uploadInput.value='';}};
 let rows=[],page=0,total=null,hasMore=false,loading=false,epoch=0,error='';
 const isTokenPrinting=printing=>activeCard.isToken===true||printing?.layout==='token'||/\btoken\b/i.test(String(printing?.type||printing?.typeLine||''));
 const orderedCards=cards=>order.value==='name'?[...cards].sort((a,b)=>a.name.localeCompare(b.name)||a.section.localeCompare(b.section)):[...cards];
 async function ensureDeckCards(){
  if(deckCards)return deckCards;
  if(!deckLoading)deckLoading=(async()=>{const deck=await globalThis.MoxDecks?.preview();if(!deck)throw Error('Open a deck in this tab to browse its cards here.');deckId=deck.id;const identity=row=>row.id||`${row.name}|${row.set}|${row.collectorNumber}`;deckOrder=(deck.cards||[]).filter(row=>['mainboard','commanders','sideboard','maybeboard','tokens'].includes(row.section)).filter((row,index,all)=>all.findIndex(other=>other.section===row.section&&identity(other)===identity(row))===index);deckCards=orderedCards(deckOrder);return deckCards;})().catch(error=>{deckLoading=null;throw error;});
  return deckLoading;
 }
 function renderDeckList(){
  if(!deckCards){deckPosition.textContent=deckLoading?'Loading deck order…':'Open a deck to browse its cards here.';return;}
  deckPosition.textContent=deckIndex>=0?`Card ${deckIndex+1} of ${deckCards.length}`:`${deckCards.length} cards · select one to jump`;
  deckList.replaceChildren(...deckCards.map((row,index)=>{const jump=button(`${index+1}. ${row.qty>1?row.qty+'× ':''}${row.name}`);jump.classList.add('edh-deck-jump');jump.setAttribute('aria-current',String(index===deckIndex));jump.title=`Jump to ${row.name}`;if(row.section==='tokens'){const variant=printingTokenDescription(row);jump.append(el('small',variant,'edh-token-variant-label'));jump.title+=' - '+variant;}jump.addEventListener('mouseenter',()=>hoverArt(view,row,jump));jump.addEventListener('mouseleave',hideHover);jump.addEventListener('focus',()=>hoverArt(view,row,jump));jump.addEventListener('blur',hideHover);jump.onclick=()=>selectDeckCard(index);return el('li',null,index===deckIndex?'edh-deck-jump-current':'').appendChild(jump).parentElement;}));
 }
 function selectDeckCard(index){
  const row=deckCards?.[index];if(!row)return;selectionEpoch++;deckIndex=index;activeCard={...row,cardId:row.id,isToken:row.isToken===true};selectedPrinting={set:row.set,collectorNumber:row.collectorNumber};printOnlySelection=null;refreshPrintOnlySelection();
  nextCard.textContent=`Next card (${deckIndex+1}/${deckCards.length})`;previousCard.textContent=`Previous card (${deckIndex+1}/${deckCards.length})`;box.modal.querySelector('.edh-dialog-header h2').textContent=`Printings · ${activeCard.name}`;search.value='';states.clear();artTag='';availableArtTags=null;artTagFilter.open=false;artTagSummary.textContent='Filter by art tag';artTagList.replaceChildren();renderDeckList();load(true);
 }
 async function refreshPrintOnlySelection(){
  const token=selectionEpoch;if(!deckId)return;if(activeCard.isToken&&!activeCard.section)activeCard.section='tokens';if(!activeCard.section)return;
  try{const choices=await globalThis.MoxPrintPreferences.read(deckId),choice=choices.get(globalThis.MoxPrintPreferences.key(deckId,activeCard));if(token===selectionEpoch&&box.modal.isConnected){printOnlySelection=choice||null;render();}}catch{}
 }
 function render(){
  tokenNotice.hidden=activeCard.isToken!==true&&!rows.some(isTokenPrinting);
  const tagCounts=printingTagOrder(rows,tagsByFrequency).filter(([,count])=>count>0&&count<rows.length);
  for(const value of states.keys())if(!tagCounts.some(([tag])=>tag===value))states.delete(value);
  const availableTags=new Set(tagCounts.map(([value])=>value));
  for(const [value,buttons] of tagButtons)if(!availableTags.has(value)){buttons.row.remove();tagButtons.delete(value);}
  for(const [value] of tagCounts)if(!tagButtons.has(value)){
   const row=el('div',null,'edh-printing-filter-row'),include=button('+',()=>{states.get(value)==='include'?states.delete(value):states.set(value,'include');render();},'edh-filter-include'),exclude=button('−',()=>{states.get(value)==='exclude'?states.delete(value):states.set(value,'exclude');render();},'edh-filter-exclude');
   row.setAttribute('role','group');row.setAttribute('aria-label',value+' tag filter');include.setAttribute('aria-label','Include '+value);exclude.setAttribute('aria-label','Exclude '+value);row.append(el('span',value),include,exclude);filterRows.append(row);tagButtons.set(value,{row,include,exclude});
  }
  tagCounts.forEach(([value,count],index)=>{const row=tagButtons.get(value).row;row.querySelector('span').textContent=value+' ('+count+')';row.title=count+' loaded printing'+(count===1?'':'s');if(filterRows.children[index]!==row)filterRows.insertBefore(row,filterRows.children[index]||null);});
  for(const [value,buttons] of tagButtons){buttons.row.dataset.state=states.get(value)||'neutral';buttons.include.setAttribute('aria-pressed',String(states.get(value)==='include'));buttons.exclude.setAttribute('aria-pressed',String(states.get(value)==='exclude'));}
  filterSummary.textContent='Filter tags'+(states.size?' ('+states.size+')':'');clearFilters.disabled=!states.size;
  const includeTags=[...states].filter(([,mode])=>mode==='include').map(([value])=>value),excludeTags=[...states].filter(([,mode])=>mode==='exclude').map(([value])=>value);
  const filtered=C.printings(rows,{query:search.value,sort:sort.value,includeTags,excludeTags,condense:condensed.checked,tokenReference});
  const artKey=print=>print.illustrationId?(print.oracleId||print.name.toLowerCase())+'|'+print.illustrationId+'|'+print.printedName.toLowerCase()+'|'+(print.frameEffects||[]).join(','):print.id;
  const artCounts=new Map();for(const print of filtered){const id=artKey(print);artCounts.set(id,(artCounts.get(id)||0)+(print.variants?.length||1));}
  const mostPrintings=Math.max(0,...artCounts.values());
  list.replaceChildren(...filtered.map(print=>{
   const count=artCounts.get(artKey(print)),isMost=mostPrintings>1&&count===mostPrintings,variants=print.variants||[print],candidates=print.variants?.length?print.variants:filtered.filter(candidate=>artKey(candidate)===artKey(print)),used=!!selectedPrinting&&variants.some(variant=>String(variant.set||'').toLowerCase()===String(selectedPrinting.set||'').toLowerCase()&&String(variant.collectorNumber)===String(selectedPrinting.collectorNumber)),item=el('li',null,'edh-card edh-card-art'+(isMost?' edh-most-printings':'')+(used?' edh-used-printing':'')),preview=link('',moxfieldCardURL(print.printedName));preview.append(art(print));item.append(preview,link(print.printedName,moxfieldCardURL(print.printedName)),el('p',`${print.setName} · #${print.collectorNumber}`,'hint'));
   if(isMost)item.append(el('span',`Most printings · ${count}`,'edh-most-printings-badge'));
   if(used)item.append(el('span',`In deck · ${selectedPrinting.set} #${selectedPrinting.collectorNumber}`,'edh-used-printing-badge'));
   if(printOnlySelection&&!sameDeckPrinting(selectedPrinting||{},printOnlySelection)&&variants.some(variant=>variant.id===printOnlySelection.printingId))item.append(el('span',`Print artwork · ${printOnlySelection.set.toUpperCase()} #${printOnlySelection.collectorNumber}`,'edh-print-art-badge'));
   item.append(el('p',[print.releasedAt,print.price!==null?'$'+print.price.toFixed(2):'Price unavailable',...C.tags(print)].filter(Boolean).join(' · '),'edh-result-tags'));
   const actionSource=activeCard;actionSource.openOriginalSelector=()=>globalThis.MoxPrintingShortcuts.openOriginal(actionSource,()=>box.close());const updateSelection=(actual,result)=>{const previousId=actionSource.cardId,section=actionSource.section,sourceName=actionSource.name,updatedId=result?.cardId||previousId;for(const entries of [deckCards,deckOrder]){if(!entries)continue;const index=entries.findIndex(row=>(previousId&&row.id===previousId)||(!previousId&&row.name.toLocaleLowerCase()===sourceName.toLocaleLowerCase()&&(!section||row.section===section)));if(index>=0)entries[index]={...entries[index],id:updatedId,set:actual.set,collectorNumber:actual.collectorNumber,scryfallId:null,image:null,image_uris:null,card_faces:[]};}if(activeCard===actionSource||(activeCard.name.toLocaleLowerCase()===sourceName.toLocaleLowerCase()&&(!section||activeCard.section===section))){selectionEpoch++;activeCard={...actionSource,cardId:updatedId,set:actual.set,collectorNumber:actual.collectorNumber};selectedPrinting={set:actual.set,collectorNumber:actual.collectorNumber};renderDeckList();render();}};
   {const actions=el('div',null,'edh-card-actions');actions.append(usePrintingAction({...actionSource,isToken:isTokenPrinting(print)},print,candidates,updateSelection,choice=>{printOnlySelection=choice;render();}));item.append(actions);}
   if(print.variants?.length>1){const details=el('details',null,'edh-printing-variants'),summary=el('summary',`Show ${print.variants.length} printings with this artwork`);details.append(summary);
    for(const variant of print.variants){const row=el('div');if(selectedPrinting&&String(variant.set||'').toLowerCase()===String(selectedPrinting.set||'').toLowerCase()&&String(variant.collectorNumber)===String(selectedPrinting.collectorNumber)){row.classList.add('edh-used-printing-variant');row.append(el('strong','In deck · '));}if(printOnlySelection?.printingId===variant.id)row.append(el('strong','Print artwork · '));const editionLink=link(`${variant.setName} #${variant.collectorNumber}${variant.price!==null?' · $'+variant.price.toFixed(2):''}`,variant.url);row.append(editionLink);printingVariantPreview(view,variant,row);{const actions=el('div',null,'edh-card-actions');actions.append(usePrintingAction({...actionSource,isToken:isTokenPrinting(variant)},variant,print.variants,updateSelection,choice=>{printOnlySelection=choice;render();}));row.append(actions);}details.append(row);}item.append(details);
   }
   return item;
  }));
  status.textContent=error||`${loading?'Loading… ':''}${filtered.length} ${condensed.checked?'artwork groups':'printings'} shown · ${rows.length}${total!==null?' of '+total:''} printings loaded`;
  more.hidden=!hasMore&&!error;more.disabled=loading;more.textContent=error?'Retry loading printings':'Load more printings';cleanArt();
 }
 async function load(reset){
  if(loading&&!reset)return;
  if(reset){epoch++;rows=[];page=0;total=null;hasMore=false;tokenReference=null;}
  const token=epoch,next=page+1;loading=true;error='';render();
  try{
   if(activeCard.isToken===true&&!tokenReference){
    const source=activeCard,exact=source.scryfallId||null,edition=source.set&&source.collectorNumber?{set:source.set,collectorNumber:source.collectorNumber}:null;
    if(!exact&&!edition)throw Error('Open this token from its exact deck entry to identify its variant.');
    const details=await requestCardDetails(source.name,exact,edition);
    if(!box.modal.isConnected||token!==epoch)return;
    if(!details?.ok||!details.details)throw Error('Could not verify this token variant. Use the original Moxfield selector or retry.');
    tokenReference=details.details;
   }
   const result=await browser.runtime.sendMessage({type:'mrd-card-printings',name:activeCard.name,isToken:activeCard.isToken===true,artTag,page:next});
   if(!box.modal.isConnected||token!==epoch)return;
   if(!result?.ok)throw Error(result?.error||'Could not load printings.');
   const unique=new Map(rows.map(row=>[row.id,row]));for(const row of result.cards||[])unique.set(row.id,row);rows=[...unique.values()];page=next;total=result.total;hasMore=result.hasMore;
  }catch(failure){if(token===epoch&&box.modal.isConnected)error=failure.message;}
  finally{if(token===epoch&&box.modal.isConnected){loading=false;render();}}
 }
 order.onchange=()=>{if(!deckOrder)return;const current=deckIndex>=0?deckCards[deckIndex]:activeCard;deckCards=orderedCards(deckOrder);deckIndex=current?.cardId?deckCards.findIndex(row=>row.id===current.cardId):deckCards.findIndex(row=>row.name.toLocaleLowerCase()===current?.name?.toLocaleLowerCase());if(deckIndex>=0){nextCard.textContent=`Next card (${deckIndex+1}/${deckCards.length})`;previousCard.textContent=`Previous card (${deckIndex+1}/${deckCards.length})`;}renderDeckList();};
 const openingEpoch=selectionEpoch;ensureDeckCards().then(cards=>{if(!box.modal.isConnected)return;if(selectionEpoch===openingEpoch){const index=activeCard.cardId?cards.findIndex(row=>row.id===activeCard.cardId):cards.filter(row=>row.name.toLocaleLowerCase()===activeCard.name.toLocaleLowerCase()).length===1?cards.findIndex(row=>row.name.toLocaleLowerCase()===activeCard.name.toLocaleLowerCase()):-1;if(index>=0){deckIndex=index;const row=cards[index],tokenChanged=activeCard.isToken!==(row.isToken===true);activeCard={...row,cardId:row.id,isToken:row.isToken===true};selectedPrinting={set:row.set,collectorNumber:row.collectorNumber};nextCard.textContent=`Next card (${deckIndex+1}/${deckCards.length})`;previousCard.textContent=`Previous card (${deckIndex+1}/${deckCards.length})`;render();if(tokenChanged)load(true);}}renderDeckList();refreshPrintOnlySelection();}).catch(()=>{deckPosition.textContent='Open a deck to browse its cards here.';renderDeckList();});
 function renderArtTagChoices(){
  if(!availableArtTags)return;const query=artTagSearch.value.trim().toLocaleLowerCase(),allMatches=availableArtTags.filter(value=>!query||value.label.toLocaleLowerCase().includes(query)),matches=allMatches.slice(0,80);
  artTagList.replaceChildren(...matches.map(tag=>{const value=tag.label,choice=button(value+' ('+tag.count+')',()=>{artTag=artTag===value?'':value;artTagSummary.textContent=artTag?`Art tag: ${artTag} · change`:'Filter by art tag';artTagFilter.dataset.selected=String(!!artTag);clearTimeout(artSearchTimer);artSearchTimer=setTimeout(()=>load(true),0);renderArtTagChoices();},'edh-art-tag-choice');choice.setAttribute('aria-pressed',String(artTag===value));return choice;}));
  if(!matches.length)artTagList.append(el('p','No valid art tags match that search.','hint'));
  else if(allMatches.length>matches.length)artTagList.append(el('p','Showing first 80 matches. Refine the search to find other tags.','hint'));
 }
 artTagFilter.addEventListener('toggle',async()=>{if(!artTagFilter.open||availableArtTags||artTagsLoading)return;artTagsLoading=true;artTagSearch.hidden=false;artTagStatus.textContent='Loading valid Scryfall art tags…';try{const result=await browser.runtime.sendMessage({type:'mrd-art-tag-names',illustrationIds:rows.map(print=>print.illustrationId).filter(Boolean)});if(!result?.ok)throw Error(result?.error||'Scryfall art tags are unavailable.');availableArtTags=result.tags;artTagStatus.textContent=`${availableArtTags.length.toLocaleString()} applicable illustration tags. Tags shared by every artwork are hidden.`;renderArtTagChoices();}catch(error){artTagStatus.textContent=error.message;artTagSearch.hidden=true;}finally{artTagsLoading=false;}});
 artTagSearch.oninput=renderArtTagChoices;for(const control of [sort,condensed])control.onchange=render;search.oninput=render;load(true);
}
function usePrintingAction(source,printing,alternatives=[],onSelected,onPrintOnly){
 const status=el('span',null,'hint');status.setAttribute('role','status');
 const printOnly=button('Use for Print',async()=>{
  printOnly.disabled=true;
  try{
   const deck=await globalThis.MoxDecks?.preview?.();
   if(!deck?.id)throw Error('Open a deck in this tab before choosing proxy artwork.');
   const candidates=(deck.cards||[]).filter(card=>card.qty>0&&card.name.trim().toLowerCase()===source.name.trim().toLowerCase()&&(!source.section||card.section===source.section)&&(!(source.cardId||source.id)||card.id===(source.cardId||source.id)));
   if(candidates.length>1&&candidates.some(card=>card.section==='tokens'))throw Error('Several token variants share this name. Open the exact token entry first.');
   if(!candidates.length&&(source.isToken===true||printing.layout==='token'||/\btoken\b/i.test(String(printing.type||''))))candidates.push({name:source.name,section:'tokens',qty:1,tokenSourceId:'print-only:'+(printing.oracleId||source.name.normalize('NFKC').toLowerCase()),standaloneToken:true});
   if(!candidates.length)throw Error('This card is not in the current deck.');
   if(new Set(candidates.map(card=>card.section)).size!==1)throw Error('Open printings from the card in the deck to identify its section.');
   const choice=await globalThis.MoxPrintPreferences.save(deck.id,candidates[0],printing);onPrintOnly?.(choice);
   printOnly.textContent='✓ Used for Print';status.textContent=`Saved ${printing.set} #${printing.collectorNumber} for proxy printing. Open Print to use it. The Moxfield deck is unchanged.`;
  }catch(error){status.textContent=error.message;printOnly.disabled=false;}
 },'edh-printing-apply');
 const tokenPrinting=source.isToken===true||/\btoken\b/i.test(String(printing.type||''));
 printOnly.hidden=!globalThis.MoxPrintPreferences;printOnly.title='Use this exact artwork in proxy exports without changing the Moxfield deck.';
 const apply=button('Use this printing',async()=>{
  apply.disabled=true;apply.setAttribute('aria-busy','true');status.textContent='Updating printing…';
  try{
   const deadline=Date.now()+10000,seen=new Set(),candidates=[printing,...(tokenPrinting?[]:alternatives)].filter(candidate=>{const key=String(candidate.set||'').toLowerCase()+'|'+String(candidate.collectorNumber);if(seen.has(key))return false;seen.add(key);return true;});let result,applied=printing,lastError;
   for(let index=0;index<candidates.length;index++){
    if(Date.now()>=deadline)throw new Error('Printing update timed out after 10 seconds. No further artwork printings were tried. Close the menu to refresh and check the deck before retrying.');
    const candidate=candidates[index];try{result=await globalThis.MoxDecks.changePrinting(source,candidate,undefined,stage=>{status.textContent=index?`Trying another printing of this artwork… ${stage}...`:stage+"...";},deadline);applied=candidate;break;}
    catch(error){lastError=error;if(!/could not be matched on Moxfield/i.test(error.message)||index===candidates.length-1)throw error;status.textContent=`${candidate.set} #${candidate.collectorNumber} could not be matched; trying another printing of this artwork…`;}
   }
   if(!result)throw lastError||new Error('No matching printing was found on Moxfield.');
   if(!result.alreadySelected)noteDeckChanged(true);const actual=result.printing||{set:applied.set,collectorNumber:applied.collectorNumber};const changedCandidate=String(actual.set).toLowerCase()!==String(printing.set).toLowerCase()||String(actual.collectorNumber)!==String(printing.collectorNumber);
   status.textContent=changedCandidate?`The requested printing was unavailable; used ${actual.set} #${actual.collectorNumber} from the same artwork.`:result.alreadySelected?'This printing is already selected.':`Updated ${result.quantity} ${result.quantity===1?'copy':'copies'} in ${result.deck.name}.`;apply.textContent=result.alreadySelected?'Selected':'✓ Selected';apply.setAttribute('data-state','added');onSelected?.(actual,result);
  }
  catch(error){status.textContent=error.message;printOnly.hidden=!globalThis.MoxPrintPreferences;if(/HTTP 400/i.test(error.message))status.textContent+=' You can use this edition for print instead. Existing Print artworkwork is retained until you explicitly replace it.';if(/may be incomplete|result unknown|timed out|did not respond/i.test(error.message))noteDeckChanged(true);if(/could not be matched on Moxfield/i.test(error.message)){apply.disabled=true;apply.textContent='Unavailable on Moxfield';apply.setAttribute('data-state','unavailable');apply.title='Moxfield could not match this exact printing; it cannot be applied.';printOnly.hidden=!globalThis.MoxPrintPreferences;}else apply.disabled=false;}
  finally{apply.setAttribute('aria-busy','false');}
 });
 if(tokenPrinting)printOnly.textContent='Use print-only artwork';
 apply.hidden=false;apply.classList.add('edh-printing-apply');apply.setAttribute('aria-label',`Use ${printing.setName} ${printing.collectorNumber} in the current deck`);
 const wrap=el('span',null,'edh-printing-selection');wrap.append(apply,printOnly,status);return wrap;
}
// Native shortcuts use a persistent host, independent of transient card previews.
globalThis.MoxPrintings={async open(card){
 // Resolve the source entry before loading token variants. Never replace an intercepted
 // gesture with a synthetic native click: native token gestures bypass interception.
 try{const deck=await globalThis.MoxDecks?.preview?.(),matches=(deck?.cards||[]).filter(row=>row.name?.toLowerCase()===card.name?.toLowerCase()&&(!card.cardId||row.id===card.cardId));
  if(matches.length===1)card={...matches[0],...card,cardId:matches[0].id};
 }catch{}
 let host=document.querySelector('[data-mrd-printings-host]');
 if(!host){host=el('div');host.setAttribute('data-mrd-printings-host','');host.setAttribute('data-mrd-owned','');const shadow=host.attachShadow({mode:'open'}),css=el('link');css.rel='stylesheet';css.href=globalThis.MoxDashboardStyleURL;shadow.append(css);document.body.append(host);}
 const existing=dialogHost().shadowRoot.querySelector('dialog[open]');
 if(existing){existing.focus();return;}
 browsePrintings({host},card);
}};
function hasTopCardCategory(data){
 return (data.categories||[]).some(category=>/^topcards$/i.test(category.id))&&E.browse(data,{category:'top'}).length>0;
}
function explorerUsesCommanderScope(data,commanders,category){
 return category!=='similar'&&data.kind==='commanders'&&commanders.length===1&&E.slug(data.name)===E.slug(commanders[0].name);
}
async function fillRequirementMatches({candidates,hasDetails,attempted,load,count,isCurrent,onProgress,onBatch,target=20}){
 let checked=0;
 for(let offset=0;offset<candidates.length;offset+=48){
  for(const card of candidates.slice(offset,offset+48)){
   if(!isCurrent()||count()>=target)return {checked,matches:count(),cancelled:!isCurrent()};
   if(hasDetails(card)||attempted.has(card.name))continue;
   attempted.add(card.name);await load(card);checked++;
   if(!isCurrent())return {checked,matches:count(),cancelled:true};
   onProgress?.(checked,count());
  }
  onBatch?.();
 }
 return {checked,matches:count(),cancelled:!isCurrent()};
}
function exclusiveExplorerMenus(controls){
 const menus=[...controls.querySelectorAll('details')],group='lemfield-explorer-'+crypto.randomUUID();
 for(const menu of menus)menu.setAttribute('name',group);
 const closeOthers=event=>{const active=event.target.closest('details');for(const menu of menus)if(menu!==active&&menu.open)menu.open=false;};
 for(const event of ['pointerdown','focusin','click'])controls.addEventListener(event,closeOthers);
}
function explorerMembership(card,deckNames,added){
 const names=[card,...(card.variants||[])].map(row=>String(row.name||'').trim().toLowerCase());
 return {inDeck:names.some(name=>deckNames.has(name)||added.has(name)),added:names.some(name=>added.has(name))};
}
function advanced(view,data){
 if(featurePrefs?.mrd_features?.explorer===false)return;
 const existing=dialogHost().shadowRoot.querySelector('.edh-browser-layout')?.closest('dialog');if(existing?.open){existing.focus();return;}
 view={...view};
 const box=dialog(view,`Card Explorer · ${data.name}`),controls=el('div',null,'edh-browser-tools'),categories=el('select'),sort=el('select'),search=el('input'),searchMode=el('select'),display=el('select'),artChoice=el('select'),addPrinting=el('input');
 box.modal.classList.add('edh-plus-dialog');
 const attribution=el('footer',null,'edh-explorer-attribution');attribution.append(document.createTextNode('Powered by '),link('EDHREC','https://edhrec.com'),document.createTextNode(' and '),link('Scryfall','https://scryfall.com'));box.modal.append(attribution);
 categories.setAttribute('aria-label','Card category');sort.setAttribute('aria-label','Sort cards');display.setAttribute('aria-label','Card display');
 const options=(select,rows)=>{for(const [value,label] of rows){const option=el('option',label);option.value=value;select.append(option);}};
 const hasTop=hasTopCardCategory(data),edhrecNames=new Set((data.allCards||[]).map(card=>card.name.trim().toLowerCase()));
 options(categories,[...(hasTop?[['top','Top cards']]:[]),['lift','High lift cards'],['all','All cards'],...(data.categories||[]).filter(c=>!/^topcards$/i.test(c.id)).map(c=>[c.id,c.name]),['similar','Similar cards']]);
 if(!(data.categories||[]).some(category=>/^topcards$/i.test(category.id))||!E.browse(data,{category:'top'}).length)categories.value='all';
 options(sort,[['inclusion','Inclusion'],['lift','Lift'],['numDecks','Deck count'],['name','Name'],['synergy','Synergy'],['manaValue','Mana value: low to high'],['price','Price: low to high'],['tag','Tag']]);options(display,[['art','Card art'],['list','Compact list']]);
 options(artChoice,[['most','Most reprinted artwork'],['cheapest','Cheapest printing'],['oldest','Oldest printing'],['newest','Newest printing']]);artChoice.setAttribute('aria-label','Artwork printing');artChoice.title='Most reprinted artwork counts English Scryfall printings that share an illustration. It does not measure deck usage.';
 addPrinting.type='checkbox';addPrinting.checked=true;const addPrintingLabel=el('label');addPrintingLabel.append(addPrinting,document.createTextNode(' Use displayed printing when adding'));
 view.explorerArtMode=artChoice.value;view.useExplorerPrinting=true;
 options(searchMode,[['text','Text search (loaded)'],['scryfall','Scryfall query']]);searchMode.setAttribute('aria-label','Search mode');searchMode.title='Text search filters loaded cards; Scryfall query discovers cards beyond the loaded list.';
 search.type='search';search.placeholder='Search names, rules, types, or tags';search.setAttribute('aria-label','Search cards');
 const exclude=el('input');exclude.type='checkbox';exclude.checked=true;
 const excludeLabel=el('label');excludeLabel.append(exclude,document.createTextNode(' Hide cards already in deck'));
 const type=el('select'),typeLine=el('input'),role=el('select'),roleSearch=el('input'),tokenKind=el('input'),tagSearch=el('input'),tag=el('select'),minMana=el('input'),maxMana=el('input'),maxPrice=el('input'),color=el('input');
 type.setAttribute('aria-label','Card type filter');role.setAttribute('aria-label','Card role');tag.setAttribute('aria-label','Card tag filter');
 typeLine.type='search';typeLine.placeholder='Type line or subtype (Goblin, Warrior…)';typeLine.setAttribute('aria-label','Type line or creature subtype');
 tagSearch.type='search';tagSearch.placeholder='Search card tags';tagSearch.setAttribute('aria-label','Find card tags');tagSearch.title='Search tags available on loaded cards';
 options(type,[['','All card types'],...['Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Battle','Land'].map(t=>[t,t])]);
 options(role,[['','Card role'],...(globalThis.MoxRules?.presetLibrary||[]).map(r=>[r.id,r.name])]);options(tag,[['','All card tags']]);
 roleSearch.type='search';roleSearch.placeholder='Search card roles';roleSearch.setAttribute('aria-label','Find a card role');
 const roleChoices=[...role.options].map(option=>[option.value,option.textContent]);
 const updateRoleOptions=()=>{const selected=role.value,term=roleSearch.value.trim().toLowerCase(),choices=[...roleChoices,...[...deckRequirementRules].map(([value,rule])=>[value,'Deck: '+rule.name])];role.replaceChildren();options(role,choices.filter(([value,label])=>!value||value===selected||label.toLowerCase().includes(term)));role.value=selected;rolePicker.sync();};
 const selectMenu=(select,find,label)=>{
  const menu=el('details',null,'edh-trigger-filter edh-select-filter'),summary=el('summary',label),choices=el('div',null,'edh-trigger-choices'),empty=el('p','No other matching options','hint');
  select.size=6;find.className='edh-facet-search';find.title='Search menu options; choose an option to filter cards';empty.setAttribute('role','status');empty.hidden=true;
  const sync=()=>{summary.textContent=select.value?label+': '+(select.selectedOptions[0]?.textContent||select.value):label;summary.title=summary.textContent;empty.hidden=[...select.options].some(option=>option.value&&option.value!==select.value);};
  choices.append(find,select,empty);menu.append(summary,choices);menu.addEventListener('toggle',()=>{if(menu.open)find.focus();});menu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();menu.open=false;summary.focus();event.stopPropagation();}});select.addEventListener('change',()=>{sync();menu.open=false;summary.focus();});return {menu,sync};
 };
 const rolePicker=selectMenu(role,roleSearch,'Card role'),tagPicker=selectMenu(tag,tagSearch,'Card tags');
 const tokenKinds=el('datalist');tokenKinds.id='edh-token-kinds-'+crypto.randomUUID();
 options(tokenKinds,['Treasure','Food','Clue','Blood','Map','Powerstone','Gold','Incubator','Soldier','Zombie','Goblin','Elf Warrior','Spirit','Human','Saproling','Squirrel','Beast','Cat','Dog','Dragon','Angel','Bird','Servo','Thopter','Construct','Golem','Eldrazi Spawn','Eldrazi Scion','Copy'].map(value=>[value,value]));
 tokenKind.type='search';tokenKind.maxLength=60;tokenKind.placeholder='Any token kind';tokenKind.setAttribute('aria-label','Token kind');tokenKind.setAttribute('list',tokenKinds.id);tokenKind.hidden=true;
 const tokenRoleSelected=()=>role.value==='token-makers'||deckRequirementRules.get(role.value)?.presetId==='token-makers'||deckRequirementRules.get(role.value)?.id==='token-makers';
 const syncTokenKind=()=>{const enabled=tokenRoleSelected();tokenKind.hidden=!enabled;tokenKind.disabled=!enabled;if(!enabled)tokenKind.value='';};
 const selectedTokenKind=()=>tokenRoleSelected()?tokenKind.value.trim():'';
 const triggerMenu=el('details',null,'edh-trigger-filter'),triggerSummary=el('summary','Triggers'),triggerChoices=el('div',null,'edh-trigger-choices'),triggerSearch=el('input'),selectedTriggers=new Set();
 triggerSearch.type='search';triggerSearch.placeholder='Find a trigger';triggerSearch.setAttribute('aria-label','Find a trigger');triggerSearch.className='edh-facet-search';triggerChoices.append(triggerSearch);
 const triggerNames=[['death','Death'],['attack','Attack'],['block','Block'],['enter','Enter battlefield'],['leave','Leave battlefield'],['cast','Cast spell'],['combat','Combat damage'],['upkeep','Upkeep'],['end','End step'],['draw','Draw card'],['discard','Discard'],['sacrifice','Sacrifice'],['tap','Tap'],['untap','Untap'],['plus-one-counters','+1/+1 counters added'],['counters-added','Any counters added'],['counters-removed','Counters removed'],['lifegain','Gain life'],['lifeloss','Lose life'],['landfall','Land enters (landfall)'],['token-create','Create tokens'],['damage','Deal damage'],['scry','Scry'],['surveil','Surveil'],['mill','Mill'],['proliferate','Proliferate']];
 const triggerInputs=[];for(const [value,label] of triggerNames){const input=el('input');input.type='checkbox';input.value=value;const row=el('label');row.append(input,document.createTextNode(' '+label));triggerChoices.append(row);triggerInputs.push(input);}
 const filterTriggerChoices=()=>{const term=triggerSearch.value.trim().toLowerCase();for(const input of triggerInputs)input.parentElement.hidden=!!term&&!input.parentElement.textContent.toLowerCase().includes(term)&&!input.checked;};triggerSearch.oninput=filterTriggerChoices;
 const updateTriggerSummary=()=>{const chosen=triggerNames.filter(([value])=>selectedTriggers.has(value)).map(([,label])=>label);triggerSummary.textContent=chosen.length?'Triggers: '+chosen.join(', '):'Triggers';triggerSummary.title=chosen.length?'Match every selected trigger':'Filter by triggered ability';};updateTriggerSummary();triggerMenu.append(triggerSummary,triggerChoices);
 const keywordMenu=el('details',null,'edh-trigger-filter'),keywordSummary=el('summary','Keywords'),keywordChoices=el('div',null,'edh-trigger-choices'),keywordSearch=el('input'),selectedKeywords=new Set();
 keywordSearch.type='search';keywordSearch.placeholder='Find a keyword';keywordSearch.setAttribute('aria-label','Find a keyword');keywordSearch.className='edh-facet-search';keywordChoices.append(keywordSearch);
 const commonKeywords=['Flying','Trample','Haste','Vigilance','Deathtouch','Lifelink','First strike','Double strike','Menace','Reach','Hexproof','Indestructible','Flash','Defender','Ward','Prowess','Cascade','Kicker','Cycling','Protection'];
 const keywordLabels=new Map(commonKeywords.map(value=>[value.toLowerCase(),value]));
 const updateKeywordSummary=()=>{const chosen=[...selectedKeywords].map(value=>keywordLabels.get(value)||value);keywordSummary.textContent=chosen.length?'Keywords: '+chosen.join(', '):'Keywords';keywordSummary.title=chosen.length?'Match every selected keyword':'Filter by keyword ability';};updateKeywordSummary();keywordMenu.append(keywordSummary,keywordChoices);
 const keywordInputs=new Map();const filterKeywordChoices=()=>{const term=keywordSearch.value.trim().toLowerCase();for(const input of keywordInputs.values())input.parentElement.hidden=!!term&&!input.parentElement.textContent.toLowerCase().includes(term)&&!input.checked;};keywordSearch.oninput=filterKeywordChoices;
 const updateKeywordOptions=candidates=>{for(const card of candidates)if(Array.isArray(card.keywords))for(const keyword of card.keywords)if(typeof keyword==='string'&&keyword.trim()&&!keywordLabels.has(keyword.trim().toLowerCase()))keywordLabels.set(keyword.trim().toLowerCase(),keyword.trim());for(const [value,label] of [...keywordLabels].sort((a,b)=>a[1].localeCompare(b[1]))){if(keywordInputs.has(value)){keywordInputs.get(value).checked=selectedKeywords.has(value);continue;}const input=el('input');input.type='checkbox';input.value=value;input.checked=selectedKeywords.has(value);keywordInputs.set(value,input);const row=el('label');row.dataset.keywordLabel=label.toLowerCase();row.append(input,document.createTextNode(' '+label));const following=[...keywordChoices.children].find(child=>child.dataset.keywordLabel&&child.dataset.keywordLabel.localeCompare(row.dataset.keywordLabel)>0);keywordChoices.insertBefore(row,following||null);input.onchange=()=>{if(input.checked)selectedKeywords.add(value);else selectedKeywords.delete(value);updateKeywordSummary();filterKeywordChoices();searchExhausted=false;requirementRun++;clearTimeout(searchTimer);limit=pageSize;render();if(categories.value==='all'&&(role.value||searchMode.value==='scryfall'))loadRequirementResults();};}filterKeywordChoices();};
 for(const [input,label] of [[minMana,'Minimum mana value'],[maxMana,'Maximum mana value'],[maxPrice,'Maximum price (USD)']]){input.type='number';input.min='0';input.step=input===maxPrice?'0.01':'1';input.placeholder=label;input.setAttribute('aria-label',label);}
 color.type='checkbox';color.disabled=true;const colorLabel=el('label',null,'edh-color-filter');colorLabel.append(color,document.createTextNode(' Within commander colors'));
 const detailStatus=el('p','Rules, triggers, keywords, type line, mana value, role, price, and color filters use loaded card details. Unknown values are excluded when those filters are active.','hint');detailStatus.setAttribute('role','status');
 const detailAttempts=new Set(),deckRequirementRules=new Map(),explorerDetails=new Map(),extraCards=new Map(),scryfallRows=new Map();let loadingDetails=false,deckColors=null,deckCommanders=[],detailTask=null,requirementRun=0,activeDeckId=null;
 const combinedData=()=>{const rows=new Map((data.allCards||[]).map(card=>[card.name.trim().toLowerCase(),card]));for(const [key,card] of extraCards)if(!rows.has(key))rows.set(key,card);return {...data,allCards:[...rows.values()]};};
 const mergeExtras=cards=>{for(const card of cards)extraCards.set(card.name.trim().toLowerCase(),card);};
 const hasDetails=card=>card.detailsLoaded===true||explorerDetails.has(card.name)||!!knownDetails(card.name);
 const explorerCard=card=>{const details=explorerDetails.get(card.name)||knownDetails(card.name);if(details)explorerDetails.set(card.name,details);return details?{...card,...details}:card;};
 async function loadDetailsBatch(){
  if(loadingDetails)return;loadingDetails=true;loadDetails.disabled=true;
  const candidates=E.browse(categories.value==='similar'?{allCards:similarRows||[]}:combinedData(),{category:categories.value==='similar'?'all':categories.value,sort:'name'});
  const viewport=box.body.getBoundingClientRect(),visibleNames=[...list.children].filter(item=>{const rect=item.getBoundingClientRect();return rect.bottom>viewport.top&&rect.top<viewport.bottom;}).map(item=>item.dataset.cardName),ordered=prioritizeVisibleCards(candidates,visibleNames);
  let pending=ordered.filter(card=>!hasDetails(card)&&!detailAttempts.has(card.name)).slice(0,48);
  if(!pending.length){for(const card of ordered)if(!hasDetails(card))detailAttempts.delete(card.name);pending=ordered.filter(card=>!hasDetails(card)).slice(0,48);}
  let failed=0;
  try{if(pending.length){for(const card of pending)detailAttempts.add(card.name);detailStatus.textContent='Loading '+pending.length+' card details...';
   const reply=await browser.runtime.sendMessage({type:'mrd-card-details-batch',names:pending.map(card=>card.name)});if(!reply?.ok)throw Error(reply?.error||'Card detail batch unavailable.');
   for(const result of reply.cards||[]){if(result.ok&&result.details){explorerDetails.set(result.name,result.details);if(cardDetails.size>=300)cardDetails.delete(cardDetails.keys().next().value);cardDetails.set(result.name,result.details);globalThis.MoxRoleSearch?.remember([{name:result.name,...result.details}]);}else failed++;}
  }}
  finally{loadingDetails=false;if(box.modal.isConnected){loadDetails.disabled=false;const loaded=candidates.filter(hasDetails).length;detailStatus.textContent=loaded+' / '+candidates.length+' cards have details loaded'+(failed?' - '+failed+' unavailable; click again to retry.':'. Click again to load the next batch.');render();}}
 }
 const loadDetails=button('Load card details (next 48)',()=>{if(loadingDetails)return;const task=loadDetailsBatch();detailTask=task;task.then(()=>{if(detailTask===task)detailTask=null;},error=>{if(detailTask===task)detailTask=null;detailStatus.textContent=error.message;});return task;},'compact');
 const detailControls=el('div',null,'edh-details-loader');
 box.modal.classList.add('edh-compact-status');detailControls.append(loadDetails,detailStatus);
 const primaryTools=el('div',null,'edh-explorer-primary'),displayTools=el('div',null,'edh-explorer-preferences'),filterTools=el('div',null,'edh-explorer-filters');
 primaryTools.append(categories,sort,searchMode,search,display);displayTools.append(artChoice,addPrintingLabel,excludeLabel);filterTools.append(type,typeLine,rolePicker.menu,tokenKind,tokenKinds,triggerMenu,keywordMenu,tagPicker.menu,minMana,maxMana,maxPrice,colorLabel);controls.append(primaryTools,displayTools,filterTools,detailControls);exclusiveExplorerMenus(controls);
 let pageSize=48,searchExhausted=false,searchTarget=0,searchTargetKey='',autoDiscoveryQueued=false,autoDiscoveryStopped=false;const count=el('p',null,'hint'),list=el('ul',null,'edh-cards'),more=button('Show more',()=>{limit+=pageSize;render();if(categories.value==='all'&&!searchExhausted)loadRequirementResults(Math.max(50,limit));});more.setAttribute('aria-expanded','false');count.setAttribute('role','status');
 const discoveryKey=()=>JSON.stringify([search.value,type.value,typeLine.value,role.value,selectedTokenKind(),tag.value,[...selectedTriggers],[...selectedKeywords],minMana.value,maxMana.value,maxPrice.value,color.checked,exclude.checked]);
 const categoryType=()=>{const category=(data.categories||[]).find(item=>item.id===categories.value),label=(category?.name||categories.value).toLowerCase();return {creatures:'Creature',instants:'Instant',sorceries:'Sorcery',artifacts:'Artifact',enchantments:'Enchantment',planeswalkers:'Planeswalker',lands:'Land'}[label]||null;};
 const searchMore=button('Find more on Scryfall',()=>{if(categories.value!=='all'){if(!type.value)type.value=categoryType()||'';categories.value='all';}const key=discoveryKey();if(key!==searchTargetKey){searchTarget=0;searchTargetKey=key;}searchExhausted=false;autoDiscoveryStopped=false;searchTarget+=50;limit=Math.max(limit,searchTarget);render();loadRequirementResults(searchTarget);},'compact');
 const layout=el('div',null,'edh-browser-layout'),results=el('div',null,'edh-browser-results'),deck=el('aside',null,'edh-deck-preview');deck.setAttribute('aria-label','Current deck preview');
 const conflictHint=el('p',null,'edh-filter-conflict-hint');conflictHint.setAttribute('role','status');conflictHint.hidden=true;
 results.append(edhrecReminderBanner(view),controls,conflictHint,count,searchMore,list,more,link('Open on EDHREC',data.url),el('p',null,'hint'));results.lastChild.append(link('Card images: Scryfall','https://scryfall.com'));layout.append(results,deck);box.body.append(layout);let limit=pageSize;
 let deckNames=new Set(),deckLoading=true;const addedThisSession=new Set();view.explorerSession={onAdded:null};
 let similarRows=null,similarLoading=false,similarError='',similarRetry=false;
 const similarDirect=link('Open similar cards on EDHREC','https://edhrec.com/cards/'+E.slug(data.name)+'/similar-cards'),retrySimilar=button('Retry similar cards',()=>{similarRows=null;similarError='';similarRetry=true;render();},'compact');
 similarDirect.hidden=true;retrySimilar.hidden=true;results.insertBefore(similarDirect,list);results.insertBefore(retrySimilar,list);
 const filterCandidates=(candidates,overrides={})=>{const filters={query:searchMode.value==='scryfall'?'':search.value,sort:categories.value==='lift'?'lift':sort.value,type:type.value,typeLine:typeLine.value,role:role.value,tokenKind:selectedTokenKind(),rule:deckRequirementRules.get(role.value),triggers:[...selectedTriggers],keywords:[...selectedKeywords],tag:tag.value,minMana:minMana.value,maxMana:maxMana.value,maxPrice:maxPrice.value,colors:!colorLabel.hidden&&color.checked?deckColors:null,condense:true,excludeBasics:true,exclude:exclude.checked,...overrides};return C.filter(candidates,filters).filter(card=>{const membership=explorerMembership(card,deckNames,addedThisSession);return !filters.exclude||!deckLoading&&(!membership.inDeck||membership.added);});};
 const facetQuery=()=>C.discoveryQuery({tokenKind:selectedTokenKind(),type:type.value,typeLine:typeLine.value,minMana:minMana.value,maxMana:maxMana.value,triggers:[...selectedTriggers],keywords:[...selectedKeywords]});
 const updateConflicts=(candidates,rows)=>{
  const fields=[[search,'query',searchMode.value==='text'&&!!search.value.trim(),{query:''}],[type,'type',!!type.value,{type:''}],[typeLine,'typeLine',!!typeLine.value.trim(),{typeLine:''}],[rolePicker.menu,'role',!!role.value,{role:'',rule:null}],[tokenKind,'tokenKind',!!selectedTokenKind(),{tokenKind:''}],[triggerMenu,'triggers',selectedTriggers.size>0,{triggers:[]}],[keywordMenu,'keywords',selectedKeywords.size>0,{keywords:[]}],[tagPicker.menu,'tag',!!tag.value,{tag:''}],[minMana,'minMana',minMana.value!=='',{minMana:''}],[maxMana,'maxMana',maxMana.value!=='',{maxMana:''}],[maxPrice,'maxPrice',maxPrice.value!=='',{maxPrice:''}],[color,'colors',color.checked&&!colorLabel.hidden&&!!deckColors,{colors:null}],[exclude,'deck',exclude.checked&&!deckLoading,{exclude:false}]];
  const conflicting=new Set(),min=minMana.value===''?null:Number(minMana.value),max=maxMana.value===''?null:Number(maxMana.value);
  if(min!==null&&max!==null&&min>max){conflicting.add(minMana);conflicting.add(maxMana);}
  if(!rows.length&&candidates.length&&!deckLoading&&!loadingDetails&&!similarLoading&&(searchExhausted||!(role.value||facetQuery()))&&!(searchMode.value==='scryfall'&&!search.value.trim()))for(const [control,,active,override] of fields){if(active&&filterCandidates(candidates,override).length)conflicting.add(control);}
  for(const [control] of fields){const bad=conflicting.has(control);control.classList.toggle('edh-filter-conflict',bad);if(bad)control.setAttribute('aria-invalid','true');else control.removeAttribute('aria-invalid');}
  conflictHint.hidden=!conflicting.size;conflictHint.textContent=conflicting.size?'Red filters conflict with each other or exclude every available card. Adjust one to see results.':'';
 };
 let availableTags=[];const tileCache=new Map();
 const updateTagOptions=()=>{const selected=tag.value,term=tagSearch.value.trim().toLowerCase(),matching=availableTags.filter(value=>value.toLowerCase().includes(term));tag.replaceChildren();options(tag,[['','All card tags'],...(selected&&!matching.includes(selected)?[[selected,selected+' (selected)']]:[]),...matching.map(value=>[value,value])]);tag.value=selected;if(tag.selectedIndex<0)tag.value='';tagPicker.sync();};
 const render=()=>{
  if(searchMode.value!=='scryfall'&&categories.value==='similar'&&similarRows===null&&!similarLoading){similarLoading=true;const retry=similarRetry;similarRetry=false;browser.runtime.sendMessage({type:'mrd-similar-edhrec',slug:E.slug(data.name),retry}).then(result=>{similarRows=result?.cards||[];similarError=result?.ok?'':result?.error||'Similar cards unavailable.';similarLoading=false;if(box.modal.isConnected)render();}).catch(()=>{similarRows=[];similarLoading=false;similarError='Similar cards unavailable.';if(box.modal.isConnected)render();});}
  view.edhrecAddContext={edhrecNames,searchMode:searchMode.value,filterScore:edhrecFilterScore({query:search.value,role:role.value,type:type.value,typeLine:typeLine.value,tag:tag.value,triggers:[...selectedTriggers],keywords:[...selectedKeywords],minMana:minMana.value,maxMana:maxMana.value,maxPrice:maxPrice.value})};
  refreshEdhrecBanners();syncTokenKind();rolePicker.sync();
  colorLabel.hidden=explorerUsesCommanderScope(data,deckCommanders,categories.value);
  const source=searchMode.value==='scryfall'?{allCards:[...scryfallRows.values()]}:categories.value==='similar'?{allCards:similarRows||[]}:combinedData();
  const candidates=E.browse(source,{category:searchMode.value==='scryfall'||categories.value==='similar'?'all':categories.value,sort:sort.value,query:''}).map(explorerCard);
  availableTags=[...new Set(candidates.flatMap(C.tags))].sort();updateTagOptions();updateKeywordOptions(candidates);
  const rows=filterCandidates(candidates);updateConflicts(candidates,rows);clearFilters.hidden=!(search.value||type.value||typeLine.value||role.value||selectedTriggers.size||selectedKeywords.size||tag.value||minMana.value!==''||maxMana.value!==''||maxPrice.value!==''||color.checked||roleSearch.value||tagSearch.value||triggerSearch.value||keywordSearch.value);
  const broadType=categoryType();if(categories.value!=='all'&&broadType&&(!type.value||type.value===broadType)&&rows.length<pageSize&&facetQuery()&&!deckLoading&&!loadingDetails&&!similarLoading&&!searchExhausted){type.value=broadType;categories.value='all';render();return;}
  deck._selectedRequirementId=role.value.startsWith('deck:')?role.value.slice(5):null;
  for(const control of deck.querySelectorAll('[data-requirement-id]'))control.setAttribute('aria-pressed',String(role.value==='deck:'+control.dataset.requirementId));
  if(categories.value==='top'&&!rows.length&&(!exclude.checked||!deckLoading)){categories.value='all';limit=pageSize;render();return;}
  list.classList.toggle('edh-cards-grid',display.value==='art');reconcileExplorerTiles(list,rows.slice(0,limit),tileCache,card=>{const membership=explorerMembership(card,deckNames,addedThisSession);return tile(view,{...card,explorerInDeck:membership.inDeck,explorerAdded:membership.added},display.value);},card=>JSON.stringify([explorerMembership(card,deckNames,addedThisSession),display.value,view.explorerArtMode,card.name,card.oracleId,card.image,card.images,card.type,card.oracle,card.manaCost,card.inclusion,card.lift,card.duplicateCount,C.tags(card),card.source,card.detailsLoaded]),node=>{const preview=hover||hoverPending;return !!preview&&node.contains(preview.anchor);});const activePreview=hover||hoverPending;if(activePreview&&list.contains(activePreview.anchor))activePreview.onClose=()=>{if(box.modal.isConnected)render();};else if(activePreview&&!activePreview.anchor.isConnected)hideHover();cleanArt();
  count.textContent=exclude.checked&&deckLoading?'Loading current deck...':searchMode.value==='scryfall'&&!search.value.trim()?'Enter a Scryfall query, such as t:Angel or o:"draw a card".':categories.value==='similar'&&similarLoading?'Loading similar cards...':categories.value==='similar'&&similarError?similarError:rows.length?Math.min(limit,rows.length)+' of '+rows.length+' cards':'No cards match. Try loading card details or relaxing the filters.';
  const currentKey=discoveryKey();if(currentKey!==searchTargetKey){searchTarget=0;searchTargetKey=currentKey;autoDiscoveryStopped=false;}
  if(categories.value==='all'&&searchMode.value==='text'&&rows.length<pageSize&&(role.value||facetQuery())&&!deckLoading&&!loadingDetails&&!similarLoading&&!searchExhausted&&!autoDiscoveryStopped&&!autoDiscoveryQueued&&globalThis.MoxRoleSearch){autoDiscoveryQueued=true;setTimeout(()=>{autoDiscoveryQueued=false;if(!box.modal.isConnected)return;if(currentKey!==discoveryKey()){render();return;}if(!loadingDetails&&!searchExhausted){searchTarget=Math.max(50,searchTarget+50);loadRequirementResults(searchTarget);}},0);}
  searchMore.hidden=searchMode.value==='scryfall'||!(type.value||typeLine.value.trim()||selectedTriggers.size||selectedKeywords.size||minMana.value!==''||maxMana.value!==''||role.value);searchMore.disabled=loadingDetails||deckLoading||searchExhausted;searchMore.textContent=loadingDetails?'Searching Scryfall...':searchExhausted?'No more Scryfall matches':'Find more on Scryfall';
  more.hidden=searchMode.value==='scryfall'&&!search.value.trim()||limit>=rows.length&&(categories.value!=='all'||searchExhausted);more.disabled=loadingDetails||deckLoading;more.textContent=loadingDetails?'Loading...':'Show more';more.setAttribute('aria-expanded',String(limit>pageSize));categories.disabled=searchMode.value==='scryfall';sort.disabled=categories.value==='lift';similarDirect.hidden=categories.value!=='similar';retrySimilar.hidden=categories.value!=='similar'||!similarError;
 };
 const clearFilters=button('Clear search filters',()=>{requirementRun++;searchExhausted=false;scryfallRows.clear();categories.value='all';search.value='';type.value='';typeLine.value='';role.value='';roleSearch.value='';tokenKind.value='';updateRoleOptions();selectedTriggers.clear();for(const input of triggerInputs)input.checked=false;triggerSearch.value='';filterTriggerChoices();updateTriggerSummary();selectedKeywords.clear();for(const input of keywordInputs.values())input.checked=false;keywordSearch.value='';filterKeywordChoices();updateKeywordSummary();tagSearch.value='';tag.value='';minMana.value='';maxMana.value='';maxPrice.value='';color.checked=false;pageSize=48;limit=pageSize;render();},'compact');clearFilters.hidden=true;results.insertBefore(clearFilters,list);
 let searchTimer=null;box.modal.addEventListener('close',()=>{requirementRun++;clearTimeout(searchTimer);delete view.edhrecAddContext;});
 async function loadRequirementResults(target=50){
  const run=++requirementRun,selectedRole=role.value,baseQuery=searchMode.value==='scryfall'?search.value.trim():'',filters=facetQuery(),queryOverride=baseQuery&&baseQuery.length+filters.length+1>500?baseQuery:[baseQuery,filters,'-t:basic'].filter(Boolean).join(' ');
  if(!globalThis.MoxRoleSearch)return;
  if(searchMode.value==='scryfall'&&!baseQuery)return;
  if(detailTask)try{await detailTask;}catch{}
  const isCurrent=()=>box.modal.isConnected&&run===requirementRun&&role.value===selectedRole&&(searchMode.value!=='scryfall'||search.value.trim()===baseQuery);
  if(!isCurrent()||deckLoading)return;
  const rule=selectedRole?(deckRequirementRules.get(selectedRole)||globalThis.MoxRules.asRule(selectedRole)):null;if(selectedRole&&!rule)return;
  loadingDetails=true;loadDetails.disabled=true;detailStatus.textContent='Searching beyond EDHREC for matching cards...';render();
  const task=globalThis.MoxRoleSearch.find({rule,queryOverride,commanders:colorLabel.hidden||color.checked?deckCommanders:[],excludeNames:exclude.checked?deckNames:new Set(),target,isCurrent,
   accept:card=>filterCandidates([card]).length>0,
   onPage:cards=>{if(!isCurrent())return;if(searchMode.value==='scryfall')for(const card of cards)scryfallRows.set(card.oracleId||card.name.trim().toLowerCase(),card);else mergeExtras(cards);render();detailStatus.textContent='Finding more matches; artwork loads only for displayed cards.';}});detailTask=task;
  try{
   const result=await task;
   if(isCurrent()){searchExhausted=result.exhausted;render();detailStatus.textContent=result.cards.length>=target?result.cards.length+' matching cards ready. Select Show more to continue.':result.exhausted?result.cards.length+' matches found across all available search results.':result.cards.length+' matches ready; search stopped before all results were checked.';}
  }catch(error){if(isCurrent()){autoDiscoveryStopped=true;detailStatus.textContent='Requirement search stopped: '+error.message;}}
  finally{if(detailTask===task){detailTask=null;loadingDetails=false;if(box.modal.isConnected){loadDetails.disabled=false;render();}}}
 }
 deck._onRequirementSearch=rule=>{
  searchExhausted=false;const key='deck:'+rule.id;
  if(role.value===key){requirementRun++;role.value='';pageSize=48;limit=pageSize;clearTimeout(searchTimer);detailStatus.textContent='Requirement filter cleared.';render();return;}
  if(!deckRequirementRules.has(key))options(role,[[key,'Deck: '+rule.name]]);
  deckRequirementRules.set(key,rule);roleSearch.value='';updateRoleOptions();role.value=key;categories.value='all';search.value='';type.value='';typeLine.value='';selectedTriggers.clear();for(const input of triggerInputs)input.checked=false;triggerSearch.value='';filterTriggerChoices();updateTriggerSummary();selectedKeywords.clear();keywordSearch.value='';filterKeywordChoices();updateKeywordSummary();tagSearch.value='';tag.value='';minMana.value='';maxMana.value='';maxPrice.value='';pageSize=20;limit=pageSize;clearTimeout(searchTimer);render();
  loadRequirementResults();
 };
 for(const control of [categories,exclude,type,role,tag,color,minMana,maxMana,maxPrice])control.onchange=()=>{searchExhausted=false;if(control===role&&role.value)categories.value='all';requirementRun++;clearTimeout(searchTimer);pageSize=role.value?20:48;limit=pageSize;render();if(categories.value==='all'&&(role.value||searchMode.value==='scryfall'))loadRequirementResults();};
 for(const input of triggerInputs)input.onchange=()=>{if(input.checked)selectedTriggers.add(input.value);else selectedTriggers.delete(input.value);updateTriggerSummary();filterTriggerChoices();searchExhausted=false;requirementRun++;clearTimeout(searchTimer);limit=pageSize;render();if(categories.value==='all'&&(role.value||searchMode.value==='scryfall'))loadRequirementResults();};
 sort.onchange=display.onchange=()=>render();
 tagSearch.oninput=()=>{updateTagOptions();clearFilters.hidden=false;};
 roleSearch.oninput=()=>{updateRoleOptions();clearFilters.hidden=false;};
 searchMode.onchange=()=>{requirementRun++;clearTimeout(searchTimer);searchExhausted=false;scryfallRows.clear();categories.value='all';search.value='';search.placeholder=searchMode.value==='scryfall'?'Scryfall: t:Angel o:"draw a card" mv<=3':'Search names, rules, types, or tags';pageSize=searchMode.value==='scryfall'?20:48;limit=pageSize;render();};
 artChoice.onchange=()=>{view.explorerArtMode=artChoice.value;render();};addPrinting.onchange=()=>{view.useExplorerPrinting=addPrinting.checked;};
 search.oninput=()=>{searchExhausted=false;requirementRun++;clearTimeout(searchTimer);if(searchMode.value==='scryfall')scryfallRows.clear();searchTimer=setTimeout(()=>{if(box.modal.isConnected){limit=pageSize;render();if(categories.value==='all'&&(role.value||searchMode.value==='scryfall'))loadRequirementResults();}},searchMode.value==='scryfall'?450:150);};
 tokenKind.oninput=()=>{searchExhausted=false;requirementRun++;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(box.modal.isConnected){limit=pageSize;render();if(categories.value==='all')loadRequirementResults();}},250);};
 typeLine.oninput=()=>{searchExhausted=false;requirementRun++;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(box.modal.isConnected){limit=pageSize;render();if(categories.value==='all'&&(role.value||searchMode.value==='scryfall'))loadRequirementResults();}},150);};
 const receivePrefetch=()=>{if(!box.modal.isConnected)return;mergeExtras(globalThis.MoxRoleSearch?.rowsForDeck(activeDeckId)||[]);render();};
 window.addEventListener('mrd-role-prefetch-ready',receivePrefetch);box.modal.addEventListener('close',()=>window.removeEventListener('mrd-role-prefetch-ready',receivePrefetch));
 view.explorerSession.onAdded=(card,destination)=>{if(!box.modal.isConnected||destination!==activeDeckId)return;const name=card.name.trim().toLowerCase();addedThisSession.add(name);deckNames.add(name);render();};
 deck._onDeckChange=value=>{searchExhausted=false;deckLoading=false;if(activeDeckId!==value?.id){extraCards.clear();addedThisSession.clear();}activeDeckId=value?.id;mergeExtras(globalThis.MoxRoleSearch?.rowsForDeck(activeDeckId)||[]);const commanders=(value?.cards||[]).filter(card=>card.section==='commanders'&&card.qty>0);deckCommanders=commanders;deckColors=commanders.length&&commanders.every(card=>card.colorIdentityKnown!==false&&typeof card.colors==='string')?[...new Set(commanders.flatMap(card=>card.colors.split('')))].join(''):null;color.disabled=deckColors===null;if(color.disabled)color.checked=false;deckNames=new Set((value?.cards||[]).filter(card=>card.qty>0).map(card=>card.name.trim().toLowerCase()));if(box.modal.isConnected){render();if(role.value||searchMode.value==='scryfall'&&search.value.trim())loadRequirementResults();}};
 deckPreviews.set(deck,view);deckPreview(view,deck);render();
}
async function deckPreview(view,aside,force=false){
 const token=(aside._generation||0)+1,previousScroll=aside.scrollTop||0,previousCardScroll=aside.querySelector('.edh-deck-list')?.scrollTop||0,previousRequirementsScroll=aside.querySelector('.edh-deck-requirement-list')?.scrollTop||0;aside._generation=token;
 if(!aside._hasPreview)aside.replaceChildren(el('h3','Current deck'),el('p','Loading deck…','hint'));else aside.setAttribute('aria-busy','true');
 try{
  const deck=await globalThis.MoxDecks?.preview?.(force);if(!aside.isConnected||token!==aside._generation)return;
  aside._onDeckChange?.(deck);
  aside.replaceChildren(el('h3','Current deck'));
  aside._hasPreview=true;if(!deck){aside.append(el('p','Open a deck in this tab to preview it here.','hint'));return;}
  if(aside._previewDeckId!==deck.id)aside._deckCardLimit=20;aside._previewDeckId=deck.id;
  const count=el('p',`Active cards: ${deck.activeCount}`,'edh-deck-count');count.setAttribute('aria-live','polite');
  const name=link(deck.name,`https://moxfield.com/decks/${deck.id}`),requirementBox=el('section',null,'edh-deck-requirements');requirementBox.append(el('h3','Deck requirements'),el('p','Loading profile…','hint'));
  const summary=el('div',null,'edh-deck-summary');summary.append(el('h3','Current deck'),name,count,el('p','Main deck + commanders','hint'),button('Refresh deck preview',()=>deckPreview(view,aside,true),'compact'));aside.replaceChildren(summary,requirementBox);
  requirementBox.setAttribute('aria-label','Deck requirements');
  browser.storage.local.get('mrd_settings').then(stored=>{
   if(!aside.isConnected||token!==aside._generation)return;
   try{
    const R=globalThis.MoxRules,settings=R.sanitizeSettings(stored?.mrd_settings),profileId=settings.perDeck?.[deck.id]||settings.selectedProfile,base=settings.profiles.find(item=>item.id===profileId)||settings.profiles[0],profile=settings.deckProfiles?.[deck.id]?.[base.id]||base,overrides=settings.deckManualOverrides?.[deck.id]??settings.manualOverrides,results=R.evaluate(deck.cards||[],profile.rules,settings.countSections,overrides,settings.tagOverrides);
    requirementBox.replaceChildren(el('h3','Deck requirements'),el('p',profile.name,'hint'));
    if(!results.length){requirementBox.append(el('p','No requirements in this profile.','hint'));return;}
    requirementBox.append(el('p','Select a requirement to find matching cards.','hint edh-requirement-instruction'));
    const requirements=el('ul',null,'edh-deck-requirement-list');requirements.tabIndex=0;requirements.setAttribute('aria-label','Scrollable deck requirements');
    for(const rule of results){const min=Number(rule.min)||0,max=rule.max===null||rule.max===undefined||rule.max===''?null:Number(rule.max),ok=rule.count>=min&&(max===null||rule.count<=max),over=max!==null&&rule.count>max,row=el('li',null,ok?'good':over?'over':'low');const searchRequirement=button(rule.name,()=>aside._onRequirementSearch?.(rule),'edh-deck-requirement-name');searchRequirement.dataset.requirementId=rule.id;searchRequirement.setAttribute('aria-pressed',String(aside._selectedRequirementId===rule.id));searchRequirement.setAttribute('aria-label','Search recommendations for '+rule.name);searchRequirement.title='Find cards matching '+rule.name;row.append(searchRequirement,el('span',`${rule.count} / ${min}${max===null?'':'–'+max}`,'edh-deck-requirement-count'));requirements.append(row);}
    requirementBox.append(requirements);requirements.scrollTop=previousRequirementsScroll;
   }catch{requirementBox.replaceChildren(el('h3','Deck requirements'),el('p','Requirements are unavailable.','hint'));}
  }).catch(()=>{if(aside.isConnected&&token===aside._generation)requirementBox.replaceChildren(el('h3','Deck requirements'),el('p','Requirements are unavailable.','hint'));});
  const cardsBox=el('section',null,'edh-deck-cards-box'),cardsHeading=el('h3','Deck cards');cardsBox.setAttribute('aria-label','Deck cards');cardsBox.append(cardsHeading);aside.append(cardsBox);
  const list=el('ul',null,'edh-deck-list'),rows=deck.cards.filter(card=>['mainboard','commanders'].includes(card.section)).sort((a,b)=>(a.section==='commanders'?-1:0)-(b.section==='commanders'?-1:0)||a.name.localeCompare(b.name));list.tabIndex=0;list.setAttribute('aria-label','Scrollable deck cards');let limit=aside._deckCardLimit||20;
  const render=()=>{const scrollTop=list.scrollTop;list.replaceChildren();for(const card of rows.slice(0,limit)){
   const row=el('li'),previewCard={...card,url:`https://edhrec.com/cards/${E.slug(card.name)}`},name=button(card.name,()=>inspect(view,previewCard),'edh-deck-card');
   name.addEventListener('mouseenter',()=>hoverArt(view,previewCard,name));name.addEventListener('mouseleave',hideHover);name.addEventListener('focus',()=>hoverArt(view,previewCard,name));name.addEventListener('blur',hideHover);
   row.append(el('span',`${card.qty}×`),name);if(card.section==='commanders')row.append(el('span','Commander','hint'));list.append(row);
  }list.scrollTop=scrollTop;cardsHeading.textContent='Deck cards ('+Math.min(limit,rows.length)+' of '+rows.length+')';};render();cardsBox.append(list);list.scrollTop=previousCardScroll;aside.scrollTop=previousScroll;
  if(rows.length>limit){const more=button('Show more deck cards',()=>{const firstNew=limit;limit+=20;aside._deckCardLimit=limit;render();more.hidden=limit>=rows.length;more.setAttribute('aria-expanded','true');const row=list.children[firstNew];if(row){list.scrollTop+=row.getBoundingClientRect().top-list.getBoundingClientRect().top;if(more.hidden)row.querySelector('button')?.focus({preventScroll:true});}});more.setAttribute('aria-expanded','false');cardsBox.append(more);}
 }catch(error){if(aside.isConnected&&token===aside._generation){aside._onDeckChange?.(null);aside._hasPreview=false;aside.replaceChildren(el('h3','Current deck'),el('p',error.message||'Deck preview unavailable.','hint'),button('Retry',()=>deckPreview(view,aside,true)));}}finally{if(token===aside._generation)aside.removeAttribute('aria-busy');}
}
async function contextStats(view,data){
 const box=view.contextBox;if(!box)return;
 const token=(view.contextGeneration||0)+1;view.contextGeneration=token;box.replaceChildren();
 const ready=()=>view.host.isConnected&&view.contextGeneration===token;
 try{
  const commander=await globalThis.MoxDecks?.commander?.();if(!ready())return;
  if(!commander){box.append(el('p','View a Commander deck to see inclusion with its commander.','hint'));return;}
  if(commander.names.some(name=>E.slug(name)===E.slug(view.name)))return;
  box.append(el('h3','With your current commander'),link(commander.name,`https://edhrec.com/commanders/${commander.slug}`),el('p',`From ${commander.deckName}`,'hint'));
  const stats=el('p','Loading commander inclusion…','hint');box.append(stats);
  const result=await browser.runtime.sendMessage({type:'mrd-read-edhrec',slug:commander.slug,kind:'commanders'});if(!ready())return;
  if(!result?.ok){stats.textContent=result?.error||'Commander inclusion unavailable.';return;}
  const row=E.commanderInclusion(result.data,view.name);
  if(!row){stats.textContent='Not listed in EDHREC’s published recommendations for this commander. Inclusion is unavailable.';return;}
  const parts=[];
  if(row.inclusion!==null)parts.push(`${Number(row.inclusion.toFixed(1))}% inclusion`);
  if(row.numDecks!==null)parts.push(row.potentialDecks!==null?`${row.numDecks.toLocaleString()} of ${row.potentialDecks.toLocaleString()} eligible decks`:`${row.numDecks.toLocaleString()} decks`);
  if(row.lift!==null)parts.push(`${Number(row.lift.toFixed(2))}× lift`);
  stats.textContent=parts.join(' · ')||'Inclusion unavailable for this commander.';
 }catch{if(ready())box.append(el('p','Commander inclusion unavailable.','hint'));}
}
function relatedSections(view,data){
 const commanders=data.popularCommanders||[];
 const synergies=(data.allCards||[]).filter(card=>Number.isFinite(card.synergy)&&card.synergy>0&&E.slug(card.name)!==E.slug(view.name)).sort((a,b)=>b.synergy-a.synergy||a.name.localeCompare(b.name));
 for(const [heading,rows,isCommander] of [['Popular commanders',commanders,true],['Synergistic cards',synergies,false]]){
  if(!rows.length&&!isCommander)continue;
  const section=el('section',null,'edh-page-section');section.append(el('h3',heading));view.body.append(section);
  if(!rows.length){section.append(el('p',isCommander?'No popular commanders published for this card.':'No synergy percentages published for this card.','hint'));continue;}
  if(!isCommander)section.append(el('p','Published synergy measures increased inclusion; it does not establish a combo.','hint'));
 const list=el('ul',null,'edh-cards edh-cards-grid edh-summary-grid');let count=4;
  const render=()=>{
   list.replaceChildren(...rows.slice(0,count).map(card=>{
    const item=tile(view,card,'art'),details=item.querySelector('.edh-card-details');let stats=item.querySelector('.edh-card-stats');
    if((isCommander&&card.numDecks!==null&&card.numDecks!==undefined)||Number.isFinite(card.synergy)){if(!stats){stats=el('div',null,'edh-card-stats');details.querySelector('.hint')?.remove();details.insertBefore(stats,details.children[1]||null);}}
    if(isCommander&&card.numDecks!==null&&card.numDecks!==undefined)stats?.append(el('span',card.numDecks.toLocaleString()+' decks','edh-stat-decks'));
    if(Number.isFinite(card.synergy))stats?.append(el('span',(card.synergy>=0?'+':'')+Number(card.synergy.toFixed(1))+'% synergy','edh-stat-lift'));
    return item;
   }));cleanArt();
  };
  section.append(list);render();
  if(rows.length>4){const more=button('Show more',()=>{count=count>=rows.length?4:Math.min(count+4,rows.length);render();more.textContent=count>=rows.length?'Show less':'Show more';more.setAttribute('aria-expanded',String(count>4));});more.setAttribute('aria-expanded','false');section.append(more);}
 }
}
function fallbackCardDetails(view,container){
 const section=el('section',null,'edh-fallback-details');section.append(el('h3','Card details'),el('p','Loading card details from Scryfall...','hint'));container.append(section);
 requestCardDetails(view.name).then(result=>{
  if(!section.isConnected)return;section.replaceChildren(el('h3','Card details (Scryfall)'));
  const details=result?.details;
  if(!details){section.append(el('p','Card details could not be loaded'+(result?.error?': '+result.error:'.')+' The direct EDHREC links remain available.','hint'));return;}
  if(details.type)section.append(el('p',details.type,'hint'));
  if(details.oracle)section.append(el('p',details.oracle,'edh-oracle-fallback'));
  const tags=C.tags(details);if(tags.length)section.append(el('p',tags.join(' / '),'hint'));
 });
}
function similarSection(view){
 const section=el('section',null,'edh-page-section edh-page-card-section');section.append(el('h3','Similar cards'));
 const status=el('p',null,'hint'),list=el('ul',null,'edh-cards edh-cards-grid edh-summary-grid');status.setAttribute('role','status');
 const direct=link('Similar cards on EDHREC','https://edhrec.com/cards/'+E.slug(view.name)+'/similar-cards');
 let rows=[],count=4,request=0;
 const render=()=>{hideHover();list.replaceChildren(...rows.slice(0,count).map(card=>{const item=tile(view,card,'art'),details=item.querySelector('.edh-card-details');let stats=item.querySelector('.edh-card-stats');if(card.numDecks!=null){if(!stats){stats=el('div',null,'edh-card-stats');details.querySelector('.hint')?.remove();details.insertBefore(stats,details.children[1]||null);}stats.append(el('span',card.numDecks.toLocaleString()+' decks','edh-stat-decks'));}else if(card.inclusion==null&&card.lift==null)details.querySelector('.hint')?.remove();return item;}));more.hidden=rows.length<=4;more.textContent=count>=rows.length?'Show less':'Show more';more.setAttribute('aria-expanded',String(count>4));cleanArt();};
 const more=button('Show more',()=>{count=count>=rows.length?4:Math.min(count+4,rows.length);render();});more.hidden=true;more.setAttribute('aria-expanded','false');
 const retry=button('Retry similar cards',()=>load(true),'compact');retry.hidden=true;
 section.append(status,direct,list,more,retry);view.body.append(section);
 async function load(force=false){
  const token=++request;retry.hidden=true;status.textContent='Loading similar cards...';
  try{const result=await browser.runtime.sendMessage({type:'mrd-similar-edhrec',slug:E.slug(view.name),retry:force});if(!section.isConnected||token!==request)return;
   rows=result?.ok?result.cards||[]:[];count=4;render();
   status.textContent=result?.ok?(rows.length?'':'No similar cards returned. Browse EDHREC directly.'):result?.error||'Similar-card data could not be loaded here.';retry.hidden=!!result?.ok;
  }catch{if(section.isConnected&&token===request){status.textContent='Similar-card data could not be loaded here. Browse EDHREC directly.';retry.hidden=false;}}
 }
 load();
}
function identify(scope,isPage){
 const heading=scope.querySelector(isPage?'h1':'[data-card-name],.modal-title,h1,h2,h3,h4,h5');
 const cardLink=[...scope.querySelectorAll('a[href*="/cards/"]')].find(a=>a.textContent.trim());
 const image=scope.querySelector('img[alt]');
 let name=(heading?.getAttribute('data-card-name')||heading?.textContent||cardLink?.textContent||image?.alt||'').trim();
 name=name.replace(/\s+\([A-Z0-9]{2,8}\)\s*#?\d+.*$/,'');
 if(!name||name.length>160||/^(card (details|preview)|preview|search|add cards?)$/i.test(name)){
  name=(cardLink?.textContent||image?.alt||'').trim();
 }
 if(!name||name.length>160||/^(loading|error|card (details|preview)|preview|search|settings|add cards?)(?:[.!\u2026]*)$/i.test(name)||!E.slug(name))return null;
 return {name,anchor:heading||cardLink||image,scope,isPage};
}
function legacyPrintingScope(node){
 const selector='[role="dialog"],.modal,.modal-content,.offcanvas.show';
 for(let scope=node?.closest?.(selector);scope;scope=scope.parentElement?.closest?.(selector)){
  if(scope.closest('[data-mrd-owned],.mrd-edhrec,.mrd-edh-launcher'))return null;
  const identity=[scope.getAttribute('aria-label'),scope.getAttribute('data-testid'),scope.className].filter(value=>typeof value==='string').join(' ');
  if(/printings?|edition[- ]?(?:picker|selector)|version[- ]?(?:picker|selector)/i.test(identity))return scope;
  const headings=[...scope.querySelectorAll('h1,h2,h3,h4,.modal-title,[role="heading"]')].filter(heading=>!heading.closest('.mrd-edhrec,.mrd-edh-launcher'));
  if(headings.some(heading=>/\b(?:printings?|editions?|versions?)\b/i.test(heading.textContent||'')))return scope;
  const images=[...scope.querySelectorAll('img[alt]')].filter(image=>!image.closest('.mrd-edhrec,.mrd-edh-launcher'));
  if(images.length>=3){const names=images.map(image=>String(image.alt||'').trim().toLowerCase()).filter(Boolean);if(names.length===images.length&&new Set(names).size===1)return scope;}
 }
 return null;
}
function target(){
 if(/^\/decks\//.test(location.pathname)){
  const previews=[...document.querySelectorAll('[role="dialog"],.modal-content,.offcanvas.show,[data-card-preview],[class*="cardPreview"],[class*="card-preview"]')].filter(visible);
  for(const scope of previews.reverse()){
   if(legacyPrintingScope(scope))continue;
   const explicit=scope.matches('[data-card-preview],[class*="cardPreview"],[class*="card-preview"]');
   if(!explicit&&!scope.querySelector('a[href*="/cards/"],[data-card-name],img[src*="/cards/"],img[src*="scryfall"],img[src*="card-images"]'))continue;
   const result=identify(scope,false);if(result)return result;
  }
 }
 if(/^\/cards\//.test(location.pathname))return identify(document.querySelector('main')||document.body,true);
 return null;
}
function draw(view,result){
 const panelBody=view.panelBody||view.body;panelBody.replaceChildren();view.panelBody=panelBody;const body=view.isPage?el('div',null,'edh-card-page-body'):panelBody;view.body=body;if(view.isPage)panelBody.append(body);
 body.append(el('p',edhrecReminder,'hint edh-deckbuilding-reminder'));
 view.data=null;
 if(!result){body.append(el('p','Loading EDHREC data…','hint'));return;}
 if(!result.ok){body.append(el('p',result.error||'EDHREC is unavailable.','hint'));const retry=el('button','Retry');retry.type='button';retry.onclick=()=>load(view,true);body.append(retry);fallbackCardDetails(view,body);similarSection(view);return;}
 const data=result.data;
 view.data=data;
 const browse=el('div',null,'edh-browse-actions');browse.classList.add('edh-page-actions');browse.append(link('Browse EDHREC',data.url));
 if(view.isPage){
  const toggleLabel=el('label',null,'edh-commander-toggle'),toggle=el('input'),toggleText=el('span','View recommendations as commander'),toggleStatus=el('span',view.commanderError||'','hint');toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.checked=view.commanderMode===true;toggleLabel.append(toggle,toggleText);
  const ensureCommanderData=async()=>{
   if(view.commanderData&&!view.commanderData.unavailable)return view.commanderData;
   const response=await browser.runtime.sendMessage({type:'mrd-read-edhrec',slug:E.slug(view.name),kind:'commanders',retry:true});
   if(!response?.ok)throw Error(response?.error||'Commander recommendations are unavailable.');
   if(response.data?.kind!=='commanders')throw Error('EDHREC has no commander recommendations for this card.');
   view.commanderData=response.data;return response.data;
  };
  toggle.onchange=async()=>{const enabled=toggle.checked;toggle.disabled=true;view.commanderError='';toggleStatus.textContent=enabled?'Loading commander recommendations…':'';
   if(!enabled){view.commanderMode=false;toggle.disabled=false;draw(view,{ok:true,data:view.data});return;}
   try{await ensureCommanderData();view.commanderMode=true;}
   catch(error){view.commanderMode=false;view.commanderError=error.message;toggle.checked=false;}
   if(view.host.isConnected)draw(view,{ok:true,data:view.data});
  };
  if(!view.commanderCapability)view.commanderCapability=requestCardDetails(view.name).then(result=>!!(result?.details&&canLeadCommander(result.details))).catch(()=>false);
  view.commanderCapability.then(async valid=>{
   if(!valid||!browse.isConnected)return;
   const plus=browse.querySelector('.edh-advanced');browse.insertBefore(toggleLabel,plus||null);browse.insertBefore(toggleStatus,plus||null);
   if(view.commanderMode===undefined){view.commanderMode=true;toggle.checked=true;toggle.disabled=true;toggleStatus.textContent='Loading commander recommendations…';
    try{await ensureCommanderData();view.commanderError='';}
    catch(error){view.commanderData={name:view.name,kind:'commanders',allCards:[],cards:[],categories:[],unavailable:true};view.commanderError=error.message;}
    if(view.host.isConnected)draw(view,{ok:true,data:view.data});
   }else toggle.checked=view.commanderMode===true;
  });
 }
 browse.append(button('Card Explorer',()=>advanced(view,data),'edh-advanced'));
 body.append(browse);
 const summary=el('div',null,'edh-page-summary');if(data.source==='html')summary.append(el('p','Statistics recovered from EDHREC; missing values are unavailable.','hint'));
 if(data.kind==='commanders')summary.append(el('p',`Commander rank: ${data.rank===null?'Unavailable':'#'+data.rank.toLocaleString()}`,'edh-page-stat'));
 else if(data.inclusion!==null&&data.inclusion!==undefined)summary.append(el('p',`${Number(data.inclusion.toFixed(1))}% overall inclusion${data.numDecks!==null?' · '+data.numDecks.toLocaleString()+' decks':''}`,'edh-page-stat'));
 else summary.append(el('p','Overall inclusion unavailable.','hint'));
 if(view.isPage&&data.kind!=='commanders'&&view.commanderData&&!view.commanderData.unavailable&&view.commanderData.rank!==null&&view.commanderData.rank!==undefined)summary.append(el('p',`Commander rank: #${Number(view.commanderData.rank).toLocaleString()}`,'edh-page-stat'));
 body.append(summary);
 const commanderTags=view.commanderMode&&view.commanderData&&!view.commanderData.unavailable?view.commanderData.tags||[]:[];
 const displayedTags=commanderTags.length?commanderTags:data.tags||[];
 if(displayedTags.length){
  const tagSection=el('section',null,'edh-page-section edh-page-tag-section');tagSection.append(el('h3','Popular tags'));
  const tags=el('div',null,'edh-tags');
  for(const tag of displayedTags){
  const badge=link('',tag.url),parts=String(tag.name).trim().match(/^(.*?)(\d[\d,.]*\s*[KMB])$/i)||String(tag.name).trim().match(/^(.*?[a-z)])(\d[\d,]*)$/i);
  const name=parts?parts[1].trim():tag.name,count=tag.count??parts?.[2];badge.append(el('span',name,'edh-tag-name'));
  if(count!==null&&count!==undefined)badge.append(document.createTextNode(' '),el('span',String(count).trim(),'edh-tag-count'));tags.append(badge);
  }
  tagSection.append(tags);body.append(tagSection);
 }
 view.contextBox=el('section',null,'edh-page-section edh-page-context');body.append(view.contextBox);contextStats(view,data);
 relatedSections(view,data);
 const recommendations=view.commanderMode&&view.commanderData?view.commanderData:data;
 for(const [category,title] of [['top','Top cards'],['lift','High lift cards'],['inclusion','High inclusion cards']]){
  if(category==='top'&&!hasTopCardCategory(recommendations))continue;
  const section=el('section',null,'edh-page-section edh-page-card-section'),rows=category==='inclusion'?E.browse(recommendations,{category:'all',sort:'inclusion'}).filter(card=>card.inclusion!==null&&card.inclusion!==undefined&&!/\bland\b/i.test(String(card.type||''))&&!C.tags(card).some(tag=>/^lands?$/i.test(tag.trim()))):E.browse(recommendations,{category});section.append(el('h3',title+(view.commanderMode?' as commander':'')));
  const list=el('ul',null,'edh-cards edh-cards-grid edh-summary-grid');let count=4;
  const render=()=>{hideHover();list.replaceChildren(...rows.slice(0,count).map(card=>tile(view,card,'art')));if(list.isConnected)cleanArt();};render();section.append(list);
  if(!rows.length)section.append(el('p',category==='lift'?'No lift-ranked cards available.':category==='inclusion'?'No inclusion data available.':'No top cards available.','hint'));
  if(rows.length>4){const more=button('Show more',()=>{count=count>=rows.length?4:Math.min(count+4,rows.length);render();more.textContent=count>=rows.length?'Show less':'Show more';more.setAttribute('aria-expanded',String(count>4));},'compact');more.setAttribute('aria-expanded','false');section.append(more);}body.append(section);
 }
 similarSection(view,data);newCardsSection(view,recommendations);cleanArt();
}
function newCardsSection(view,data){
 const category=data.categories?.find(item=>/new[\s_-]*cards/i.test(item.name||'')||/new[\s_-]*cards/i.test(item.id||'')),tagged=(data.allCards||[]).filter(card=>(card.tags||[]).some(tag=>/new[\s_-]*cards/i.test(tag))),categorized=category?E.browse(data,{category:category.id}):[],rows=categorized.length?categorized:tagged.sort((a,b)=>(b.inclusion??-Infinity)-(a.inclusion??-Infinity)||a.name.localeCompare(b.name)),section=el('section',null,'edh-page-section edh-page-card-section');section.append(el('h3','New cards'));
 if(!rows.length)section.append(el('p',`No new cards listed by EDHREC ${view.commanderMode?'for this commander.':'for this card.'}`,'hint'));
 else {const list=el('ul',null,'edh-cards edh-cards-grid edh-summary-grid');let count=4;const render=()=>{list.replaceChildren(...rows.slice(0,count).map(card=>tile(view,card,'art')));cleanArt();};render();section.append(list);
  if(rows.length>4){const more=button('Show more',()=>{count=count>=rows.length?4:Math.min(count+4,rows.length);render();more.textContent=count>=rows.length?'Show less':'Show more';more.setAttribute('aria-expanded',String(count>4));},'compact');more.setAttribute('aria-expanded','false');section.append(more);}
 }
 view.body.append(section);
}
async function load(view,retry=false){
 const token=++generation;draw(view,null);
 let result;
 try{result=await browser.runtime.sendMessage({type:'mrd-read-edhrec',slug:E.slug(view.name),kind:'cards',retry});}
 catch{result={ok:false,error:'Could not load EDHREC data. Please retry.'};}
 if(current===view&&token===generation&&view.host.isConnected)draw(view,result);
}
function update(){
 timer=null;injectLaunchers();cleanArt();const next=target();
 if(/^\/decks\//.test(location.pathname))applyDeckSavedPrintArt();
 if(current&&next&&current.name===next.name&&current.scope===next.scope&&current.host.isConnected){placePanel(current);return;}
 generation++;hideHover();current?.host.remove();current=null;cleanArt();
 if(!next?.anchor)return;
 const host=el('div');host.className='mrd-edhrec'+(next.isPage?' mrd-card-page':'');const shadow=host.attachShadow({mode:'open'});
 const css=el('link');css.rel='stylesheet';css.href=globalThis.MoxDashboardStyleURL;
 const panel=el('section',null,'panel edh-panel'+(next.isPage?' edh-card-page':''));panel.setAttribute('aria-label',`EDHREC information for ${next.name}`);
 const heading=el('h2','EDHREC'),body=el('div');body.setAttribute('aria-live','polite');
 const retract=button('Retract ↑',()=>{const expanded=retract.getAttribute('aria-expanded')==='true';body.hidden=expanded;retract.setAttribute('aria-expanded',String(!expanded));retract.textContent=expanded?'Expand ↓':'Retract ↑';retract.setAttribute('aria-label',expanded?'Expand EDHREC menu':'Retract EDHREC menu');},'edh-retract-link');retract.setAttribute('aria-expanded','true');retract.setAttribute('aria-label','Retract EDHREC menu');
 const panelHead=el('div',null,'edh-panel-header');panelHead.append(heading,retract);panel.append(panelHead,body);shadow.append(css,panel);
 // Keep the panel out of heading links and image wrappers.
 current={...next,host,body};placePanel(current);load(current);
}
let printArtRefresh=null;
function setNativePrintArt(image,choice,url){
 const picture=image.parentElement?.tagName==='PICTURE'?image.parentElement:null,parent=image.closest('.deckview-image-wrapper')||picture?.parentElement||image.parentElement,badge=parent?.querySelector('.mrd-print-art-badge');
 if(!choice){if(image.dataset.mrdPrintArtId){if(image.dataset.mrdOriginalStyle!==undefined){if(image.dataset.mrdOriginalStyle)image.setAttribute('style',image.dataset.mrdOriginalStyle);else image.removeAttribute('style');delete image.dataset.mrdOriginalStyle;}image.src=image.dataset.mrdOriginalSrc||image.src;image.srcset=image.dataset.mrdOriginalSrcset||'';image.title=image.dataset.mrdOriginalTitle||'';for(const source of picture?.querySelectorAll('source')||[]){source.srcset=source.dataset.mrdOriginalSrcset||'';delete source.dataset.mrdOriginalSrcset;}delete image.dataset.mrdPrintArtId;delete image.dataset.mrdOriginalSrc;delete image.dataset.mrdOriginalSrcset;delete image.dataset.mrdOriginalTitle;}badge?.remove();return;}
 if(image.dataset.mrdShowOriginal===choice.printingId)return;if(image.dataset.mrdShowOriginal)delete image.dataset.mrdShowOriginal;
 if(image.dataset.mrdPrintArtId!==choice.printingId||image.src!==url||image.srcset){if(image.dataset.mrdOriginalStyle!==undefined){if(image.dataset.mrdOriginalStyle)image.setAttribute('style',image.dataset.mrdOriginalStyle);else image.removeAttribute('style');delete image.dataset.mrdOriginalStyle;}if(!image.dataset.mrdOriginalSrc){image.dataset.mrdOriginalSrc=image.src;image.dataset.mrdOriginalSrcset=image.srcset||'';image.dataset.mrdOriginalTitle=image.title||'';for(const source of picture?.querySelectorAll('source')||[]){source.dataset.mrdOriginalSrcset=source.srcset||'';}}for(const source of picture?.querySelectorAll('source')||[])source.srcset='';image.srcset='';image.src=url;image.dataset.mrdPrintArtId=choice.printingId;image.dataset.mrdPrintArtName=image.alt;}
 const label='Print artwork';image.title=label;if(badge)return;
 if(parent){if(getComputedStyle(parent).position==='static')parent.style.position='relative';const marker=el('details',null,'mrd-print-art-badge'),summary=el('summary','Print art'),panel=el('div');
 Object.assign(marker.style,{position:'absolute',left:'5px',bottom:'5px',zIndex:'20',font:'500 11px/1.35 system-ui,sans-serif',color:'#fff',maxWidth:'calc(100% - 10px)'});Object.assign(summary.style,{cursor:'pointer',padding:'3px 6px',background:'#542e6be6',border:'1px solid #ba91d0',borderRadius:'4px',listStyle:'none',width:'max-content'});summary.setAttribute('aria-label','Print artwork options');
 Object.assign(panel.style,{position:'absolute',bottom:'100%',left:'0',width:'300px',maxWidth:'min(300px,85vw)',boxSizing:'border-box',padding:'9px',background:'#29232f',border:'1px solid #ba91d0',borderRadius:'5px',boxShadow:'0 3px 12px #0008'});panel.append(el('p','This artwork is used for printing only. Moxfield keeps a different printing.'));
 const original=button('Show original',event=>{event?.preventDefault?.();const show=!image.dataset.mrdShowOriginal;for(const target of parent.querySelectorAll('img'))if(target.dataset.mrdPrintArtId){if(show){target.dataset.mrdShowOriginal=target.dataset.mrdPrintArtId;target.src=target.dataset.mrdOriginalSrc||target.src;}else{delete target.dataset.mrdShowOriginal;target.src=url;}}original.textContent=show?'Show print artwork':'Show original';},'compact');
 const remove=button('Remove print artwork',async()=>{remove.disabled=true;try{const deck=await globalThis.MoxDecks.current();if(!deck?.id)throw Error('Open the deck first.');await globalThis.MoxPrintPreferences.clear(deck.id,choice);await browser.storage.local.remove('mrd_uploaded_art_v1:'+globalThis.MoxPrintPreferences.key(deck.id,choice));for(const target of parent.querySelectorAll('img')){delete target.dataset.mrdShowOriginal;if(target.dataset.mrdPrintArtId)setNativePrintArt(target,null);}marker.remove();schedule();}catch(error){panel.append(el('p',error.message));remove.disabled=false;}},'compact');
 for(const control of [original,remove]){Object.assign(control.style,{appearance:'none',display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'30px',padding:'5px 9px',margin:'3px 4px 0 0',border:'1px solid #805594',borderRadius:'4px',background:'#493257',color:'#e4c7f2',font:'500 12px/1.35 system-ui,sans-serif',cursor:'pointer'});control.addEventListener('mouseenter',()=>{control.style.background='#65437a';control.style.borderColor='#ba91d0';});control.addEventListener('mouseleave',()=>{control.style.background='#493257';control.style.borderColor='#805594';});control.addEventListener('focus',()=>{control.style.outline='2px solid #c59bdf';control.style.outlineOffset='2px';});control.addEventListener('blur',()=>{control.style.outline='';control.style.outlineOffset='';});}const actions=el('div');Object.assign(actions.style,{display:'flex',gap:'6px',flexWrap:'nowrap'});for(const control of [original,remove])Object.assign(control.style,{flex:'1 1 auto',margin:'0',whiteSpace:'nowrap'});actions.append(original,remove);panel.append(actions);marker.append(summary,panel);marker.addEventListener('mouseenter',()=>{marker.open=true;});marker.addEventListener('mouseleave',()=>{if(!marker.contains(document.activeElement))marker.open=false;});marker.addEventListener('click',event=>event.stopPropagation());parent.append(marker);}

}
async function applyDeckSavedPrintArt(){
 if(printArtRefresh)return printArtRefresh;
 printArtRefresh=(async()=>{
  try{
   const deck=await globalThis.MoxDecks?.current?.();if(!deck?.id)return;
   const [preview,choices]=await Promise.all([globalThis.MoxDecks.preview(),globalThis.MoxPrintPreferences.read(deck.id)]);
   if(preview?.id!==deck.id)return;
   await uploadedChoices(deck.id,choices);const displayCards=printPreviewCards(preview,choices);
   for(const wrapper of document.querySelectorAll('.deckview-image-wrapper')){
    const front=wrapper.querySelector('img.front');if(!front)continue;
    const snapshot=front.src,nativeId=snapshot.match(/\/card-([A-Za-z0-9_-]+)-(?:normal|large|small)\./)?.[1],id=nativeId||wrapper.dataset.mrdSourceCardId;
    if(nativeId&&nativeId!==wrapper.dataset.mrdSourceCardId){wrapper.querySelector('.mrd-print-art-badge')?.remove();for(const image of wrapper.querySelectorAll('img.deckview-image'))for(const key of ['mrdPrintArtId','mrdPrintArtName','mrdOriginalSrc','mrdOriginalSrcset','mrdOriginalTitle'])delete image.dataset[key];wrapper.dataset.mrdSourceCardId=nativeId;}
    const entries=displayCards.filter(card=>card.id===id),saved=entries.map(card=>{try{return (()=>{const choice=choices.get(globalThis.MoxPrintPreferences.key(deck.id,card));return sameDeckPrinting(card,choice)?null:choice;})();}catch{return null;}}),choice=saved.length&&saved.every(value=>value?.printingId===saved[0]?.printingId)?saved[0]:null;
    if(!choice){for(const image of wrapper.querySelectorAll('img.deckview-image'))setNativePrintArt(image,null);continue;}
    const result=await requestCardDetails(choice.name,choice.printingId);if(!result?.ok||!result.url||!wrapper.isConnected||front.src!==snapshot)continue;
    for(const image of wrapper.querySelectorAll('img.deckview-image'))setNativePrintArt(image,choice,result.url);
   }
   const selected=new Map(),ambiguous=new Set();
   for(const card of displayCards){if(!card.section)continue;let choice;try{choice=choices.get(globalThis.MoxPrintPreferences.key(deck.id,card));if(sameDeckPrinting(card,choice))choice=null;}catch{continue;}const name=card.name?.normalize('NFKC').trim().toLowerCase();if(!name)continue;if(selected.has(name)&&selected.get(name)?.printingId!==choice?.printingId)ambiguous.add(name);else selected.set(name,choice||null);}
   const images=[...document.querySelectorAll('img')].filter(image=>!image.closest('.deckview-image-wrapper,.mrd-edhrec,[data-mrd-dialog-host],[data-mrd-printings-host]')&&(visible(image)||image.dataset.mrdPrintArtId));
   for(const image of images){
    const cardSurface=image.matches('img.img-card')||image.closest('a[href*="/cards/"]')||image.closest('[data-card-id],[data-card-name],.card-item,.cardItem,.card-grid-item,.cardGridItem,.decklist-card');
    const banner=image.closest('header,[class*=banner i],[class*=hero i],[class*=deck-header i],[class*=deck-background i]');
    if(!cardSurface||banner){if(image.dataset.mrdPrintArtId)setNativePrintArt(image,null);continue;}
    const label=globalThis.MoxPrintingShortcuts?.cardAt(image)?.name||image.alt||'';let name=label.replace(/^card (?:art|image) (?:for|of)\s+/i,'').normalize('NFKC').trim().toLowerCase();
    if(image.dataset.mrdPrintArtName&&image.dataset.mrdPrintArtName!==image.alt){(image.closest('picture')?.parentElement||image.parentElement)?.querySelector('.mrd-print-art-badge')?.remove();for(const key of ['mrdPrintArtId','mrdPrintArtName','mrdOriginalSrc','mrdOriginalSrcset','mrdOriginalTitle'])delete image.dataset[key];}
    if(!selected.has(name)&&selected.has(name.replace(/ token$/i,'')))name=name.replace(/ token$/i,'');if(!selected.has(name)&&!image.dataset.mrdPrintArtId)continue;const liveId=(image.src||'').match(/\/card-([A-Za-z0-9_-]+)-(?:normal|large|small)\./)?.[1],savedId=(image.dataset.mrdOriginalSrc||'').match(/\/card-([A-Za-z0-9_-]+)-(?:normal|large|small)\./)?.[1];if(liveId&&savedId&&liveId!==savedId){(image.closest('picture')?.parentElement||image.parentElement)?.querySelector('.mrd-print-art-badge')?.remove();for(const key of ['mrdPrintArtId','mrdPrintArtName','mrdOriginalSrc','mrdOriginalSrcset','mrdOriginalTitle'])delete image.dataset[key];}const original=image.dataset.mrdOriginalSrc||image.src||'',sourceId=original.match(/\/card-([A-Za-z0-9_-]+)-(?:normal|large|small)\./)?.[1]||image.closest('[data-card-id]')?.getAttribute('data-card-id'),named=displayCards.filter(card=>card.name?.normalize('NFKC').trim().toLowerCase()===name),exact=sourceId?named.filter(card=>card.id===sourceId):named;let choice=null;if(exact.length===1){const entry=exact[0];choice=choices.get(globalThis.MoxPrintPreferences.key(deck.id,entry));if(sameDeckPrinting(entry,choice))choice=null;}else if(!named.some(card=>card.section==='tokens'))choice=ambiguous.has(name)?null:selected.get(name);if(!choice){setNativePrintArt(image,null);continue;}
    const snapshot=image.src,result=await requestCardDetails(choice.name,choice.printingId);if(result?.ok&&result.url&&image.isConnected&&image.src===snapshot&&label===(globalThis.MoxPrintingShortcuts?.cardAt(image)?.name||image.alt||''))setNativePrintArt(image,choice,result.url);
   }
  }catch{}finally{printArtRefresh=null;}
 })();return printArtRefresh;
}
browser.storage.onChanged?.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(key=>key.startsWith('mrd_print_edition_v1:')))schedule();});
function placePanel(view){
 if(view.isPage){
  const main=view.scope,headings=[...main.querySelectorAll('h1,h2,h3,h4,h5')],legality=headings.find(node=>/^format legalit(?:y|ies)\b/i.test(node.textContent.trim())),fallback=legality||headings.find(node=>/^decks\s+using\s+commander\b/i.test(node.textContent.trim()))||headings.find(node=>/^(?:decks?\b|popular decks?\b|top decks?\b)/i.test(node.textContent.trim()));
  if(legality){
   const blockFor=node=>node?.closest('section,article')||node?.parentElement,legalBlock=blockFor(legality);
   const priceHeading=headings.find(node=>/^(?:price|prices|pricing|card price|card prices)\b/i.test(node.textContent.trim()));
   const priceNodes=[...new Set([...main.querySelectorAll('[class*="price" i],[data-testid*="price" i],[aria-label*="price" i],*')])].filter(node=>{if(node.closest('.mrd-edhrec,.mrd-edh-launcher'))return false;const text=String(node.textContent||node.getAttribute('aria-label')||'').trim(),label=String(node.className||'')+' '+String(node.getAttribute('data-testid')||'')+' '+String(node.getAttribute('aria-label')||'');return text.length>0&&text.length<120&&(/price/i.test(label)||/(?:\$|€|£)\s*\d+(?:[.,]\d{1,2})?/.test(text));});
   const priceNode=priceHeading||priceNodes.sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length)[0],priceBlock=blockFor(priceNode);
   const legalAncestors=new Set();for(let node=legalBlock;node;node=node.parentElement)legalAncestors.add(node);let common=priceBlock;while(common&&!legalAncestors.has(common))common=common.parentElement;
   if(priceBlock&&legalBlock&&common&&priceBlock!==legalBlock){
    const directChild=(parent,node)=>{while(node?.parentElement&&node.parentElement!==parent)node=node.parentElement;return node?.parentElement===parent?node:null;};
    const priceChild=directChild(common,priceBlock),legalChild=directChild(common,legalBlock);
    if(priceChild&&legalChild&&priceChild!==legalChild&&priceChild.compareDocumentPosition(legalChild)&Node.DOCUMENT_POSITION_FOLLOWING){priceChild.after(view.host);}
    else {view.host.remove();legality.before(view.host);}
   }else {view.host.remove();legality.before(view.host);}
  }else if(fallback){const block=fallback.closest('section')||fallback.parentElement;if(block&&block!==main){view.host.remove();block.before(view.host);}else fallback.before(view.host);}
  else if(view.host.parentElement!==main||view.host!==main.lastElementChild)main.append(view.host);
 }else (view.scope.querySelector('.modal-body')||view.scope).append(view.host);
}
const launchers=new Map();
const nativeEDHREC=source=>!legacyPrintingScope(source)&&!source.closest('.mrd-edhrec,.mrd-edh-launcher')&&/^(?:browse\s+)?edhrecs?(?:\s+(?:cards|recommendations))?$/i.test((source.textContent||'').trim().replace(/\s+/g,' '));
function matchSearchButton(source,target){
 const style=getComputedStyle(source);
 for(const property of ['font-family','font-size','font-weight','line-height','letter-spacing','color','text-transform'])target.style.setProperty(property,style.getPropertyValue(property));
 target.style.background='transparent';target.style.border='0';target.style.borderRadius='0';target.style.boxShadow='none';target.style.padding='0';target.style.minHeight='0';target.style.verticalAlign='baseline';target.style.textDecoration='underline';target.style.cursor='pointer';
}
function launcherSearchInput(source){
 if(!/^\/decks\//.test(location.pathname))return null;
 const scope=source.closest('[role="dialog"],.modal,main')||document;
 return [...scope.querySelectorAll('input[type="search"],input[placeholder*="search" i],input[placeholder*="find and add" i]')].filter(input=>visible(input)&&input.compareDocumentPosition(source)&Node.DOCUMENT_POSITION_FOLLOWING).at(-1)||null;
}
function searchFieldGroup(input){
 let node=input;
 for(let depth=0;depth<4&&node.parentElement;depth++){
  const parent=node.parentElement;
  if([...parent.querySelectorAll('button')].some(button=>button.type==='submit'||/search/i.test((button.getAttribute('aria-label')||'')+' '+(button.title||''))))return parent;
  node=parent;
 }
 return input;
}
function placeLauncher(source,host,input){
 const open=host.shadowRoot.querySelector('button'),separator=host.shadowRoot.querySelector('.edh-launcher-separator');host.classList.toggle('mrd-edh-search-launcher',!!input);open.classList.toggle('edh-search-launch',!!input);separator.hidden=!!input;
 if(input){
  open.removeAttribute('style');const anchor=searchFieldGroup(input);
  let row=anchor.parentElement;
  if(!row?.classList.contains('mrd-edh-search-row')){
   row=el('div',null,'mrd-edh-search-row');Object.assign(row.style,{display:'flex',alignItems:'center',gap:'8px',width:'100%',minWidth:'0'});
   anchor.before(row);row.append(anchor);Object.assign(anchor.style,{flex:'1 1 0%',minWidth:'0'});
  }
  if(host.parentElement!==row||host.nextSibling!==anchor)anchor.before(host);
 }else{if(source.nextSibling!==host)source.after(host);matchSearchButton(source,open);}
}
function createExplorerLauncher(source,searchInput){
  const host=el('span');host.className='mrd-edh-launcher';const shadow=host.attachShadow({mode:'open'}),css=el('link');css.rel='stylesheet';css.href=globalThis.MoxDashboardStyleURL;
  const open=button('Card Explorer',async()=>{
   const existing=dialogHost().shadowRoot.querySelector('dialog[open]');if(existing){existing.focus();return;}
   if(current?.data&&(current.isPage||current.scope.contains(source))){advanced(current,current.data);return;}
   let name=globalThis.MoxDecks?.context?.()?.name;
   let slug=name?E.slug(name):null;
   if(!slug&&source.tagName==='A'){try{const u=new URL(source.href);if(['edhrec.com','www.edhrec.com'].includes(u.hostname))slug=u.pathname.match(/^\/(?:commanders|cards)\/([a-z0-9-]+)\/?$/)?.[1];}catch{}}
   const view={host};const box=dialog(view,'Card Explorer');
   const input=el('input');input.placeholder='Card or commander name';input.setAttribute('aria-label','Card or commander name');if(name)input.value=name;
   const status=el('p',slug?'Loading recommendations…':'Enter a card or commander name.','hint');status.setAttribute('role','status');
   const load=async()=>{const key=slug||E.slug(input.value);if(!key){status.textContent='Enter a card name.';return;}go.disabled=true;status.textContent='Loading recommendations…';try{const result=await browser.runtime.sendMessage({type:'mrd-read-edhrec',slug:key,kind:/^\/decks\//.test(location.pathname)?'commanders':'cards',retry:true});if(!box.modal.isConnected)return;if(!result?.ok)throw new Error(result?.error||'EDHREC is unavailable.');box.close();advanced(view,result.data);}catch(error){if(!box.modal.isConnected)return;status.textContent=error.message;go.disabled=false;fallbackBox.replaceChildren(link('Open on EDHREC','https://edhrec.com/'+(/^\/decks\//.test(location.pathname)?'commanders':'cards')+'/'+key));fallbackCardDetails({...view,name:input.value.trim()||name||key.replace(/-/g,' ')},fallbackBox);}};
   const fallbackBox=el('section',null,'edh-menu-fallback');
   const go=button('Browse cards',()=>{slug=null;load();});box.body.append(el('p',edhrecReminder,'hint edh-deckbuilding-reminder'),input,go,status,fallbackBox);
   if(/^\/decks\//.test(location.pathname)){
    go.disabled=true;status.textContent='Loading your commander…';
    (async()=>{
     try{
      let commander=await globalThis.MoxDecks?.commander?.();
      if(!commander?.slug){const deck=await globalThis.MoxDecks?.preview?.();const names=(deck?.cards||[]).filter(card=>card.section==='commanders'&&card.qty>0).map(card=>card.name);if(names.length)commander={name:names.join(' + '),slug:names.map(E.slug).join('-')};}
      if(!box.modal.isConnected)return;
      if(commander?.slug){name=commander.name;slug=commander.slug;input.value=name;}
      go.disabled=false;if(slug)load();else status.textContent='Choose a commander in your deck or enter a card or commander name.';
     }catch(error){if(box.modal.isConnected){go.disabled=false;status.textContent=error.message||'Could not read your commander. Enter a card or commander name.';}}
    })();
   }else if(slug)load();
  });const separator=el('span',' · ','edh-launcher-separator');separator.setAttribute('aria-hidden','true');shadow.append(css,separator,open);placeLauncher(source,host,searchInput);return host;
}
let persistentExplorer=null;
function persistentExplorerInput(){
 if(!/^\/decks\//.test(location.pathname)||featurePrefs?.mrd_features?.explorer===false)return null;
 return [...document.querySelectorAll('input[placeholder*="find and add" i]')].filter(input=>visible(input)&&!legacyPrintingScope(input)&&!input.closest('[data-mrd-owned],.mrd-edhrec,.mrd-edh-launcher')).at(-1)||null;
}
function injectLaunchers(){
 const supported=/^\/(cards|decks)\//.test(location.pathname);
 const persistentInput=persistentExplorerInput();
 if(persistentInput){if(!persistentExplorer)persistentExplorer=createExplorerLauncher(persistentInput,persistentInput);else placeLauncher(persistentInput,persistentExplorer,persistentInput);}
 else if(persistentExplorer){persistentExplorer.remove();persistentExplorer=null;}
 const usedInputs=new Set(persistentInput?[persistentInput]:[]);
 for(const [source,host] of launchers){
  if(!supported||!source.isConnected||!nativeEDHREC(source)||!visible(source)){host.remove();launchers.delete(source);}
  else {const input=launcherSearchInput(source);if(input&&usedInputs.has(input)){host.remove();launchers.delete(source);continue;}if(input)usedInputs.add(input);placeLauncher(source,host,input);}
 }
 if(!supported)return;
 for(const source of document.querySelectorAll('a,button,[role="button"]')){
  if(!nativeEDHREC(source)||!visible(source)||launchers.has(source))continue;
  const searchInput=launcherSearchInput(source);if(searchInput&&usedInputs.has(searchInput))continue;if(searchInput)usedInputs.add(searchInput);
  launchers.set(source,createExplorerLauncher(source,searchInput));
 }
}
function schedule(){if(featurePrefs?.mrd_features?.edhrec===false)return;if(timer===null)timer=setTimeout(update,150);}
const observer=new MutationObserver(records=>{
 if(!/^\/(cards|decks)\//.test(location.pathname)&&!current&&!launchers.size)return;
 records=records.filter(record=>record.type!=='attributes'||record.target.matches?.('img[alt],button,a[href*="edhrec.com"],[role="dialog"],.modal,.modal-content,.offcanvas,[data-card-preview],[class*="cardPreview"],[class*="card-preview"]')||record.target.closest?.('[role="dialog"],.modal-content,.offcanvas,[data-card-preview],[class*="cardPreview"],[class*="card-preview"]'));
 if(records.some(r=>!r.target.closest?.('.mrd-edhrec,.mrd-edh-launcher')&&(r.type!=='childList'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===3||(n.nodeType===1&&!n.matches('.mrd-edhrec,.mrd-edh-launcher,#mrd-root,#mrd-sidebar'))))))schedule();
});
observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-hidden','class','alt','src','srcset']});
window.addEventListener('popstate',schedule);
window.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('message',event=>{if(event.source!==window||event.origin!==location.origin)return;if(event.data?.source==='mrd-route-v3')schedule();if(event.data?.source==='mrd-deck-response-v2'&&current?.data)contextStats(current,current.data);});
schedule();
})();
