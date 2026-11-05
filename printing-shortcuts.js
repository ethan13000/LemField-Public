/* Route native printing gestures to the searchable extension picker. */
 (async()=>{
'use strict';
const featurePrefs=await browser.storage.local.get('mrd_features');const enabled=featurePrefs?.mrd_features?.printing!==false;let replaying=false;
let context=null;
const owned=node=>node?.closest?.('[data-mrd-owned],.mrd-edhrec,.mrd-edh-launcher,#mrd-root,#mrd-sidebar');
const clean=value=>String(value||'').replace(/^card (?:art|image) (?:for|of)\s+/i,'').replace(/\s+\([A-Z0-9]{2,8}\)\s*#?\d+.*$/,'').trim();
function namedCard(name,target){
 const scope=target.closest?.('.deckview-image-wrapper,[data-card-id],tr,[role="row"],.card-item,.cardItem')||target;
 const image=target.matches?.('img')?target:scope.querySelector?.('img');
 const original=image?.dataset?.mrdOriginalSrc||image?.src||'',id=scope.dataset?.mrdSourceCardId||scope.getAttribute?.('data-card-id')||original.match(/\/card-([A-Za-z0-9_-]+)-(?:normal|large|small)\./)?.[1];
 return {name,...(id&&/^[A-Za-z0-9_-]+$/.test(id)?{cardId:id}:{})};
}
function cardAt(target){
 if(!target?.closest||owned(target))return null;
 const named=target.closest('[data-card-name]');
 if(named){const name=clean(named.getAttribute('data-card-name'));if(name&&name.length<=160)return namedCard(name,target);}
 // Stay within the nearest card row/tile; never take another card from the page.
 const anchor=target.closest('a[href*="/cards/"]');
 const scope=anchor||target.closest('[data-card-id],[data-card],tr,[role="row"],.card-item,.cardItem,.card-grid-item,.cardGridItem')||target;
 const cardLink=anchor||scope.querySelector?.('a[href*="/cards/"]');
 const image=target.matches?.('img[alt]')?target:scope.querySelector?.('img[alt]');
 const label=scope.querySelector?.('[data-card-name]');
 let name=clean(label?.getAttribute('data-card-name')||cardLink?.textContent||image?.alt);
 if(!name)for(let parent=target.parentElement,depth=0;parent&&parent!==document.body&&depth<5;parent=parent.parentElement,depth++){
  if(owned(parent)||parent.matches?.('main,[role="menu"],.dropdown-menu'))break;
  const links=[...parent.querySelectorAll('a[href*="/cards/"]')];
  const names=[...new Set(links.map(link=>clean(link.textContent||link.querySelector('img[alt]')?.alt)).filter(Boolean))];
  if(names.length>1)break;
  if(names.length===1){name=names[0];break;}
 }
 if(!name||name.length>160||/^(?:card (?:art|image)|printings?|versions?|editions?)$/i.test(name))return null;
 return namedCard(name,target);
}
const supported=()=>/^\/(?:decks|cards)\//.test(location.pathname);
const cancel=event=>{event.preventDefault();event.stopImmediatePropagation();};
function shortcut(event){
 if(!enabled||replaying||event.altKey||!supported()||event.button!==0||!event.ctrlKey||!event.shiftKey||!globalThis.MoxPrintings)return;
 const card=cardAt(event.target);if(!card)return;
 cancel(event);if(event.type==='click'){context=null;globalThis.MoxPrintings.open({...card,nativeTarget:event.target});}
}
for(const type of ['pointerdown','mousedown','click','dblclick'])window.addEventListener(type,shortcut,true);
window.addEventListener('contextmenu',event=>{
 context=supported()?cardAt(event.target):null;if(context)context.nativeTarget=event.target;
 // Let Moxfield display its own context menu; replace only its Printings action.
},true);
window.addEventListener('click',event=>{
 if(!enabled||replaying||event.altKey||!supported()||owned(event.target)||!globalThis.MoxPrintings)return;
 const action=event.target.closest?.('[role="menuitem"],.dropdown-item,.react-contexify__item,.react-contextmenu-item,[data-radix-collection-item],button,a');
 const label=(action?.getAttribute('aria-label')||action?.textContent||'').trim().replace(/\s+/g,' ').replace(/\s*(?:ctrl|control|⌃)\s*\+?\s*(?:shift|⇧).*$/i,'').trim();
 if(!/^(?:(?:view|browse|change|switch(?:ing)?|select|choose|other|all)\s+)?printings?(?:\s*\(\d+\))?$/i.test(label)){context=null;return;}
 const menu=action.closest('[role="menu"],.dropdown-menu,[data-radix-menu-content]');
 const card=menu&&context?context:cardAt(action)||context;
 if(!card)return;
 cancel(event);context=null;
 // Dismiss the native menu without invoking its printing action.
 if(menu){const escape=new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true});action.dispatchEvent(escape);}
 globalThis.MoxPrintings.open(card);
},true);
window.addEventListener('popstate',()=>{context=null;});
window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.source==='mrd-route-v3')context=null;});
function nativeTarget(card){
 const matches=node=>{const found=cardAt(node);return node?.isConnected!==false&&clean(found?.name).toLowerCase()===clean(card.name).toLowerCase()&&(!card.cardId||found?.cardId===card.cardId);};
 if(card.nativeTarget&&matches(card.nativeTarget))return card.nativeTarget;
 return [...document.querySelectorAll('[data-card-name],a[href*="/cards/"],img[alt]')].find(matches)||null;
}
function replay(target){
 replaying=true;
 try{for(const type of ['mousedown','mouseup','click'])target.dispatchEvent(new MouseEvent(type,{button:0,ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true,composed:true,view:window}));}
 finally{replaying=false;}
}
async function openOriginal(card,beforeOpen=()=>{}){
 const target=nativeTarget(card);
 if(target){beforeOpen();replay(target);return {openedHere:true};}
 const result=await browser.runtime.sendMessage({type:'mrd-open-moxfield',name:card.name,originalPrintings:true,...(card.cardId&&/^[A-Za-z0-9_-]{1,100}$/.test(card.cardId)?{cardId:card.cardId}:{}),...(card.set&&card.collectorNumber?{printing:{set:card.set,collectorNumber:String(card.collectorNumber)}}:{})});
 if(!result?.ok)throw Error(result?.error||'Could not open the original selector.');
 beforeOpen();return {openedHere:false};
}
globalThis.MoxPrintingShortcuts={cardAt,openOriginal};
// A recommendation absent from the native page opens its original picker on a card tab.
if(/^\/cards\//.test(location.pathname)&&new URLSearchParams(location.search||'').get('lemfield-printings')==='original'){
 let done=false,observer,timer;
 const attempt=()=>{
  if(done)return;
  const action=[...document.querySelectorAll('button,a,[role="menuitem"]')].find(node=>!owned(node)&&/^(?:(?:view|browse|change|switch|select|choose|other|all)\s+)?printings?$/i.test((node.getAttribute('aria-label')||node.textContent||'').trim())&&node.getClientRects().length);
  const name=clean(document.querySelector('h1')?.textContent).toLowerCase();
  const target=action||[...document.querySelectorAll('main img[alt]')].find(node=>name&&clean(cardAt(node)?.name).toLowerCase()===name&&!owned(node)&&node.getClientRects().length);
  if(!target)return;
  done=true;observer?.disconnect();clearTimeout(timer);replaying=true;
  try{if(action)action.click();else replay(target);}finally{replaying=false;}
 };
 observer=new MutationObserver(attempt);observer.observe(document.documentElement,{childList:true,subtree:true});timer=setTimeout(()=>{done=true;observer.disconnect();},15000);attempt();
}

})();
