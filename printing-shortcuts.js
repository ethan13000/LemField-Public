/* Route native printing gestures to the searchable extension picker. */
 (async()=>{
'use strict';
const featurePrefs=await browser.storage.local.get('mrd_features');if(featurePrefs?.mrd_features?.printing===false)return;
let context=null;
const owned=node=>node?.closest?.('[data-mrd-owned],.mrd-edhrec,.mrd-edh-launcher,#mrd-root,#mrd-sidebar');
const clean=value=>String(value||'').replace(/^card (?:art|image) (?:for|of)\s+/i,'').replace(/\s+\([A-Z0-9]{2,8}\)\s*#?\d+.*$/,'').trim();
function cardAt(target){
 if(!target?.closest||owned(target))return null;
 const named=target.closest('[data-card-name]');
 if(named){const name=clean(named.getAttribute('data-card-name'));if(name&&name.length<=160)return {name};}
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
 return {name};
}
const supported=()=>/^\/(?:decks|cards)\//.test(location.pathname);
const cancel=event=>{event.preventDefault();event.stopImmediatePropagation();};
function shortcut(event){
 if(!supported()||event.button!==0||!event.ctrlKey||!event.shiftKey||!globalThis.MoxPrintings)return;
 const card=cardAt(event.target);if(!card)return;
 cancel(event);if(event.type==='click'){context=null;globalThis.MoxPrintings.open(card);}
}
for(const type of ['pointerdown','mousedown','click','dblclick'])window.addEventListener(type,shortcut,true);
window.addEventListener('contextmenu',event=>{
 context=supported()?cardAt(event.target):null;
 // Let Moxfield display its own context menu; replace only its Printings action.
},true);
window.addEventListener('click',event=>{
 if(!supported()||owned(event.target)||!globalThis.MoxPrintings)return;
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
globalThis.MoxPrintingShortcuts={cardAt};
})();
