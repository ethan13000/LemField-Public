/* Read-only page bridge. No request headers, credentials, or deck edits. */
(()=>{
'use strict';
if(window.__mrdBridgeInstalled)return;
window.__mrdBridgeInstalled=true;
const deckId=()=>location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)/)?.[1];
const urlId=url=>{try{const u=new URL(String(url),location.href);return /^https:\/\/api2?\.moxfield\.com$/i.test(u.origin)?u.pathname.match(/^\/v[23]\/decks\/all\/([A-Za-z0-9_-]+)\/?$/)?.[1]:null;}catch{return null;}};
let cached=null;
function publish(data,url){
 const id=deckId();
 if(!id||urlId(url)!==id||!data||typeof data!=='object'||!(data.boards||data.mainboard||data.mainBoard||data.commanders))return;
 cached={source:'mrd-deck-response-v2',id,deck:data};
 window.postMessage(cached,location.origin);
}
window.addEventListener('message',e=>{
 if(e.source===window&&e.origin===location.origin&&e.data?.source==='mrd-ready-v1'&&cached?.id===deckId())window.postMessage(cached,location.origin);
 if(e.source===window&&e.origin===location.origin&&['mrd-deck-add-complete-v1','mrd-deck-printing-complete-v1'].includes(e.data?.source)&&e.data.id===deckId())showDeckRefreshNotice();
});
const originalFetch=window.fetch;
function showDeckRefreshNotice(){
 let banner=document.getElementById('mrd-deck-refresh-notice');if(banner)return;
 const main=document.querySelector('main')||document.body;
 const names=/^(view|group|sort|tags?)$/i;
 const controls=[...main.querySelectorAll('button,select,[role="combobox"],label')].filter(node=>names.test((node.getAttribute('aria-label')||node.getAttribute('title')||node.textContent||'').trim()));
 let listTop=null;
 for(const control of controls){for(let node=control.parentElement;node&&node!==main;node=node.parentElement){if(controls.filter(other=>node.contains(other)).length>=3){listTop=node;break;}}if(listTop)break;}
 if(!listTop){const search=main.querySelector('input[type="search"],[placeholder*="Search" i],[aria-label*="Search" i]');listTop=search?.parentElement?.nextElementSibling||search?.parentElement?.parentElement||main;}
 banner=document.createElement('div');banner.id='mrd-deck-refresh-notice';banner.setAttribute('role','status');
 Object.assign(banner.style,{boxSizing:'border-box',width:'100%',padding:'12px 16px',margin:'0 0 12px',background:'#8f2635',color:'#fff',border:'1px solid #c65d68',borderRadius:'5px',font:'600 14px/1.4 system-ui,sans-serif',position:'relative',zIndex:'1000'});
 const message=document.createElement('span');message.textContent='Deck updated. If the list does not refresh automatically, refresh this page.';
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh now';Object.assign(refresh.style,{marginLeft:'12px',padding:'6px 10px',border:'1px solid #fff8',borderRadius:'4px',background:'#fff',color:'#651b28',font:'600 13px system-ui,sans-serif',cursor:'pointer'});refresh.addEventListener('click',()=>location.reload());
 banner.append(message,refresh);listTop.parentNode.insertBefore(banner,listTop);
}
window.fetch=function(...args){
 const response=originalFetch.apply(this,args);
 try{const url=args[0] instanceof URL?args[0].href:typeof args[0]==='string'?args[0]:args[0]?.url;
  if(urlId(url))response.then(res=>{if(res.ok)res.clone().json().then(data=>publish(data,url)).catch(()=>{});}).catch(()=>{});
 }catch{}
 return response;
};
const requests=new WeakMap(), originalOpen=XMLHttpRequest.prototype.open,originalSend=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(method,url,...rest){requests.set(this,String(method).toUpperCase()==='GET'&&urlId(url)?String(url):null);return originalOpen.call(this,method,url,...rest);};
XMLHttpRequest.prototype.send=function(...args){
 const url=requests.get(this);
 if(url)this.addEventListener('load',()=>{if(this.status>=200&&this.status<300)try{publish(this.responseType==='json'?this.response:JSON.parse(this.responseText),url);}catch{}},{once:true});
 return originalSend.apply(this,args);
};
for(const name of ['pushState','replaceState']){
 const original=history[name];history[name]=function(...args){const old=location.pathname;const result=original.apply(this,args);if(old!==location.pathname){cached=null;window.postMessage({source:'mrd-route-v3'},location.origin);}return result;};
}
})();
