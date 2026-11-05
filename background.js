/* Read-only, bounded fallback requests; concurrent readers share one request. */
const pending=new Map();
const edhCache=new Map(),edhPending=new Map();
browser.runtime.onMessage.addListener((message,sender)=>{
 if(message?.type!=='mrd-open-pdf')return;
 if(!sender.tab?.id||!/^https:\/\/(www\.)?moxfield\.com\/decks\/[A-Za-z0-9_-]+\/?(?:[?#].*)?$/.test(sender.url||''))return Promise.resolve({ok:false,error:'Open a Moxfield deck first.'});
 return browser.tabs.create({url:browser.runtime.getURL('export.html')+'?tab='+sender.tab.id}).then(()=>({ok:true}),error=>({ok:false,error:error.message}));
});
browser.runtime.onMessage.addListener(message=>{
 if(message?.type!=='mrd-open-moxfield'||typeof message.name!=='string'||!message.name.trim()||message.name.length>160)return;
 return (async()=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  if(message.originalPrintings===true&&typeof message.cardId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(message.cardId)){await browser.tabs.create({url:'https://moxfield.com/cards/'+encodeURIComponent(message.cardId)+'?lemfield-printings=original'});return {ok:true};}
 const edition=message.originalPrintings===true?message.printing:null;if(edition&&(!/^[a-z0-9]{2,10}$/i.test(edition.set||'')||typeof edition.collectorNumber!=='string'||edition.collectorNumber.length>30))throw Error('Invalid source token edition.');
 const response=await fetch('https://api2.moxfield.com/v2/cards/search?q='+encodeURIComponent(message.name.trim()+(edition?' set:'+edition.set:''))+'&page=1',{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'}});
  if(!response.ok)throw Error(`Moxfield: HTTP ${response.status}`);
  const data=await (globalThis.MoxResponses?globalThis.MoxResponses.json(response):response.json()),key=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase();
  const card=(Array.isArray(data)?data:data.data||[]).find(c=>key(c.name)===key(message.name)&&(!edition||(key(typeof c.set==='object'?c.set?.code:c.set)===key(edition.set)&&String(c.cn??c.collector_number??c.collectorNumber??'')===edition.collectorNumber)));
  if(!card||! /^[A-Za-z0-9_-]+$/.test(card.id||''))throw Error('No exact card found on Moxfield.');
  await browser.tabs.create({url:'https://moxfield.com/cards/'+encodeURIComponent(card.id)+(message.originalPrintings===true?'?lemfield-printings=original':'')});
  return {ok:true};
 }catch(error){return {ok:false,error:error.name==='AbortError'?'Moxfield lookup timed out.':error.message};}
 finally{clearTimeout(timer);}
 })();
});
browser.runtime.onMessage.addListener(message=>{
 if(message?.type!=='mrd-scryfall-add'||typeof message.name!=='string'||!message.name.trim()||message.name.length>160)return;
 return (async()=>{
 const tabs=await browser.tabs.query({url:['https://moxfield.com/*','https://www.moxfield.com/*']});
 if(!tabs.length)return {ok:false,error:'Open Moxfield in another tab and sign in first.'};
 let lastError='Moxfield tab is not ready. Refresh it and try again.';
 for(const tab of tabs){try{return await browser.tabs.sendMessage(tab.id,{type:'mrd-add-external-card',name:message.name.trim()});}catch(error){lastError=error.message||lastError;}}
 return {ok:false,error:lastError};
 })();
});
browser.runtime.onMessage.addListener(message=>{
 if(message?.type!=='mrd-read-edhrec'||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(message.slug||'')||message.slug.length>180)return;
 const slug=message.slug,preferred=message.kind==='cards'?'cards':'commanders',key=preferred+':'+slug,cached=edhCache.get(key);
 if(cached&&!(message.retry===true&&!cached.result.ok)&&Date.now()-cached.time<(cached.ttl||60*60*1000))return Promise.resolve(cached.result);
 if(edhPending.has(key))return edhPending.get(key);
 const request=(async()=>{
  let page=null,kind=preferred,blocked=false,limited=false;
  for(const candidate of [preferred,preferred==='cards'?'commanders':'cards']){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetch('https://json.edhrec.com/pages/'+candidate+'/'+slug+'.json',{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'}});
    if(response.status===429){limited=true;break;}
    if(response.status===403){blocked=true;break;}
    if(!response.ok)continue;
    page=await (globalThis.MoxResponses?globalThis.MoxResponses.json(response):response.json());kind=candidate;break;
   }catch{/* A bounded public-page fallback follows network or parsing failures. */}
   finally{clearTimeout(timer);}
  }
  const fallbackURL='https://edhrec.com/'+kind+'/'+slug;
  if(limited)return {ok:false,code:'rate_limited',error:'EDHREC is limiting requests. Try again later or browse EDHREC directly.',url:fallbackURL};
  let data;
  try{if(page)data=globalThis.MoxEDHREC.normalize(page,kind,slug);}catch{}
  if(!data)data={name:slug.replace(/-/g,' '),kind,url:fallbackURL,image:null,rank:null,tags:[],categories:[],allCards:[],cards:[],popularCommanders:[],numDecks:null,inclusion:null,source:'html'};
  if(!data.allCards.length||!data.cards.length||!data.tags?.length||!data.categories?.some(category=>/new[\s_-]*cards/i.test(category.name||'')||/new[\s_-]*cards/i.test(category.id||''))||(kind==='cards'&&!data.popularCommanders?.length)||(kind==='commanders'&&(data.rank===null||!data.tags.length))){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetch(data.url,{signal:controller.signal,credentials:'omit',headers:{Accept:'text/html'}});
    if(response.status===403)blocked=true;if(response.status===429)limited=true;
    if(response.ok){
     const html=await (globalThis.MoxResponses?globalThis.MoxResponses.text(response):response.text());
     if(globalThis.MoxHTML)data=await globalThis.MoxHTML.supplement(data,html,kind,slug);
     else {
     const embedded=globalThis.MoxEDHREC.pageFromHTML(html);
     if(data.source==='html'&&embedded){try{data=globalThis.MoxEDHREC.normalize(embedded,kind,slug);data.source='html';}catch{}}
     globalThis.MoxEDHREC.supplementHTML(data,html);
     }
    }
   }catch{/* Keep any usable JSON data and direct browsing links. */}
   finally{clearTimeout(timer);}
  }
  if(data.source==='html'&&!data.allCards.length&&!data.popularCommanders?.length)return {ok:false,code:limited?'rate_limited':blocked?'blocked':'unavailable',error:limited?'EDHREC is limiting requests. Try again later.':blocked?'EDHREC declined the extension request. You can still browse this card directly.':'EDHREC data could not be loaded here. Browse this card directly.',url:data.url};
  return {ok:true,data};
 })().catch(()=>({ok:false,code:'unavailable',error:'EDHREC data could not be loaded here. Browse this card directly.',url:'https://edhrec.com/'+preferred+'/'+slug})).then(result=>{
  if(edhCache.size>=100)edhCache.delete(edhCache.keys().next().value);edhCache.set(key,{time:Date.now(),ttl:result.ok?3600000:30000,result});return result;
 }).finally(()=>edhPending.delete(key));
 edhPending.set(key,request);return request;
});
browser.runtime.onMessage.addListener(message=>{
 if(message?.type!=='mrd-read-deck'||! /^[A-Za-z0-9_-]{3,100}$/.test(message.id||''))return;
 if(pending.has(message.id))return pending.get(message.id);
 const request=(async()=>{const failures=[];
  for(const version of ['v3','v2']){
   const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetch(`https://api2.moxfield.com/${version}/decks/all/${encodeURIComponent(message.id)}`,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'}});
    if(!response.ok){failures.push(`${version}: HTTP ${response.status}`);if([401,403,429].includes(response.status))break;continue;}
    const data=await (globalThis.MoxResponses?globalThis.MoxResponses.json(response):response.json());if(data?.boards||data?.mainboard||data?.mainBoard||data?.commanders)return {ok:true,data};failures.push(`${version}: unexpected structure`);
   }catch(e){failures.push(`${version}: ${e.name==='AbortError'?'request timed out':e.message}`);}
   finally{clearTimeout(timer);}
  }
  return {ok:false,error:failures.join('; ')};
 })().finally(()=>pending.delete(message.id));
 pending.set(message.id,request);return request;
});
