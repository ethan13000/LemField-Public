/* EDHREC information for card detail routes and deckbuilder card previews. */
 (async()=>{
'use strict';
const featurePrefs=await browser.storage.local.get('mrd_features');
if(globalThis.__mrdEDHRECInstalled)return;
globalThis.__mrdEDHRECInstalled=true;
const E=globalThis.MoxEDHREC,C=globalThis.MoxCardSearch;
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
const link=(text,url)=>{const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
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
 const close=()=>{if(closed)return;closed=true;openDialogs.delete(modal);hideHover();if(modal.open)modal.close();modal.remove();cleanArt();if(previous?.isConnected&&previous!==document.body&&previous!==document.documentElement)previous.focus({preventScroll:true});if(addedInEDHRECPlus||printingChangedInDialog){addedInEDHRECPlus=false;printingChangedInDialog=false;location.reload();}};
 head.append(heading,button('Close',close));modal.append(head,body);host.shadowRoot.append(modal);
 modal.addEventListener('cancel',event=>{event.preventDefault();close();});modal.addEventListener('close',close);modal.showModal();openDialogs.add(modal);
 return {modal,body,close};
}
const artwork=new Map(),cardDetails=new Map(),artTargets=new Map(),deckPreviews=new Map();
function requestCardDetails(name,printingId,printing){
 const key=printingId?'printing:'+printingId:printing?'printing:'+printing.set+'/'+printing.collectorNumber:name;
 if(!artwork.has(key)){
  if(artwork.size>=300)artwork.delete(artwork.keys().next().value);
  artwork.set(key,Promise.resolve(browser.runtime.sendMessage({type:'mrd-card-art',name,...(printingId?{printingId}:printing?{printing}:{})})).catch(()=>({ok:false})).then(result=>{
   if(!result?.ok||!result.url)artwork.delete(key);
   if(result?.ok&&result.details&&!printingId&&!printing){if(cardDetails.size>=300)cardDetails.delete(cardDetails.keys().next().value);cardDetails.set(name,result.details);}
   return result;
  }));
 }
 return artwork.get(key);
}
function applyCardDetails(card){const details=cardDetails.get(card.name);return details?{...card,...details}:card;}
function canLeadCommander(card){return String(card?.commanderLegality||'').toLowerCase()==='legal'&&(/\blegendary\s+creature\b/i.test(String(card?.type||''))||/\bcan be your commander\b/i.test(String(card?.oracle||'')));}
const artObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
 for(const entry of entries)if(entry.isIntersecting){const load=artTargets.get(entry.target);artObserver.unobserve(entry.target);artTargets.delete(entry.target);load?.();}
}):null;
function cleanArt(){for(const target of artTargets.keys())if(!target.isConnected){artObserver?.unobserve(target);artTargets.delete(target);}for(const target of deckPreviews.keys())if(!target.isConnected)deckPreviews.delete(target);}
window.addEventListener('mrd-current-deck-updated',()=>{cleanArt();for(const [aside,view] of deckPreviews)deckPreview(view,aside);});
function art(card,large=false){
 const wrap=el('div',null,large?'edh-art-large':'edh-art');
 const candidates=E.imageURLs(card),attempted=new Set();let requested=false;
 const exact=!!(card.set&&card.collectorNumber),candidateId=card.scryfallId||card.id,printingId=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(candidateId||'')?candidateId:null;
 const unavailable=()=>{if(!wrap.querySelector('img')&&!wrap.querySelector('.hint'))wrap.append(el('span','Art unavailable','hint'));};
 const recover=()=>{
  if(requested){unavailable();return;}requested=true;
  requestCardDetails(card.name,printingId,exact?{set:card.set,collectorNumber:card.collectorNumber}:null).then(result=>{
   if(result?.manaCost){card.manaCost=result.manaCost;wrap._onCardDetails?.();}
   if(result?.ok)candidates.push(...E.imageURLs({image:result.url,images:result.images}));
   next();
  });
 };
 const next=()=>{
  const url=candidates.find(value=>!attempted.has(value));
  if(!url){recover();return;}attempted.add(url);wrap.querySelector('.hint')?.remove();
  const img=el('img');img.alt=card.name;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
  img.onerror=()=>{img.remove();next();};img.src=url;wrap.append(img);
 };
 if(candidates.length)next();
 else if(artObserver){artTargets.set(wrap,recover);artObserver.observe(wrap);}
 else recover();
 return wrap;
}
let hover=null,hoverTimer=null;
function hideHover(){clearTimeout(hoverTimer);hoverTimer=null;if(hover){hover.anchor.removeAttribute('aria-describedby');try{hover.node.hidePopover?.();}catch{}hover.node.remove();hover=null;cleanArt();}}
function hoverArt(view,card,anchor){
 hideHover();hoverTimer=setTimeout(()=>{
  if(!anchor.isConnected)return;
  const node=el('div',null,'edh-hover-preview');node.id='edh-art-'+crypto.randomUUID();node.setAttribute('role','tooltip');node.setAttribute('popover','manual');node.append(art(card,true));
  const details=el('div',null,'edh-hover-details');details.append(el('strong',card.name,'edh-hover-name'));
  const mana=String(card.manaCost||card.mana_cost||'');if(mana)details.append(el('span',mana.replace(/\{([WUBRGCXYZ0-9]+)\}/gi,'$1').replace(/[{}]/g,''),'edh-hover-mana'));
  node.append(details);dialogHost().shadowRoot.append(node);
  const width=Math.min(440,innerWidth-24),height=Math.min(innerHeight-32,600),rect=anchor.getBoundingClientRect();
  let left=rect.right+14;if(left+width>innerWidth-12)left=rect.left-width-14;if(left<12)left=(innerWidth-width)/2;
  node.style.width=width+'px';node.style.left=left+'px';node.style.top=Math.max(12,Math.min(rect.top,innerHeight-height-12))+'px';
  anchor.setAttribute('aria-describedby',node.id);hover={node,anchor};try{node.showPopover?.();}catch{}
 },120);
}
window.addEventListener('scroll',hideHover,true);window.addEventListener('resize',hideHover);
function inspect(view,card){
 const box=dialog(view,card.name);box.body.append(art(card,true),link('Find on Moxfield',moxfieldCardURL(card.name)),button('Browse printings',()=>browsePrintings(view,card),'compact'));
 const actions=el('div',null,'edh-card-actions');addActions(view,card,actions);box.body.append(actions);
}
function addActions(view,card,container){
 const status=el('span',null,'hint');status.setAttribute('role','status');
 const choose=button('⋯',()=>chooseDeck(view,card),'edh-art-add edh-art-add-other');choose.title='Add to another deck';choose.setAttribute('aria-label','Add to another deck');
 const last=button('+',async()=>{
  last.disabled=true;last.setAttribute('aria-busy','true');status.textContent='Adding…';
  try{const deck=await globalThis.MoxDecks.current();if(!deck)throw new Error('Open a deck in this tab first.');const result=await globalThis.MoxDecks.add(card,deck.id);noteDeckChanged();status.textContent=`Added to ${result.deck.name}.`;last.textContent='✓';last.setAttribute('data-state','added');last.setAttribute('aria-label',`Added to ${result.deck.name}`);}
  catch(error){status.textContent=error.message;last.disabled=false;}
  finally{last.setAttribute('aria-busy','false');}
 });
 if(!globalThis.MoxDecks){choose.disabled=true;last.disabled=true;status.textContent='Reload the extension to connect deck actions.';}
 else globalThis.MoxDecks.current().then(deck=>{if(!deck){last.disabled=true;last.title='Open a deck in this tab first.';}else last.title=`Add to ${deck.name}`;}).catch(()=>{});
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
   try{const result=await globalThis.MoxDecks.add(card,select.value,board.value);noteDeckChanged();status.textContent=`Added ${card.name} to ${result.deck.name}.`;add.textContent='Added';}
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
 const preview=button('',()=>{hideHover();inspect(view,card);},'edh-preview');preview.setAttribute('aria-label',`View art for ${card.name}`);preview.append(art(card));
 preview.addEventListener('mouseenter',()=>hoverArt(view,card,preview));preview.addEventListener('mouseleave',hideHover);preview.addEventListener('focus',()=>hoverArt(view,card,preview));preview.addEventListener('blur',hideHover);
 const details=el('div',null,'edh-card-details'),stats=el('div',null,'edh-card-stats');
 const typeIcons=typeSymbols(card);if(typeIcons.length){const typeRow=el('span',null,'edh-card-type-icons');typeRow.append(...typeIcons);stats.append(typeRow);}
 if(card.inclusion!==null&&card.inclusion!==undefined)stats.append(el('span',`${Number(card.inclusion.toFixed(1))}% inclusion`,'edh-stat-inclusion'));
 if(card.lift!==null&&card.lift!==undefined)stats.append(el('span',`${Number(card.lift.toFixed(2))}× lift`,'edh-stat-lift'));
 const nameLink=link(card.name,moxfieldCardURL(card.name));nameLink.title=card.name;details.append(nameLink,stats.childElementCount?stats:el('span','Statistics unavailable','hint'));
 if(card.duplicateCount>1)details.append(el('span',card.duplicateCount+' entries condensed','edh-printing-badge'));
 const cardTags=(C?.tags(card)||[]).filter(tag=>!isCardTypeTag(tag));if(cardTags.length)details.append(el('p',cardTags.slice(0,4).join(' · '),'edh-result-tags'));
 const visual=el('div',null,'edh-card-visual'),actions=el('div',null,'edh-card-actions'+(mode==='art'?' edh-card-art-actions-overlay':''));addActions(view,card,actions);visual.append(preview);if(mode==='art')visual.append(actions);else details.append(actions);item.append(visual,details);return item;
}
function printingTagOrder(rows,byFrequency){
 const counts=new Map();
 for(const printing of rows)for(const tag of new Set(C.printingTags(printing)))counts.set(tag,(counts.get(tag)||0)+1);
 return [...counts].sort(([a,ac],[b,bc])=>(byFrequency?bc-ac:0)||a.localeCompare(b,undefined,{sensitivity:'base',numeric:true}));
}
function browsePrintings(view,card){
 const box=dialog(view,`Printings · ${card.name}`),tools=el('div',null,'edh-browser-tools'),search=el('input'),sort=el('select'),order=el('select'),tag=el('details',null,'edh-printing-filters');
 let activeCard=card,deckCards=null,deckOrder=null,deckIndex=-1,selectedPrinting=null,deckLoading=null,selectionEpoch=0;
 box.modal.classList.add('edh-printings-dialog');search.type='search';search.placeholder='Search set, collector number, name, or tag';search.setAttribute('aria-label','Search printings');sort.setAttribute('aria-label','Sort loaded printings');tag.setAttribute('aria-label','Printing tag');
 order.setAttribute('aria-label','Deck list order');for(const [value,label] of [['deck','Deck order'],['name','Card name A–Z']]){const option=el('option',label);option.value=value;order.append(option);}
 for(const [value,label] of [['released','Newest first'],['oldest','Oldest first'],['secretLair','Secret Lair first'],['set','Set name'],['price','Price: low to high'],['tag','Tag']]){const option=el('option',label);option.value=value;sort.append(option);}
 const filterSummary=el('summary','Filter tags'),filterRows=el('div',null,'edh-printing-filter-rows'),states=new Map(),tagButtons=new Map();
 const clearFilters=button('Clear tag filters',()=>{states.clear();render();},'compact');
 let tagsByFrequency=false;
 const tagOrder=button('Tags: Name A–Z',()=>{tagsByFrequency=!tagsByFrequency;tagOrder.textContent=tagsByFrequency?'Tags: Frequency':'Tags: Name A–Z';tagOrder.setAttribute('aria-pressed',String(tagsByFrequency));render();},'compact');
 tagOrder.classList.add('edh-tag-sort');
 tagOrder.setAttribute('aria-label','Sort tags by frequency instead of name');tagOrder.setAttribute('aria-pressed','false');tagOrder.title='Frequency counts how many loaded printings have each tag, before filters or artwork grouping.';
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
 const tokenNotice=el('span',"Token printings can't be changed.",'hint edh-token-printing-note');tokenNotice.hidden=true;
 const status=el('p',null,'hint'),list=el('ul',null,'edh-cards edh-cards-grid'),more=button('Load more printings',()=>load(false),'compact');status.setAttribute('role','status');
 const layout=el('div',null,'edh-printings-layout'),resultsPane=el('section',null,'edh-printings-results'),deckPane=el('aside',null,'edh-printings-decklist'),deckPosition=el('p','Loading deck order…','hint'),deckList=el('ol',null,'edh-printings-deck-rows');
 deckPane.append(el('h3','Deck order'),deckPosition,order,deckList);resultsPane.append(tools,status,list,more,el('p','Choose an edition, then use it to replace the printing of this card in the current deck. The deck page refreshes when you close this window.','hint'));layout.append(resultsPane,deckPane);
 const footer=el('div',null,'edh-printings-footer');footer.append(tokenNotice,previousCard,nextCard);
 tools.append(search,sort,tag,condensedLabel);box.body.append(layout);box.modal.append(footer);
 let rows=[],page=0,total=null,hasMore=false,loading=false,epoch=0,error='';
 const isTokenPrinting=printing=>activeCard.isToken===true||printing?.layout==='token'||/\btoken\b/i.test(String(printing?.type||printing?.typeLine||''));
 const orderedCards=cards=>order.value==='name'?[...cards].sort((a,b)=>a.name.localeCompare(b.name)||a.section.localeCompare(b.section)):[...cards];
 async function ensureDeckCards(){
  if(deckCards)return deckCards;
  if(!deckLoading)deckLoading=(async()=>{const deck=await globalThis.MoxDecks?.preview();if(!deck)throw Error('Open a deck in this tab to browse its cards here.');const identity=row=>row.id||`${row.name}|${row.set}|${row.collectorNumber}`;deckOrder=(deck.cards||[]).filter(row=>['mainboard','commanders','sideboard','maybeboard'].includes(row.section)).filter((row,index,all)=>all.findIndex(other=>other.section===row.section&&identity(other)===identity(row))===index);deckCards=orderedCards(deckOrder);return deckCards;})().catch(error=>{deckLoading=null;throw error;});
  return deckLoading;
 }
 function renderDeckList(){
  if(!deckCards){deckPosition.textContent=deckLoading?'Loading deck order…':'Open a deck to browse its cards here.';return;}
  deckPosition.textContent=deckIndex>=0?`Card ${deckIndex+1} of ${deckCards.length}`:`${deckCards.length} cards · select one to jump`;
  deckList.replaceChildren(...deckCards.map((row,index)=>{const jump=button(`${index+1}. ${row.qty>1?row.qty+'× ':''}${row.name}`);jump.classList.add('edh-deck-jump');jump.setAttribute('aria-current',String(index===deckIndex));jump.title=`Jump to ${row.name}`;jump.addEventListener('mouseenter',()=>hoverArt(view,row,jump));jump.addEventListener('mouseleave',hideHover);jump.addEventListener('focus',()=>hoverArt(view,row,jump));jump.addEventListener('blur',hideHover);jump.onclick=()=>selectDeckCard(index);return el('li',null,index===deckIndex?'edh-deck-jump-current':'').appendChild(jump).parentElement;}));
 }
 function selectDeckCard(index){
  const row=deckCards?.[index];if(!row)return;selectionEpoch++;deckIndex=index;activeCard={name:row.name,cardId:row.id,set:row.set,collectorNumber:row.collectorNumber,section:row.section,isToken:row.isToken===true};selectedPrinting={set:row.set,collectorNumber:row.collectorNumber};
  nextCard.textContent=`Next card (${deckIndex+1}/${deckCards.length})`;previousCard.textContent=`Previous card (${deckIndex+1}/${deckCards.length})`;box.modal.querySelector('.edh-dialog-header h2').textContent=`Printings · ${activeCard.name}`;search.value='';states.clear();renderDeckList();load(true);
 }
 function render(){
  tokenNotice.hidden=activeCard.isToken!==true&&!rows.some(isTokenPrinting);
  const tagCounts=printingTagOrder(rows,tagsByFrequency);
  for(const value of states.keys())if(!tagCounts.some(([tag])=>tag===value))tagCounts.push([value,0]);
  const availableTags=new Set(tagCounts.map(([value])=>value));
  for(const [value,buttons] of tagButtons)if(!availableTags.has(value)){buttons.row.remove();tagButtons.delete(value);}
  for(const [value] of tagCounts)if(!tagButtons.has(value)){
   const row=el('div',null,'edh-printing-filter-row'),include=button('+',()=>{states.get(value)==='include'?states.delete(value):states.set(value,'include');render();},'edh-filter-include'),exclude=button('−',()=>{states.get(value)==='exclude'?states.delete(value):states.set(value,'exclude');render();},'edh-filter-exclude');
   row.setAttribute('role','group');row.setAttribute('aria-label',value+' tag filter');include.setAttribute('aria-label','Include '+value);exclude.setAttribute('aria-label','Exclude '+value);row.append(el('span',value),include,exclude);filterRows.append(row);tagButtons.set(value,{row,include,exclude});
  }
  tagCounts.forEach(([value,count],index)=>{const row=tagButtons.get(value).row;row.title=count+' loaded printing'+(count===1?'':'s');if(filterRows.children[index]!==row)filterRows.insertBefore(row,filterRows.children[index]||null);});
  for(const [value,buttons] of tagButtons){buttons.row.dataset.state=states.get(value)||'neutral';buttons.include.setAttribute('aria-pressed',String(states.get(value)==='include'));buttons.exclude.setAttribute('aria-pressed',String(states.get(value)==='exclude'));}
  filterSummary.textContent='Filter tags'+(states.size?' ('+states.size+')':'');clearFilters.disabled=!states.size;
  const includeTags=[...states].filter(([,mode])=>mode==='include').map(([value])=>value),excludeTags=[...states].filter(([,mode])=>mode==='exclude').map(([value])=>value);
  const filtered=C.printings(rows,{query:search.value,sort:sort.value,includeTags,excludeTags,condense:condensed.checked});
  const artKey=print=>print.illustrationId?(print.oracleId||print.name.toLowerCase())+'|'+print.illustrationId+'|'+print.printedName.toLowerCase()+'|'+(print.frameEffects||[]).join(','):print.id;
  const artCounts=new Map();for(const print of filtered){const id=artKey(print);artCounts.set(id,(artCounts.get(id)||0)+(print.variants?.length||1));}
  const mostPrintings=Math.max(0,...artCounts.values());
  list.replaceChildren(...filtered.map(print=>{
   const count=artCounts.get(artKey(print)),isMost=mostPrintings>1&&count===mostPrintings,variants=print.variants||[print],candidates=print.variants?.length?print.variants:filtered.filter(candidate=>artKey(candidate)===artKey(print)),used=!!selectedPrinting&&variants.some(variant=>String(variant.set||'').toLowerCase()===String(selectedPrinting.set||'').toLowerCase()&&String(variant.collectorNumber)===String(selectedPrinting.collectorNumber)),item=el('li',null,'edh-card edh-card-art'+(isMost?' edh-most-printings':'')+(used?' edh-used-printing':'')),preview=link('',moxfieldCardURL(print.printedName));preview.append(art(print));item.append(preview,link(print.printedName,moxfieldCardURL(print.printedName)),el('p',`${print.setName} · #${print.collectorNumber}`,'hint'));
   if(isMost)item.append(el('span',`Most printings · ${count}`,'edh-most-printings-badge'));
   if(used)item.append(el('span',`In deck · ${selectedPrinting.set} #${selectedPrinting.collectorNumber}`,'edh-used-printing-badge'));
   item.append(el('p',[print.releasedAt,print.price!==null?'$'+print.price.toFixed(2):'Price unavailable',...C.tags(print)].filter(Boolean).join(' · '),'edh-result-tags'));
   const actionSource=activeCard,updateSelection=(actual,result)=>{const previousId=actionSource.cardId,section=actionSource.section,sourceName=actionSource.name,updatedId=result?.cardId||previousId;for(const entries of [deckCards,deckOrder]){if(!entries)continue;const index=entries.findIndex(row=>(previousId&&row.id===previousId)||(!previousId&&row.name.toLocaleLowerCase()===sourceName.toLocaleLowerCase()&&(!section||row.section===section)));if(index>=0)entries[index]={...entries[index],id:updatedId,set:actual.set,collectorNumber:actual.collectorNumber,scryfallId:null,image:null,image_uris:null,card_faces:[]};}if(activeCard===actionSource||(activeCard.name.toLocaleLowerCase()===sourceName.toLocaleLowerCase()&&(!section||activeCard.section===section))){selectionEpoch++;activeCard={...actionSource,cardId:updatedId,set:actual.set,collectorNumber:actual.collectorNumber};selectedPrinting={set:actual.set,collectorNumber:actual.collectorNumber};renderDeckList();render();}};
   if(!isTokenPrinting(print)){const actions=el('div',null,'edh-card-actions');actions.append(usePrintingAction(actionSource,print,candidates,updateSelection));item.append(actions);}
   if(print.variants?.length>1){const details=el('details',null,'edh-printing-variants'),summary=el('summary',`Show ${print.variants.length} printings with this artwork`);details.append(summary);
    for(const variant of print.variants){const row=el('div');if(selectedPrinting&&String(variant.set||'').toLowerCase()===String(selectedPrinting.set||'').toLowerCase()&&String(variant.collectorNumber)===String(selectedPrinting.collectorNumber)){row.classList.add('edh-used-printing-variant');row.append(el('strong','In deck · '));}const editionLink=link(`${variant.setName} #${variant.collectorNumber}${variant.price!==null?' · $'+variant.price.toFixed(2):''}`,variant.url);editionLink.addEventListener('mouseenter',()=>hoverArt(view,variant,editionLink));editionLink.addEventListener('mouseleave',hideHover);editionLink.addEventListener('focus',()=>hoverArt(view,variant,editionLink));editionLink.addEventListener('blur',hideHover);row.append(editionLink);if(!isTokenPrinting(variant)){const actions=el('div',null,'edh-card-actions');actions.append(usePrintingAction(actionSource,variant,print.variants,updateSelection));row.append(actions);}details.append(row);}item.append(details);
   }
   return item;
  }));
  status.textContent=error||`${loading?'Loading… ':''}${filtered.length} ${condensed.checked?'artwork groups':'printings'} shown · ${rows.length}${total!==null?' of '+total:''} printings loaded`;
  more.hidden=!hasMore&&!error;more.disabled=loading;more.textContent=error?'Retry loading printings':'Load more printings';cleanArt();
 }
 async function load(reset){
  if(loading&&!reset)return;
  if(reset){epoch++;rows=[];page=0;total=null;hasMore=false;}
  const token=epoch,next=page+1;loading=true;error='';render();
  try{const result=await browser.runtime.sendMessage({type:'mrd-card-printings',name:activeCard.name,isToken:activeCard.isToken===true,page:next});
   if(!box.modal.isConnected||token!==epoch)return;
   if(!result?.ok)throw Error(result?.error||'Could not load printings.');
   const unique=new Map(rows.map(row=>[row.id,row]));for(const row of result.cards||[])unique.set(row.id,row);rows=[...unique.values()];page=next;total=result.total;hasMore=result.hasMore;
  }catch(failure){if(token===epoch&&box.modal.isConnected)error=failure.message;}
  finally{if(token===epoch&&box.modal.isConnected){loading=false;render();}}
 }
 order.onchange=()=>{if(!deckOrder)return;const current=deckIndex>=0?deckCards[deckIndex]:activeCard;deckCards=orderedCards(deckOrder);deckIndex=current?.cardId?deckCards.findIndex(row=>row.id===current.cardId):deckCards.findIndex(row=>row.name.toLocaleLowerCase()===current?.name?.toLocaleLowerCase());if(deckIndex>=0){nextCard.textContent=`Next card (${deckIndex+1}/${deckCards.length})`;previousCard.textContent=`Previous card (${deckIndex+1}/${deckCards.length})`;}renderDeckList();};
 const openingEpoch=selectionEpoch;ensureDeckCards().then(cards=>{if(!box.modal.isConnected)return;if(selectionEpoch===openingEpoch){const index=activeCard.cardId?cards.findIndex(row=>row.id===activeCard.cardId):cards.findIndex(row=>row.name.toLocaleLowerCase()===activeCard.name.toLocaleLowerCase());if(index>=0){deckIndex=index;const row=cards[index],tokenChanged=activeCard.isToken!==(row.isToken===true);activeCard={name:row.name,cardId:row.id,set:row.set,collectorNumber:row.collectorNumber,section:row.section,isToken:row.isToken===true};selectedPrinting={set:row.set,collectorNumber:row.collectorNumber};nextCard.textContent=`Next card (${deckIndex+1}/${deckCards.length})`;previousCard.textContent=`Previous card (${deckIndex+1}/${deckCards.length})`;render();if(tokenChanged)load(true);}}renderDeckList();}).catch(()=>{deckPosition.textContent='Open a deck to browse its cards here.';renderDeckList();});
 for(const control of [sort,condensed])control.onchange=render;search.oninput=render;load(true);
}
function usePrintingAction(source,printing,alternatives=[],onSelected){
 const status=el('span',null,'hint');status.setAttribute('role','status');
 const apply=button('Use this printing',async()=>{
  apply.disabled=true;apply.setAttribute('aria-busy','true');status.textContent='Updating printing…';
  try{
   const deadline=Date.now()+10000,seen=new Set(),candidates=[printing,...alternatives].filter(candidate=>{const key=String(candidate.set||'').toLowerCase()+'|'+String(candidate.collectorNumber);if(seen.has(key))return false;seen.add(key);return true;});let result,applied=printing,lastError;
   for(let index=0;index<candidates.length;index++){
    if(Date.now()>=deadline)throw new Error('Printing update timed out after 10 seconds. No further artwork printings were tried. Close the menu to refresh and check the deck before retrying.');
    const candidate=candidates[index];try{result=await globalThis.MoxDecks.changePrinting(source,candidate,undefined,stage=>{status.textContent=index?`Trying another printing of this artwork… ${stage}...`:stage+"...";},deadline);applied=candidate;break;}
    catch(error){lastError=error;if(!/could not be matched on Moxfield/i.test(error.message)||index===candidates.length-1)throw error;status.textContent=`${candidate.set} #${candidate.collectorNumber} could not be matched; trying another printing of this artwork…`;}
   }
   if(!result)throw lastError||new Error('No matching printing was found on Moxfield.');
   if(!result.alreadySelected)noteDeckChanged(true);const actual=result.printing||{set:applied.set,collectorNumber:applied.collectorNumber};const changedCandidate=String(actual.set).toLowerCase()!==String(printing.set).toLowerCase()||String(actual.collectorNumber)!==String(printing.collectorNumber);
   status.textContent=changedCandidate?`The requested printing was unavailable; used ${actual.set} #${actual.collectorNumber} from the same artwork.`:result.alreadySelected?'This printing is already selected.':`Updated ${result.quantity} ${result.quantity===1?'copy':'copies'} in ${result.deck.name}.`;apply.textContent=result.alreadySelected?'Selected':'✓ Selected';apply.setAttribute('data-state','added');onSelected?.(actual,result);
  }
  catch(error){status.textContent=error.message;if(/may be incomplete|result unknown|timed out|did not respond/i.test(error.message))noteDeckChanged(true);if(/could not be matched on Moxfield/i.test(error.message)){apply.disabled=true;apply.textContent='Unavailable on Moxfield';apply.setAttribute('data-state','unavailable');apply.title='Moxfield could not match this exact printing; it cannot be applied.';}else apply.disabled=false;}
  finally{apply.setAttribute('aria-busy','false');}
 });
 apply.classList.add('edh-printing-apply');apply.setAttribute('aria-label',`Use ${printing.setName} ${printing.collectorNumber} in the current deck`);
 const wrap=el('span',null,'edh-printing-selection');wrap.append(apply,status);return wrap;
}
// Native shortcuts use a persistent host, independent of transient card previews.
globalThis.MoxPrintings={open(card){
 let host=document.querySelector('[data-mrd-printings-host]');
 if(!host){host=el('div');host.setAttribute('data-mrd-printings-host','');host.setAttribute('data-mrd-owned','');const shadow=host.attachShadow({mode:'open'}),css=el('link');css.rel='stylesheet';css.href=globalThis.MoxDashboardStyleURL;shadow.append(css);document.body.append(host);}
 const existing=dialogHost().shadowRoot.querySelector('dialog[open]');
 if(existing){existing.focus();return;}
 browsePrintings({host},card);
}};
function advanced(view,data){
 if(featurePrefs?.mrd_features?.explorer===false)return;
 const existing=dialogHost().shadowRoot.querySelector('.edh-browser-layout')?.closest('dialog');if(existing?.open){existing.focus();return;}
 const box=dialog(view,`Card Explorer · ${data.name}`),controls=el('div',null,'edh-browser-tools'),categories=el('select'),sort=el('select'),search=el('input'),display=el('select');
 box.modal.classList.add('edh-plus-dialog');
 const attribution=el('footer',null,'edh-explorer-attribution');attribution.append(link('Powered by EDHREC','https://edhrec.com'));box.modal.append(attribution);
 categories.setAttribute('aria-label','Card category');sort.setAttribute('aria-label','Sort cards');display.setAttribute('aria-label','Card display');
 const options=(select,rows)=>{for(const [value,label] of rows){const option=el('option',label);option.value=value;select.append(option);}};
 options(categories,[['top','Top cards'],['lift','High lift cards'],['all','All cards'],...(data.categories||[]).filter(c=>c.id!=='topcards').map(c=>[c.id,c.name]),['similar','Similar cards']]);
 if(!(data.categories||[]).some(category=>/^topcards$/i.test(category.id))||!E.browse(data,{category:'top'}).length)categories.value='all';
 options(sort,[['inclusion','Inclusion'],['lift','Lift'],['numDecks','Deck count'],['name','Name'],['synergy','Synergy'],['manaValue','Mana value: low to high'],['price','Price: low to high'],['tag','Tag']]);options(display,[['art','Card art'],['list','Compact list']]);
 search.type='search';search.placeholder='Search names, rules, types, or tags';search.setAttribute('aria-label','Search names, rules, types, or tags');
 const exclude=el('input');exclude.type='checkbox';exclude.checked=true;
 const excludeLabel=el('label');excludeLabel.append(exclude,document.createTextNode(' Hide cards already in deck'));
 const type=el('select'),role=el('select'),tag=el('select'),maxMana=el('input'),maxPrice=el('input'),color=el('input'),condensed=el('input');
 type.setAttribute('aria-label','Card type filter');role.setAttribute('aria-label','Requirement role filter');tag.setAttribute('aria-label','Card tag filter');
 options(type,[['','All card types'],...['Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Battle','Land'].map(t=>[t,t])]);
 options(role,[['','All requirement roles'],...(globalThis.MoxRules?.presetLibrary||[]).map(r=>[r.id,r.name])]);options(tag,[['','All card tags']]);
 for(const [input,label] of [[maxMana,'Maximum mana value'],[maxPrice,'Maximum price (USD)']]){input.type='number';input.min='0';input.step=input===maxPrice?'0.01':'1';input.placeholder=label;input.setAttribute('aria-label',label);}
 color.type='checkbox';color.disabled=true;const colorLabel=el('label');colorLabel.append(color,document.createTextNode(' Within commander colors'));
 condensed.type='checkbox';condensed.checked=true;const condensedLabel=el('label');condensedLabel.append(condensed,document.createTextNode(' Condense duplicate cards'));
 const detailStatus=el('p','Rules, keywords, role, price, and color filters use loaded card details. Unknown values are excluded when those filters are active.','hint');detailStatus.setAttribute('role','status');
 const requirementStatus=el('p','Requirement: All roles','edh-requirement-status');requirementStatus.setAttribute('aria-live','polite');
 const detailAttempts=new Set();let loadingDetails=false,deckColors=null;
 const loadDetails=button('Load card details (next 48)',async()=>{
  if(loadingDetails)return;loadingDetails=true;loadDetails.disabled=true;
  const candidates=E.browse(categories.value==='similar'?{allCards:similarRows||[]}:data,{category:categories.value==='similar'?'all':categories.value,sort:'name'});
  let pending=candidates.filter(card=>!cardDetails.has(card.name)&&!detailAttempts.has(card.name)).slice(0,48);
  if(!pending.length){for(const card of candidates)if(!cardDetails.has(card.name))detailAttempts.delete(card.name);pending=candidates.filter(card=>!cardDetails.has(card.name)).slice(0,48);}
  let done=0,failed=0;
  try{for(const card of pending){if(!box.modal.isConnected)break;detailAttempts.add(card.name);const result=await requestCardDetails(card.name);if(!box.modal.isConnected)break;if(!result?.details)failed++;done++;detailStatus.textContent='Loading card details: '+done+' / '+pending.length+(failed?' - '+failed+' unavailable':'');}}
  finally{loadingDetails=false;if(box.modal.isConnected){loadDetails.disabled=false;const loaded=candidates.filter(card=>cardDetails.has(card.name)).length;detailStatus.textContent=loaded+' / '+candidates.length+' cards have details loaded'+(failed?' - '+failed+' unavailable; click again to retry.':'. Click again to load the next batch.');render();}}
 },'compact');
 controls.append(categories,sort,search,display,excludeLabel,type,role,tag,maxMana,maxPrice,colorLabel,condensedLabel,loadDetails);
 const pageSize=48;const count=el('p',null,'hint'),list=el('ul',null,'edh-cards'),more=button('Show more',()=>{limit=limit>pageSize?pageSize:limit+pageSize;render();});more.setAttribute('aria-expanded','false');count.setAttribute('role','status');
 const layout=el('div',null,'edh-browser-layout'),results=el('div',null,'edh-browser-results'),deck=el('aside',null,'edh-deck-preview');deck.setAttribute('aria-label','Current deck preview');
 results.append(controls,requirementStatus,detailStatus,count,list,more,link('Open on EDHREC',data.url),el('p',null,'hint'));results.lastChild.append(link('Card images: Scryfall','https://scryfall.com'));layout.append(results,deck);box.body.append(layout);let limit=pageSize;
 let deckNames=new Set(),deckLoading=true;
 let similarRows=null,similarLoading=false,similarError='',similarRetry=false;
 const similarDirect=link('Open similar cards on EDHREC','https://edhrec.com/cards/'+E.slug(data.name)+'/similar-cards'),retrySimilar=button('Retry similar cards',()=>{similarRows=null;similarError='';similarRetry=true;render();},'compact');
 similarDirect.hidden=true;retrySimilar.hidden=true;results.insertBefore(similarDirect,list);results.insertBefore(retrySimilar,list);
 const render=()=>{
  if(categories.value==='similar'&&similarRows===null&&!similarLoading){similarLoading=true;const retry=similarRetry;similarRetry=false;browser.runtime.sendMessage({type:'mrd-similar-edhrec',slug:E.slug(data.name),retry}).then(result=>{similarRows=result?.cards||[];similarError=result?.ok?'':result?.error||'Similar cards unavailable.';similarLoading=false;if(box.modal.isConnected)render();}).catch(()=>{similarRows=[];similarLoading=false;similarError='Similar cards unavailable.';if(box.modal.isConnected)render();});}
  hideHover();
  const source=categories.value==='similar'?{allCards:similarRows||[]}:data;
  const candidates=E.browse(source,{category:categories.value==='similar'?'all':categories.value,sort:sort.value,query:''}).map(applyCardDetails);
  const selectedTag=tag.value;tag.replaceChildren();options(tag,[['','All card tags'],...[...new Set(candidates.flatMap(C.tags))].sort().map(t=>[t,t])]);tag.value=selectedTag;if(tag.selectedIndex<0)tag.value='';
  const rows=C.filter(candidates,{query:search.value,sort:categories.value==='lift'?'lift':sort.value,type:type.value,role:role.value,tag:tag.value,maxMana:maxMana.value,maxPrice:maxPrice.value,colors:color.checked?deckColors:null,condense:condensed.checked}).filter(card=>!exclude.checked||!deckLoading&&![card,...(card.variants||[])].some(variant=>deckNames.has(variant.name.trim().toLowerCase())));
  if(categories.value==='top'&&!rows.length&&(!exclude.checked||!deckLoading)){categories.value='all';limit=pageSize;render();return;}
  requirementStatus.textContent='Requirement: '+(role.value?role.selectedOptions[0]?.textContent||role.value:'All roles');
  list.classList.toggle('edh-cards-grid',display.value==='art');list.replaceChildren(...rows.slice(0,limit).map(card=>tile(view,card,display.value)));cleanArt();
  count.textContent=exclude.checked&&deckLoading?'Loading current deck...':categories.value==='similar'&&similarLoading?'Loading similar cards...':categories.value==='similar'&&similarError?similarError:rows.length?Math.min(limit,rows.length)+' of '+rows.length+' cards':'No cards match. Try loading card details or relaxing the filters.';
  more.hidden=limit>=rows.length&&limit<=pageSize;more.textContent=limit>pageSize?'Show less':'Show more';more.setAttribute('aria-expanded',String(limit>pageSize));sort.disabled=categories.value==='lift';similarDirect.hidden=categories.value!=='similar';retrySimilar.hidden=categories.value!=='similar'||!similarError;
 };
 let searchTimer=null;box.modal.addEventListener('close',()=>clearTimeout(searchTimer));
 for(const control of [categories,sort,display,exclude,type,role,tag,color,condensed,maxMana,maxPrice])control.onchange=()=>{clearTimeout(searchTimer);limit=pageSize;render();};search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(box.modal.isConnected){limit=pageSize;render();}},150);};
 deck._onDeckChange=value=>{deckLoading=false;const commanders=(value?.cards||[]).filter(card=>card.section==='commanders'&&card.qty>0);deckColors=commanders.length&&commanders.every(card=>card.colorIdentityKnown!==false&&typeof card.colors==='string')?[...new Set(commanders.flatMap(card=>card.colors.split('')))].join(''):null;color.disabled=deckColors===null;if(color.disabled)color.checked=false;deckNames=new Set((value?.cards||[]).filter(card=>card.qty>0).map(card=>card.name.trim().toLowerCase()));if(box.modal.isConnected)render();};
 deckPreviews.set(deck,view);deckPreview(view,deck);render();
}
async function deckPreview(view,aside,force=false){
 const token=(aside._generation||0)+1;aside._generation=token;aside.replaceChildren(el('h3','Current deck'),el('p','Loading deck…','hint'));
 try{
  const deck=await globalThis.MoxDecks?.preview?.(force);if(!aside.isConnected||token!==aside._generation)return;
  aside._onDeckChange?.(deck);
  aside.replaceChildren(el('h3','Current deck'));
  if(!deck){aside.append(el('p','Open a deck in this tab to preview it here.','hint'));return;}
  const count=el('p',`Active cards: ${deck.activeCount}`,'edh-deck-count');count.setAttribute('aria-live','polite');
  const name=link(deck.name,`https://moxfield.com/decks/${deck.id}`),requirementBox=el('section',null,'edh-deck-requirements');requirementBox.append(el('h3','Deck requirements'),el('p','Loading profile…','hint'));
  aside.append(name,count,el('p','Main deck + commanders','hint'),button('Refresh deck preview',()=>deckPreview(view,aside,true),'compact'),requirementBox);
  browser.storage.local.get('mrd_settings').then(stored=>{
   if(!aside.isConnected||token!==aside._generation)return;
   try{
    const R=globalThis.MoxRules,settings=R.sanitizeSettings(stored?.mrd_settings),profileId=settings.perDeck?.[deck.id]||settings.selectedProfile,base=settings.profiles.find(item=>item.id===profileId)||settings.profiles[0],profile=settings.deckProfiles?.[deck.id]?.[base.id]||base,overrides=settings.deckManualOverrides?.[deck.id]??settings.manualOverrides,results=R.evaluate(deck.cards||[],profile.rules,settings.countSections,overrides,settings.tagOverrides);
    requirementBox.replaceChildren(el('h3','Deck requirements'),el('p',profile.name,'hint'));
    if(!results.length){requirementBox.append(el('p','No requirements in this profile.','hint'));return;}
    const requirements=el('ul',null,'edh-deck-requirement-list');
    for(const rule of results){const min=Number(rule.min)||0,max=rule.max===null||rule.max===undefined||rule.max===''?null:Number(rule.max),ok=rule.count>=min&&(max===null||rule.count<=max),over=max!==null&&rule.count>max,row=el('li',null,ok?'good':over?'over':'low');row.append(el('span',rule.name,'edh-deck-requirement-name'),el('span',`${rule.count} / ${min}${max===null?'':'–'+max}`,'edh-deck-requirement-count'));requirements.append(row);}
    requirementBox.append(requirements);
   }catch{requirementBox.replaceChildren(el('h3','Deck requirements'),el('p','Requirements are unavailable.','hint'));}
  }).catch(()=>{if(aside.isConnected&&token===aside._generation)requirementBox.replaceChildren(el('h3','Deck requirements'),el('p','Requirements are unavailable.','hint'));});
  const list=el('ul',null,'edh-deck-list'),rows=deck.cards.filter(card=>['mainboard','commanders'].includes(card.section)).sort((a,b)=>(a.section==='commanders'?-1:0)-(b.section==='commanders'?-1:0)||a.name.localeCompare(b.name));let limit=20;
  const render=()=>{list.replaceChildren();for(const card of rows.slice(0,limit)){
   const row=el('li'),previewCard={...card,url:`https://edhrec.com/cards/${E.slug(card.name)}`},name=button(card.name,()=>inspect(view,previewCard),'edh-deck-card');
   name.addEventListener('mouseenter',()=>hoverArt(view,previewCard,name));name.addEventListener('mouseleave',hideHover);name.addEventListener('focus',()=>hoverArt(view,previewCard,name));name.addEventListener('blur',hideHover);
   row.append(el('span',`${card.qty}×`),name);if(card.section==='commanders')row.append(el('span','Commander','hint'));list.append(row);
  }};render();aside.append(list);
  if(rows.length>20){const more=button('Show more deck cards',()=>{limit=limit>20?20:limit+20;render();more.textContent=limit>20?'Show less':'Show more deck cards';more.setAttribute('aria-expanded',String(limit>20));});more.setAttribute('aria-expanded','false');aside.append(more);}
 }catch(error){if(aside.isConnected&&token===aside._generation){aside._onDeckChange?.(null);aside.replaceChildren(el('h3','Current deck'),el('p',error.message||'Deck preview unavailable.','hint'),button('Retry',()=>deckPreview(view,aside,true)));}}
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
  if(!details){section.append(el('p','Card details could not be loaded. The direct EDHREC links remain available.','hint'));return;}
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
function target(){
 if(/^\/decks\//.test(location.pathname)){
  const previews=[...document.querySelectorAll('[role="dialog"],.modal-content,.offcanvas.show,[data-card-preview],[class*="cardPreview"],[class*="card-preview"]')].filter(visible);
  for(const scope of previews.reverse()){
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
const nativeEDHREC=source=>!source.closest('.mrd-edhrec,.mrd-edh-launcher')&&/^(?:browse\s+)?edhrecs?(?:\s+(?:cards|recommendations))?$/i.test((source.textContent||'').trim().replace(/\s+/g,' '));
function matchSearchButton(source,target){
 const style=getComputedStyle(source);
 for(const property of ['font-family','font-size','font-weight','line-height','letter-spacing','color','text-transform'])target.style.setProperty(property,style.getPropertyValue(property));
 target.style.background='transparent';target.style.border='0';target.style.borderRadius='0';target.style.boxShadow='none';target.style.padding='0';target.style.minHeight='0';target.style.verticalAlign='baseline';target.style.textDecoration='underline';target.style.cursor='pointer';
}
function injectLaunchers(){
 const supported=/^\/(cards|decks)\//.test(location.pathname);
 for(const [source,host] of launchers){
  if(!supported||!source.isConnected||!nativeEDHREC(source)||!visible(source)){host.remove();launchers.delete(source);}
  else {if(source.nextSibling!==host)source.after(host);const styled=host.shadowRoot?.querySelector('button');if(styled)matchSearchButton(source,styled);}
 }
 if(!supported)return;
 for(const source of document.querySelectorAll('a,button,[role="button"]')){
  if(!nativeEDHREC(source)||!visible(source)||launchers.has(source))continue;
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
   const go=button('Browse cards',()=>{slug=null;load();});box.body.append(input,go,status,fallbackBox);
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
  });const separator=el('span',' · ');separator.setAttribute('aria-hidden','true');shadow.append(css,separator,open);matchSearchButton(source,open);source.after(host);launchers.set(source,host);
 }
}
function schedule(){if(featurePrefs?.mrd_features?.edhrec===false)return;if(timer===null)timer=setTimeout(update,150);}
const observer=new MutationObserver(records=>{
 if(!/^\/(cards|decks)\//.test(location.pathname)&&!current&&!launchers.size)return;
 records=records.filter(record=>record.type!=='attributes'||record.target.matches?.('button,a[href*="edhrec.com"],[role="dialog"],.modal,.modal-content,.offcanvas,[data-card-preview],[class*="cardPreview"],[class*="card-preview"]')||record.target.closest?.('[role="dialog"],.modal-content,.offcanvas,[data-card-preview],[class*="cardPreview"],[class*="card-preview"]'));
 if(records.some(r=>!r.target.closest?.('.mrd-edhrec,.mrd-edh-launcher')&&(r.type!=='childList'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===3||(n.nodeType===1&&!n.matches('.mrd-edhrec,.mrd-edh-launcher,#mrd-root,#mrd-sidebar'))))))schedule();
});
observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-hidden','class','alt']});
window.addEventListener('popstate',schedule);
window.addEventListener('message',event=>{if(event.source!==window||event.origin!==location.origin)return;if(event.data?.source==='mrd-route-v3')schedule();if(event.data?.source==='mrd-deck-response-v2'&&current?.data)contextStats(current,current.data);});
schedule();
})();
