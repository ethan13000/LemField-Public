/* Read-only totals on Moxfield's Your Decks table. */
(()=>{
'use strict';
const description='Main deck + commanders, including multiple copies. Excludes sideboard, considering, companions, and tokens.';
const cache=new Map(),pending=new Map(),queue=[];let running=0,timer=null,epoch=0;
function deckLinkID(href){
 try{const url=new URL(href,location.href);return url.origin===location.origin?url.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)\/?$/)?.[1]||null:null;}catch{return null;}
}
function listingTables(){
 if(![...document.querySelectorAll('h1,h2')].some(node=>/^your decks$/i.test(node.textContent.trim())))return [];
 return [...document.querySelectorAll('table')].filter(table=>{const labels=[...table.querySelectorAll('thead th')].map(cell=>cell.textContent.trim().toLowerCase());return labels.includes('name')&&labels.includes('format')&&labels.includes('updated');});
}
function fresh(id){const item=cache.get(id);return item&&Date.now()-item.time<(item.error?30000:300000)?item:null;}
function show(cell,item){
 const text=item?item.error?'�':String(item.count):'�',title=item?.error?'Card count unavailable: '+item.error:description;
 if(cell.textContent!==text)cell.textContent=text;if(cell.title!==title)cell.title=title;
}
function schedule(){clearTimeout(timer);timer=setTimeout(scan,100);}
function drain(){
 while(running<2&&queue.length){
  const job=queue.shift();if(!job.row.isConnected||job.epoch!==epoch){if(pending.get(job.id)===job)pending.delete(job.id);continue;}
  running++;
  Promise.resolve().then(()=>globalThis.MoxDecks.cardCount(job.id)).then(count=>{if(!Number.isSafeInteger(count)||count<0)throw Error('Invalid card count.');if(job.epoch===epoch)cache.set(job.id,{count,time:Date.now()});},error=>{if(job.epoch===epoch)cache.set(job.id,{error:String(error.message||'Request failed'),time:Date.now()});}).catch(error=>{if(job.epoch===epoch)cache.set(job.id,{error:error.message,time:Date.now()});}).finally(()=>{running--;if(pending.get(job.id)===job)pending.delete(job.id);if(cache.size>300)cache.delete(cache.keys().next().value);schedule();drain();});
 }
}
function scan(){
 for(const table of listingTables()){
  const header=table.querySelector('thead tr');if(!header)continue;
  const nativeHeaders=[...header.cells].filter(cell=>!cell.hasAttribute('data-mrd-card-count')),name=nativeHeaders.find(cell=>cell.textContent.trim().toLowerCase()==='name');if(!name)continue;
  let heading=header.querySelector('[data-mrd-card-count]');if(!heading){heading=document.createElement('th');heading.dataset.mrdCardCount='';heading.textContent='Cards';heading.scope='col';heading.title=description;heading.className=name.className;heading.style.cssText='width:80px;white-space:nowrap';header.insertBefore(heading,name.nextSibling);}
  const position=nativeHeaders.indexOf(name)+1;
  for(const row of table.querySelectorAll('tbody tr')){
   if(row.closest('table')!==table)continue;
   let cell=row.querySelector('[data-mrd-card-count]');const nativeCells=[...row.cells].filter(value=>!value.hasAttribute('data-mrd-card-count'));
   // Folder and empty-state rows sometimes span the entire table.
   const spanning=nativeCells.find(value=>value.colSpan>1);
   if(spanning){if(!spanning.hasAttribute('data-mrd-original-colspan')){spanning.dataset.mrdOriginalColspan=String(spanning.colSpan);spanning.colSpan++;}continue;}
   const links=[...row.querySelectorAll('a[href]')],id=links.map(link=>deckLinkID(link.href)).find(Boolean);
   if(!cell){cell=document.createElement('td');cell.dataset.mrdCardCount='';cell.className=nativeCells[position]?.className||name.className;cell.style.cssText='white-space:nowrap;font-variant-numeric:tabular-nums';row.insertBefore(cell,nativeCells[position]||null);}
   if(!id){if(cell.textContent)cell.textContent='';if(cell.title)cell.title='';delete cell.dataset.deckId;continue;}
   cell.dataset.deckId=id;const item=fresh(id);show(cell,item);
   const rect=row.getBoundingClientRect();
   if(!item&&!pending.has(id)&&rect.bottom>=0&&rect.top<=window.innerHeight){const job={id,row,epoch};pending.set(id,job);queue.push(job);}
  }
 }
 drain();
}
function invalidate(){epoch++;cache.clear();queue.length=0;pending.clear();schedule();}
window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.source==='mrd-route-v3')invalidate();});
window.addEventListener('popstate',invalidate);window.addEventListener('mrd-current-deck-updated',invalidate);
window.addEventListener('scroll',schedule,{passive:true,capture:true});window.addEventListener('resize',schedule);window.addEventListener('focus',schedule);
const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});scan();
})();
