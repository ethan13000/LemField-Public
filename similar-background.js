/* Similar cards come from EDHREC's dedicated screen, not from co-occurrence. */
(()=>{
'use strict';
const cache=new Map(),pending=new Map();
browser.runtime.onMessage.addListener(message=>{
 if(message?.type!=='mrd-similar-edhrec'||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(message.slug||'')||message.slug.length>180)return;
 const key=message.slug,cached=cache.get(key);if(cached&&!(message.retry===true&&!cached.result.ok)&&Date.now()-cached.time<(cached.ttl||3600000))return Promise.resolve(cached.result);if(pending.has(key))return pending.get(key);
 const request=(async()=>{
  const url=`https://edhrec.com/cards/${key}/similar-cards`;let cards=[],blocked=false;
  for(const [endpoint,json] of [[`https://json.edhrec.com/pages/cards/${key}/similar-cards.json`,true],[url,false]]){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit',headers:{Accept:json?'application/json':'text/html'}});
    if(!response.ok){if(response.status===429)return {ok:false,code:'rate_limited',error:'EDHREC is limiting requests. Try again later.',url};if(response.status===403)blocked=true;continue;}
    if(response.url){const actual=new URL(response.url),expected=new URL(endpoint);if(actual.origin!==expected.origin||actual.pathname.replace(/\/$/,'')!==expected.pathname.replace(/\/$/,''))continue;}
    cards=json?globalThis.MoxEDHREC.similar(await (globalThis.MoxResponses?globalThis.MoxResponses.json(response):response.json())):globalThis.MoxHTML?await globalThis.MoxHTML.similar(await (globalThis.MoxResponses?globalThis.MoxResponses.text(response):response.text())):globalThis.MoxEDHREC.similarHTML(await (globalThis.MoxResponses?globalThis.MoxResponses.text(response):response.text()));
    cards=cards.filter(card=>card.key!==key);if(cards.length)break;
   }catch{/* Try the rendered Similar Cards page if the data endpoint is absent. */}
   finally{clearTimeout(timer);}
  }
  if(!cards.length)return {ok:false,code:blocked?'blocked':'unavailable',error:blocked?'EDHREC declined the extension request. Open Similar cards on EDHREC to browse directly.':'Similar-card data could not be loaded here. Browse EDHREC directly.',url};
  const result={ok:true,cards,url};if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),result});return result;
 })().then(result=>{if(!result.ok){if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),ttl:30000,result});}return result;}).finally(()=>pending.delete(key));pending.set(key,request);return request;
});
})();
