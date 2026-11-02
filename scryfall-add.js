/* Add the displayed Scryfall card to one of the signed-in user's Moxfield decks. */
 (async()=>{
'use strict';
const featurePrefs=await browser.storage.local.get('mrd_features');if(featurePrefs?.mrd_features?.scryfall===false)return;
if(!/^\/card\//.test(location.pathname)||document.getElementById('mrd-scryfall-add'))return;
const cardName=()=>{
 const heading=document.querySelector('h1.card-text-title,.card-text-title,h1');
 return (heading?.textContent||'').replace(/\s+/g,' ').trim();
};
const install=()=>{
 const name=cardName();if(!name)return;
 let button=document.getElementById('mrd-scryfall-add');if(button){button.dataset.card=name;return;}
 const style=document.createElement('style');style.textContent='#mrd-scryfall-add-row{display:block;position:relative;clear:both;width:100%;box-sizing:border-box;margin:12px 0 4px;padding:0;z-index:1}#mrd-scryfall-add{appearance:none;display:inline-block;position:static;vertical-align:middle;border:1px solid #a970d1;border-radius:6px;background:#70418d;color:#fff;padding:9px 14px;font:600 14px/1.2 system-ui,sans-serif;cursor:pointer;margin:0 6px 0 0}#mrd-scryfall-add:hover{background:#8754a4}#mrd-scryfall-add:disabled{opacity:.65;cursor:wait}#mrd-scryfall-status{display:inline-block;vertical-align:middle;margin:6px;font:13px/1.4 system-ui,sans-serif;color:inherit}';document.documentElement.append(style);
 button=document.createElement('button');button.id='mrd-scryfall-add';button.type='button';button.textContent='Add to Moxfield deck';button.dataset.card=name;
 const row=document.createElement('div');row.id='mrd-scryfall-add-row';const status=document.createElement('span');status.id='mrd-scryfall-status';status.setAttribute('role','status');
 button.addEventListener('click',async()=>{button.disabled=true;status.textContent='Connecting to Moxfield…';try{const result=await browser.runtime.sendMessage({type:'mrd-scryfall-add',name:button.dataset.card});if(!result?.ok)throw new Error(result?.error||'Could not add card.');status.textContent=`Added ${result.card} to ${result.deck}.`;}catch(error){status.textContent=error.message||'Could not connect to Moxfield.';}finally{button.disabled=false;}});
 const open=document.createElement('button');open.id='mrd-scryfall-open';open.type='button';open.textContent='Open in Moxfield';
 open.style.cssText='border:1px solid #a970d1;border-radius:6px;background:#70418d;color:white;padding:9px 14px;font:600 14px/1.2 system-ui,sans-serif;cursor:pointer';
 open.addEventListener('click',async()=>{open.disabled=true;status.textContent='Finding card on Moxfield…';try{const result=await browser.runtime.sendMessage({type:'mrd-open-moxfield',name:button.dataset.card});if(!result?.ok)throw Error(result?.error||'Could not open Moxfield.');status.textContent='Opened in Moxfield.';}catch(error){status.textContent=error.message;}finally{open.disabled=false;}});
 const box=document.querySelector('.card-text-box');
 const anchor=box||document.querySelector('.card-text-title')?.parentElement||document.querySelector('h1')?.parentElement||document.querySelector('main');if(!anchor)return;row.append(button,open,status);anchor.append(row);
};
install();new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
})();
