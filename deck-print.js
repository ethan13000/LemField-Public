/* Open the sheet exporter from Moxfield's deck page. */
(async()=>{
'use strict';
const prefs=await browser.storage.local.get('mrd_features');if(prefs?.mrd_features?.pdf===false)return;
const button=document.createElement('button');button.type='button';button.textContent='Print';button.id='mrd-deck-print';button.setAttribute('data-mrd-owned','');
const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('width','20');icon.setAttribute('height','20');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.8');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');icon.setAttribute('aria-hidden','true');icon.style.flexShrink='0';
const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M6 9V3h12v6M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6zM18 12h.01');icon.append(path);
const caption=document.createElement('span');caption.textContent='Print';button.replaceChildren(icon,caption);
button.addEventListener('mouseenter',()=>{caption.style.textDecoration='underline';});
button.addEventListener('mouseleave',()=>{caption.style.textDecoration='none';});
icon.style.verticalAlign='-0.125em';icon.style.marginRight='7px';
function matchButton(source){
 button.className=source.className;
 const style=getComputedStyle(source);
 for(const property of ['display','align-items','justify-content','gap','box-sizing','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-transform','text-decoration','color','background-color','background-image','border-top','border-right','border-bottom','border-left','border-radius','box-shadow','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','height','min-height','vertical-align','transition'])button.style.setProperty(property,style.getPropertyValue(property));
 button.style.cursor='pointer';button.style.whiteSpace='nowrap';
 button.style.display='inline-flex';button.style.alignItems='center';button.style.verticalAlign='middle';button.style.gap='8px';icon.style.marginRight='0';
}
button.addEventListener('click',async()=>{
 button.disabled=true;
 try{const reply=await browser.runtime.sendMessage({type:'mrd-open-pdf'});if(!reply?.ok)throw Error(reply?.error||'Could not open PDF export.');}
 catch(error){button.title=error.message;}
 finally{button.disabled=false;}
});
function place(){
 if(!/^\/decks\/[A-Za-z0-9_-]+\/?$/.test(location.pathname)){button.remove();return;}
 const main=document.querySelector('main')||document.body;
 const actions=[...main.querySelectorAll('button,a,[role="button"]')].filter(node=>node!==button&&node.getClientRects().length&&!node.closest('[data-mrd-owned],.mrd-edhrec,.mrd-edh-launcher,.dropdown-menu,[role="menu"]'));
 const label=node=>(node.textContent||node.getAttribute('aria-label')||node.getAttribute('title')||'').replace(/\s+/g,' ').trim();
 const native=actions.find(node=>/^playtest\b/i.test(label(node)))||actions.find(node=>/^buy deck\b/i.test(label(node)))||actions.find(node=>/^primer$/i.test(label(node)));
 if(native){
  matchButton(native);
  const last=actions.find(node=>/^buy deck\b/i.test(label(node)))||native;
  if(button.previousElementSibling!==last)last.after(button);
  // Keep breathing room on both sides, including inside native dropdown wrappers.
  button.style.marginLeft='24px';
  button.style.marginRight='0';
 }else button.remove();
}
let timer=null;
const schedule=()=>{if(timer!==null)return;timer=setTimeout(async()=>{timer=null;place();},150);};
new MutationObserver(records=>{if(records.some(record=>record.target!==button))schedule();}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('popstate',schedule);
window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.source==='mrd-route-v3')schedule();});
place();
})();
