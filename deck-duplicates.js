/* Native More menu action with an explicit, freshly-read cleanup preview. */
(()=>{
'use strict';let timer,working=false;
const currentDeckID=()=>location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)\/?$/)?.[1]||null;
async function cleanup(button){
 if(working)return;working=true;button.disabled=true;
 try{const id=currentDeckID();if(!id)throw Error('Open the deck to clean up first.');
  const deck=await MoxDecks.preview(true);if(deck?.id!==id||currentDeckID()!==id)throw Error('The deck changed. Reopen cleanup on the intended deck.');
  const plan=MoxfieldPlusDuplicates.plan(deck.cards||[]);
  if(!plan.length){alert('No removable duplicates in the main deck. Basic lands and cards allowing multiple copies are preserved.');return;}
  if(plan.length>50)throw Error('More than 50 entries need cleanup. Reduce the list in Bulk Edit first.');
  const count=plan.reduce((n,r)=>n+r.from-r.to,0);
  if(!confirm('Remove '+count+' extra copies from the main deck? Keep one copy of each card across printings.\n\n'+plan.map(r=>r.name+': '+r.from+' → '+r.to).join('\n')))return;
  if(currentDeckID()!==id)throw Error('The deck changed. Reopen cleanup on the intended deck.');
  const result=await MoxDecks.removeDuplicates(plan,id);alert('Removed '+result.removed+' extra copies.');}
 catch(error){alert(error.message||'Could not remove duplicates.');}finally{working=false;button.disabled=false;}
}
function scan(){
 if(!/^\/decks\/[A-Za-z0-9_-]+\/?$/.test(location.pathname))return;
 for(const item of document.querySelectorAll('a,button,[role="menuitem"]')){
  if(item.closest('[data-mrd-owned]')||!/^Duplicate$/i.test(item.textContent.trim()))continue;
  const parent=item.parentElement;if(!parent||parent.querySelector('[data-mrd-owned="remove-duplicates"]'))continue;
  const button=document.createElement('button');button.type='button';button.textContent='Remove duplicates';button.className=item.className;button.setAttribute('data-mrd-owned','remove-duplicates');button.style.cssText='display:block;width:100%;text-align:left;color:inherit;background:transparent;border:0;padding:8px 14px;font:inherit;cursor:pointer';button.onclick=e=>{e.preventDefault();e.stopPropagation();cleanup(button);};item.after(button);
 }
}
new MutationObserver(records=>{if(records.every(r=>r.target.closest?.('[data-mrd-owned]')))return;clearTimeout(timer);timer=setTimeout(scan,100);}).observe(document.body,{childList:true,subtree:true});scan();
})();
