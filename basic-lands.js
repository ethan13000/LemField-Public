/* Add a chosen set of legal basics beside Moxfield's Lands heading. */
(()=>{
'use strict';
const make=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
let timer=null,dialog=null,busy=false;
const launchers=new Map();
const deckId=()=>location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)\/?$/)?.[1];
async function openMenu(opener){
 if(dialog){dialog.dismiss?.();return;}const id=deckId();if(!id)return;
 const box=make('div');dialog=box;box.setAttribute('role','dialog');box.setAttribute('data-mrd-owned','basic-lands');box.setAttribute('aria-label','Add basic lands');
 box.style.cssText='position:fixed;z-index:2147483647;box-sizing:border-box;background:#262329;color:#eee;border:1px solid #9970ac;border-radius:8px;padding:16px;width:360px;max-width:calc(100vw - 16px);overflow:auto;box-shadow:0 8px 28px #0008;font:14px/1.4 sans-serif';
 const heading=make('h2','Add basic lands'),hint=make('p','Choose how many copies to add to the main deck.'),list=make('div'),status=make('p','Loading legal basic lands…'),submit=make('button','Add selected lands'),close=make('button','Close');
 heading.style.cssText='font-size:20px;margin:0 0 8px';hint.style.margin='0 0 12px';
 status.setAttribute('role','status');submit.disabled=true;box.append(heading,hint,list,status,submit,close);document.body.append(box);opener.setAttribute('aria-expanded','true');
 const position=()=>{if(!opener.isConnected||deckId()!==id){dismiss();return;}const rect=opener.getBoundingClientRect();box.style.left=Math.max(8,Math.min(rect.left,innerWidth-box.offsetWidth-8))+'px';box.style.top=Math.max(8,Math.min(rect.bottom+6,innerHeight-100))+'px';box.style.maxHeight=Math.max(80,innerHeight-parseFloat(box.style.top)-8)+'px';};
 const outside=event=>{if(!box.contains(event.target)&&!opener.contains(event.target))dismiss();},escape=event=>{if(event.key==='Escape'){event.preventDefault();dismiss();opener.focus();}};
 const dismiss=()=>{if(busy)return;box.remove();if(dialog===box)dialog=null;opener.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);window.removeEventListener('scroll',position,true);window.removeEventListener('resize',position);};
 box.dismiss=dismiss;close.onclick=dismiss;document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);window.addEventListener('scroll',position,true);window.addEventListener('resize',position);position();
 const rows=[];
 try{
  const deck=await globalThis.MoxDecks.preview();if(deck?.id!==id||deckId()!==id)throw Error('The deck changed. Close and reopen this menu.');
  const commanders=deck.cards.filter(c=>c.section==='commanders'&&c.qty>0),format=String(deck.format).toLowerCase().replace(/[^a-z]/g,'');
  const commanderFormat=['commander','oathbreaker','brawl','historicbrawl','duel','duelcommander','paupercommander'].includes(format)||commanders.length>0;
  if(commanderFormat&&(!commanders.length||commanders.some(c=>!c.colorIdentityKnown)))throw Error('Commander colors are not available yet. Refresh the deck and try again.');
  const colors=[...new Set(commanders.flatMap(c=>c.colors.split('')))].join('');
  const query='t:basic'+(format&&format!=='custom'?' f:'+({duelcommander:'duel',historicbrawl:'brawl'}[format]||format):'')+(commanderFormat?' id<='+(colors||'c'):'');
  const reply=await browser.runtime.sendMessage({type:'mrd-role-cards',query,page:1});if(!reply?.ok)throw Error(reply?.error||'Could not load legal basic lands.');
  if(!box.isConnected)return;
  const active=deck.cards.filter(c=>['mainboard','commanders'].includes(c.section)&&c.qty>0);
  const needsSnow=active.some(c=>/\bsnow\b|\{S\}/i.test(c.type+' '+c.name+' '+c.oracle));
  const needsColorless=commanderFormat&&!colors||active.some(c=>/\{C\}/.test(c.oracle));
  const extra=make('details'),extraLabel=make('summary','Other legal basics');extra.append(extraLabel);list.append(extra);
  for(const card of (reply.cards||[]).filter(c=>/\bbasic\b/i.test(c.type)).sort((a,b)=>a.name.localeCompare(b.name))){
   const row=make('div'),label=make('label',card.name),minus=make('button','−'),input=make('input'),plus=make('button','+');
   row.style.cssText='display:flex;align-items:center;gap:8px;margin:10px 0';label.style.flex='1';input.type='number';input.min='0';input.max='999';input.step='1';input.value='0';input.style.width='70px';input.setAttribute('aria-label',card.name+' copies');
   minus.setAttribute('aria-label','Fewer '+card.name);plus.setAttribute('aria-label','More '+card.name);
   const update=()=>{submit.disabled=busy||!rows.some(r=>Number(r.input.value)>0)||rows.some(r=>!r.input.validity.valid||r.input.value==='');};
   minus.onclick=()=>{input.value=String(Math.max(0,(Number(input.value)||0)-1));update();};plus.onclick=()=>{input.value=String(Math.min(999,(Number(input.value)||0)+1));update();};input.oninput=update;
   const supplemental=/snow/i.test(card.name)&&!needsSnow||/wastes/i.test(card.name)&&!needsColorless;
   row.append(label,minus,input,plus);if(supplemental)extra.append(row);else list.insertBefore(row,extra);rows.push({name:card.name,input});
  }
  if(extra.children.length===1)extra.remove();
  for(const button of box.querySelectorAll('button')){button.type='button';button.style.cssText='background:#623478;color:#fff;border:1px solid #9970ac;border-radius:4px;padding:5px 9px;cursor:pointer;margin-right:4px';}position();
  status.textContent=rows.length?'Amounts are additional copies, not deck totals.':'No legal basic lands found.';
 }catch(error){status.textContent=error.message;}
 submit.onclick=async()=>{
  if(busy||submit.disabled)return;if(deckId()!==id){status.textContent='The deck changed. Close and reopen this menu.';return;}
  const selected=rows.filter(r=>Number(r.input.value)>0);if(rows.some(r=>!r.input.validity.valid))return;
  busy=true;submit.disabled=true;close.disabled=true;for(const control of list.querySelectorAll('input,button'))control.disabled=true;
  try{
   for(const row of selected){if(deckId()!==id)throw Error('The deck changed. Remaining lands were not added.');status.textContent='Adding '+row.input.value+' '+row.name+'…';await globalThis.MoxDecks.add({name:row.name},id,'mainboard',Number(row.input.value));row.input.value='0';}
   status.textContent='Selected lands added. Refresh the page to update Moxfield’s list.';
  }catch(error){status.textContent=error.message+' Completed entries are cleared. Check the deck before retrying.';}
  finally{busy=false;close.disabled=false;/* Require reopening after any write to avoid uncertain retries. */}
 };
}
function scan(){
 if(!deckId())dialog?.dismiss?.();
 const deckView=document.querySelector('.deckview[aria-labelledby="section-decklist-header"]');
 const modern=!!deckView||!!document.querySelector('[data-testid="deck-menu-playtest"],[data-testid="deck-menu-more-toggle"]');
 const inScope=node=>!modern||!!deckView?.contains(node);
 const isLabel=node=>/^Lands\s*\(\s*\d+\s*\)\s*[▾▼⌄]?$/i.test(node.textContent.replace(/\s+/g,' ').trim());
 for(const [anchor,button] of launchers)if(!deckId()||!anchor.isConnected||!inScope(anchor)||!isLabel(anchor)){button.remove();launchers.delete(anchor);}
 if(!deckId()||modern&&!deckView)return;
 const labels=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"],div,span,a,button,strong')].filter(node=>inScope(node)&&!node.closest('[data-mrd-owned],#mrd-root,#mrd-sidebar')&&isLabel(node));
 for(const label of labels){
  // Moxfield also uses ordinary dropdown labels instead of semantic headings.
  if(labels.some(other=>other!==label&&label.contains(other)))continue;
  const anchor=label.closest('button,a,[role="button"]')||label;
  let button=launchers.get(anchor);
  if(button){if(!button.isConnected||anchor.nextElementSibling!==button)anchor.after(button);continue;}
  button=make('button','Add basic lands');button.type='button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');button.setAttribute('data-mrd-owned','basic-lands-button');button.style.cssText='display:inline-block;margin-left:12px;padding:4px 9px;font-size:13px;font-weight:normal;border:1px solid #9970ac;border-radius:4px;background:#623478;color:white;cursor:pointer';button.onclick=event=>{event.preventDefault();event.stopPropagation();openMenu(button);};anchor.after(button);launchers.set(anchor,button);
 }
}
function schedule(){if(timer!==null)return;timer=setTimeout(()=>{timer=null;scan();},150);}
new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('[data-mrd-owned]')))schedule();}).observe(document.body,{subtree:true,childList:true});window.addEventListener('popstate',schedule);window.addEventListener('mrd-current-deck-updated',schedule);scan();
})();
