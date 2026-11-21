/* Checkboxes on native text-list card rows and a reviewed bulk-action toolbar. */
(()=>{
 'use strict';
 const model=globalThis.MoxDeckSelection,make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const deckID=()=>location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)\/?$/)?.[1]||null;
 const clean=name=>String(name||'').normalize('NFKC').trim().toLowerCase();
 const selected=new Map(),controls=new Map(),groups=new Map();let id=null,raw=null,busy=false,loading=false,epoch=0,timer=null,bar=null,status=null,count=null,destinationPicker=null,actionButtons=[],feedback=null;
 const modernEditor=()=>document.querySelectorAll('[data-testid="deck-view-table-row"],[data-testid="deck-view-options-group-by"]').length>0;
 const ignored='[data-mrd-owned],#mrd-root,#mrd-sidebar,[role="dialog"],dialog,[role="menu"],.dropdown-menu,.mrd-edhrec';
 const checkboxStyle=make('style');checkboxStyle.setAttribute('data-mrd-owned','deck-selection-style');
 checkboxStyle.textContent=`
 [data-mrd-owned="deck-select-checkbox"] input[type="checkbox"] {
  appearance:none!important;-moz-appearance:none!important;box-sizing:border-box!important;
  width:16px!important;height:16px!important;min-width:16px;margin:0!important;padding:0!important;
  border:1px solid #66596f!important;border-radius:3px!important;background:#222!important;
  display:inline-block;vertical-align:middle;cursor:pointer;box-shadow:none!important;
 }
 [data-mrd-owned="deck-select-checkbox"] input[type="checkbox"]:checked {
  border-color:#731fa1!important;background-color:#731fa1!important;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8l3 3 6-6' fill='none' stroke='%23fff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")!important;
  background-position:center!important;background-size:14px 14px!important;background-repeat:no-repeat!important;
 }
 [data-mrd-owned="deck-select-checkbox"] input[type="checkbox"]:hover {border-color:#934fba!important;}
 [data-mrd-owned="deck-select-checkbox"] input[type="checkbox"]:indeterminate {
  border-color:#731fa1!important;background-color:#731fa1!important;
  background-image:linear-gradient(white,white)!important;background-size:8px 2px!important;background-position:center!important;background-repeat:no-repeat!important;
 }
 [data-mrd-owned="deck-select-checkbox"] input[type="checkbox"]:focus-visible {outline:2px solid transparent;outline-offset:2px;box-shadow:0 0 0 3px #731fa166!important;}
 [data-mrd-owned="deck-select-checkbox"] input[type="checkbox"]:disabled {opacity:.45;cursor:default;}
 `;document.body.append(checkboxStyle);
 function clearControls(){for(const control of controls.values())control.label.remove();controls.clear();for(const group of groups.values())group.label.remove();groups.clear();}
 function update(){
  if(!bar)return;
  bar.hidden=selected.size===0;bar.style.display=selected.size?'flex':'none';
  const text=selected.size+' selected';if(count.textContent!==text)count.textContent=text;
  for(const {input,row} of controls.values()){input.checked=selected.has(model.key(row));input.disabled=busy||!raw;}
  for(const {input,members} of groups.values()){
   const amount=members.filter(row=>selected.has(model.key(row))).length;
   input.checked=amount===members.length&&amount>0;input.indeterminate=amount>0&&amount<members.length;input.disabled=busy||loading||!raw||!members.length;
   input.setAttribute('aria-checked',input.indeterminate?'mixed':String(input.checked));
  }
  actionButtons.forEach(button=>{button.disabled=busy||loading||!raw||!selected.size;});destinationPicker.disabled=busy||loading;
  status.hidden=!status.textContent;
 }
 function button(label,handler){const b=make('button',label);b.type='button';b.onclick=handler;b.style.cssText='font:inherit;padding:6px 10px;border:1px solid #9970ac;border-radius:4px;background:#623478;color:white;cursor:pointer';return b;}
 function toolbar(){
  if(bar?.isConnected)return;
  bar=make('section');bar.setAttribute('data-mrd-owned','deck-selection');bar.setAttribute('aria-label','Selected deck cards');
  bar.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483600;box-sizing:border-box;max-width:calc(100vw - 32px);width:max-content;display:none;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px;padding:12px 16px;border:1px solid #735286;border-radius:12px;background:#262329;color:#eee;box-shadow:0 8px 28px #0008;font:14px/1.4 system-ui,sans-serif';
  count=make('strong','0 selected');count.title='All copies of each selected printing';count.style.cssText='white-space:nowrap;margin-right:6px';
  destinationPicker=make('select');destinationPicker.setAttribute('aria-label','Move selected cards to');destinationPicker.style.cssText='font:inherit;color:#eee;background:#322b38;border:1px solid #735286;border-radius:5px;padding:6px 10px;min-height:34px';
  for(const [value,label] of [['sideboard','Sideboard'],['mainboard','Main deck'],['maybeboard','Considering']]){const option=make('option',label);option.value=value;destinationPicker.append(option);}destinationPicker.value='sideboard';
  const select=button('Select listed',()=>{if(busy||loading||!raw)return;for(const {row} of controls.values())selected.set(model.key(row),row);status.textContent='Each checkbox selects all copies of that printing.';update();});
  const clear=button('Clear',()=>{if(busy)return;selected.clear();status.textContent='';update();});clear.style.background='transparent';
  const move=button('Move to',()=>apply('move',destinationPicker.value));
  const remove=button('Remove selected',()=>apply('remove',null));remove.style.cssText+=';background:#432a32;border-color:#925666';
  actionButtons=[move,remove,select,clear];
  const moveGroup=make('span');moveGroup.style.cssText='display:inline-flex;gap:6px;align-items:center';moveGroup.append(move,destinationPicker);
  status=make('span');status.setAttribute('role','status');status.style.cssText='flex-basis:100%;max-width:640px;text-align:center;color:#d5c5df';
  bar.append(count,select,moveGroup,remove,clear,status);document.body.append(bar);update();
 }
 function notify(text){
  feedback?.remove();feedback=make('div');feedback.setAttribute('data-mrd-owned','deck-selection-feedback');feedback.setAttribute('role','status');
  feedback.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483600;box-sizing:border-box;max-width:calc(100vw - 32px);display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid #735286;border-radius:10px;background:#262329;color:#eee;box-shadow:0 8px 28px #0008;font:14px/1.4 system-ui,sans-serif';
  const close=button('Dismiss',()=>feedback?.remove());feedback.append(make('span',text),close);document.body.append(feedback);
 }
 async function apply(operation,destination){
  if(busy||loading||!selected.size)return;const activeID=id;let started=false,completed=0;
  try{
   if(deckID()!==activeID)throw Error('The deck changed. Select its cards again.');
   const plan=model.plan(raw,[...selected.values()],operation,destination,1000),copies=plan.entries.reduce((sum,row)=>sum+row.quantity,0);
   const action=operation==='remove'?'Remove selected cards from their boards':'Move to '+({'mainboard':'main deck','sideboard':'sideboard','maybeboard':'considering'}[destination]);
   if(!window.confirm(action+'? '+copies+' copies across '+plan.entries.length+' entries.\n\n'+plan.entries.map(row=>row.quantity+' × '+row.name).join('\n')+'\n\nAll copies of each selected printing are included.'))return;
   started=true;busy=true;update();status.textContent='Applying reviewed selection…';
   for(let offset=0;offset<plan.entries.length;offset+=20){
    status.textContent='Updating entries '+(offset+1)+'–'+Math.min(offset+20,plan.entries.length)+' of '+plan.entries.length+'…';
    const result=await globalThis.MoxDecks.bulkSelection({...plan,entries:plan.entries.slice(offset,offset+20)},activeID);completed+=result.acknowledged;
   }
   selected.clear();clearControls();notify(completed+' entries updated. Refresh the page to update Moxfield’s native list.');
  }catch(error){if(started)notify((completed?completed+' entries completed before this batch stopped. ':'')+error.message);else {status.textContent=error.message;update();}}
  finally{if(started){busy=false;selected.clear();raw=null;update();if(deckID()!==id)refresh();}/* Fresh read required after writes; no automatic retry. */}
 }
 function resolve(anchor,available,allRows){
  const native=anchor.closest('[data-testid="deck-view-table-row"]');
  if(native){
   const identity=model.nativeIdentity(native.getAttribute('data-row-key'),native.getAttribute('data-hash'));
   if(!identity)return null;
   const matches=available.filter(row=>model.key(row)===model.key(identity));return matches.length===1?matches[0]:null;
  }
  const name=anchor.getAttribute('data-card-name')||anchor.textContent.trim();
  const scope=anchor.closest('[data-card-id]'),explicit=scope?.getAttribute('data-card-id');
  if(allRows.filter(row=>explicit?row.id===explicit:model.matchesName(row,name)).length!==1)return null;
  const matches=available.filter(row=>explicit?row.id===explicit:model.matchesName(row,name));return matches.length===1?matches[0]:null;
 }
 function scanGroups(){
  // Follow rendered group boundaries, rather than guessing membership from card types/tags.
  const headingText=node=>node.textContent.replace(/\s+/g,' ').trim();
  const nativeMode=modernEditor();
  const candidates=[...document.querySelectorAll(nativeMode?'[data-testid="deck-view-header-options-title"]':'h1,h2,h3,h4,h5,h6,[role="heading"],a,button,div,span,strong')].filter(node=>!node.closest(ignored)&&(nativeMode||/^.{1,100}\s*\(\s*\d+\s*\)\s*[▾▼⌄]?\s*$/.test(headingText(node)))&&!node.querySelector('a[href*="/cards/"],[data-card-name]'));
  const headings=candidates.filter(node=>!candidates.some(other=>other!==node&&node.contains(other))).map(node=>({node,anchor:node.closest('button,a,[role="button"]')||node}));
  const seen=new Set();
  for(const {node,anchor} of headings){
   if(seen.has(anchor))continue;
   let container=nativeMode?anchor.closest('ul'):anchor.parentElement,entries=[];
   if(nativeMode){if(container)entries=[...controls].filter(([entry])=>entry.closest('ul')===container);}
   else for(let depth=0;container&&container!==document.body&&depth<8;depth++,container=container.parentElement){
    entries=[...controls].filter(([entry])=>container.contains(entry));if(entries.length)break;
   }
   if(!entries.length)continue;
   const follows=(a,b)=>!!(a.compareDocumentPosition(b)&4);
   const following=headings.filter(h=>h.anchor!==anchor&&container.contains(h.anchor)&&follows(anchor,h.anchor));
   const members=[...new Map(entries.filter(([entry])=>follows(anchor,entry)&&!following.some(h=>follows(h.anchor,entry))).map(([,control])=>[model.key(control.row),control.row])).values()];
   if(!members.length)continue;
   seen.add(anchor);let group=groups.get(anchor);
   if(!group){
    const label=make('span'),input=make('input');label.setAttribute('data-mrd-owned','deck-select-checkbox');label.setAttribute('data-mrd-group-select','');label.style.cssText='display:inline-flex;align-items:center;margin-right:7px;flex:0 0 auto';input.type='checkbox';input.setAttribute('aria-label','Select all cards in '+headingText(node));
    for(const type of ['pointerdown','mousedown','click','dblclick'])label.addEventListener(type,event=>event.stopPropagation());
    group={label,input,members};input.onchange=event=>{event.stopPropagation();if(busy||loading||!raw)return;for(const row of group.members){if(input.checked)selected.set(model.key(row),row);else selected.delete(model.key(row));}status.textContent='';update();};
    label.append(input);anchor.before(label);groups.set(anchor,group);
   }else {group.members=members;if(!group.label.isConnected||group.label.nextElementSibling!==anchor)anchor.before(group.label);}
   group.input.setAttribute('aria-label','Select all cards in '+headingText(node));
  }
  for(const [anchor,group] of groups)if(!anchor.isConnected||!seen.has(anchor)){group.label.remove();groups.delete(anchor);}
 }
 function scan(){
  if(!id||deckID()!==id||!raw||busy)return;
  toolbar();const allRows=model.rows(raw),available=allRows,seen=new Set();
  const nativeEntries=[...document.querySelectorAll('[data-testid="deck-view-table-row"]')];
  const anchors=modernEditor()?nativeEntries.map(entry=>entry.querySelector('[data-testid="deck-view-table-row-name"]')||entry.querySelector('a[href*="/cards/"],[data-card-name]')).filter(Boolean):document.querySelectorAll('a[href*="/cards/"],[data-card-name]');
  for(const anchor of anchors){
   if(anchor.closest(ignored)||anchor.querySelector('img'))continue;
   const row=resolve(anchor,available,allRows);if(!row)continue;
   // Require a local native row action so unrelated card links are never selectable.
   const native=anchor.closest('[data-testid="deck-view-table-row"]');
   let parent=anchor.parentElement,entry=native;
   if(!native)for(let depth=0;parent&&parent!==document.body&&depth<4;depth++,parent=parent.parentElement){
    const names=[...parent.querySelectorAll('a[href*="/cards/"],[data-card-name]')].map(node=>clean(node.getAttribute('data-card-name')||node.textContent)).filter(Boolean);
    if(names.some(name=>!model.matchesName(row,name)))break;
    if(parent.querySelector('button,[role="button"]')){entry=parent;break;}
   }
   if(!entry||seen.has(entry))continue;seen.add(entry);
   const identity=model.key(row);let control=controls.get(entry);
   if(control&&model.key(control.row)!==identity){control.label.remove();controls.delete(entry);control=null;}
   if(!control){
    const label=make('span'),input=make('input');label.setAttribute('data-mrd-owned','deck-select-checkbox');label.style.cssText='display:inline-flex;align-items:center;margin-right:7px;flex:0 0 auto';input.type='checkbox';input.setAttribute('aria-label','Select '+row.quantity+' × '+row.name+' from '+row.section);
    for(const type of ['pointerdown','mousedown','click','dblclick'])label.addEventListener(type,event=>event.stopPropagation());
    input.onchange=event=>{event.stopPropagation();if(input.checked)selected.set(identity,row);else selected.delete(identity);status.textContent='';update();};
    label.append(input);anchor.before(label);control={label,input,row};controls.set(entry,control);
   }else {control.row=row;if(!control.label.isConnected)anchor.before(control.label);}
  }
  for(const [entry,control] of controls)if(!entry.isConnected||!seen.has(entry)){control.label.remove();controls.delete(entry);}
  scanGroups();update();
 }
 async function refresh(){
  const next=deckID();if(busy)return;
  const run=++epoch;selected.clear();clearControls();raw=null;
  if(next!==id){bar?.remove();bar=null;feedback?.remove();}id=next;if(!id)return;
  toolbar();loading=true;update();
  try{const data=await globalThis.MoxDecks.readCurrent();if(run!==epoch||deckID()!==next)return;raw=data;status.textContent='';}
  catch(error){if(run===epoch)status.textContent=error.message;}
  finally{if(run===epoch){loading=false;scan();update();}}
 }
 function schedule(){if(timer!==null)return;timer=setTimeout(()=>{timer=null;if(deckID()!==id)refresh();else scan();},150);}
 new MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('[data-mrd-owned]')))schedule();}).observe(document.body,{subtree:true,childList:true});
 window.addEventListener('popstate',refresh);window.addEventListener('mrd-current-deck-updated',refresh);
 window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.source==='mrd-route-v3')refresh();});
 refresh();
})();
