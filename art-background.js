/* Resolve missing card art through Scryfall, serialized at <=2 requests/second. */
(()=>{
'use strict';
const cache=new Map(),pending=new Map();let queue=Promise.resolve();
browser.runtime.onMessage.addListener(message=>{
 if(!['mrd-card-art','mrd-card-printings'].includes(message?.type)||typeof message.name!=='string'||!message.name.trim()||message.name.length>160)return;
 const prints=message.type==='mrd-card-printings',page=message.page??1;
 const printingId=message.printingId;if(printingId!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(printingId))return;
 const printing=message.printing;if(printing&&(!/^[a-z0-9]{2,10}$/i.test(printing.set||'')||typeof printing.collectorNumber!=='string'||!printing.collectorNumber||printing.collectorNumber.length>30))return;
 if(prints&&(!Number.isInteger(page)||page<1||page>100))return;
 const name=message.name.trim(),key=prints?JSON.stringify([name,page,message.secretLair===true,message.isToken===true]):printingId?'printing:'+printingId:printing?'printing:'+printing.set+'/'+printing.collectorNumber:name,cached=cache.get(key);
 if(cached&&Date.now()-cached.time<(cached.result.ok&&(prints||cached.result.url)?86400000:60000))return Promise.resolve(cached.result);
 if(pending.has(key))return pending.get(key);
 const work=queue.then(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  let result;
  try{
   const query='!"'+name.split(' // ')[0].replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"'+(message.isToken===true?' t:token':'')+(message.secretLair===true?' (set:sld or set:slx or set:slc or set:slp)':'');
   const endpoint=prints?'https://api.scryfall.com/cards/search?'+new URLSearchParams({q:query,unique:'prints',order:'released',dir:'desc',include_extras:'true',page:String(page)}):printingId?'https://api.scryfall.com/cards/'+printingId:printing?'https://api.scryfall.com/cards/'+encodeURIComponent(printing.set)+'/'+encodeURIComponent(printing.collectorNumber):'https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name);
   const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json','User-Agent':'MoxfieldRequirements/1.9'}});
   if(prints&&response.status===404)result={ok:true,cards:[],hasMore:false,total:0};
   else {
    if(!response.ok)throw new Error(response.status===429?'Scryfall rate limit reached. Try again shortly.':'Card details unavailable.');
    const card=await response.json();
    if(prints){
     if(!Array.isArray(card.data))throw Error('Unrecognized printing response.');
     result={ok:true,cards:card.data.map(globalThis.MoxCardSearch.printing).filter(c=>c.id&&c.name&&c.url),hasMore:card.has_more===true&&page<100,total:Number.isFinite(card.total_cards)?card.total_cards:null};
    }else {const images=globalThis.MoxEDHREC.imageURLs(card),url=images[0]||null;
     result={ok:true,url,images,description:String(card.oracle_text||card.card_faces?.map(face=>face.oracle_text).filter(Boolean).join('\n')||'').trim(),manaCost:String(card.mana_cost||''),details:globalThis.MoxCardSearch?.metadata(card)};
    }
   }
  }catch(error){result={ok:false,error:error.name==='AbortError'?'Scryfall request timed out.':error.message};}
  finally{clearTimeout(timer);}
  if(cache.size>=300)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),result});
  return result;
 }).finally(()=>pending.delete(key));
 queue=work.then(()=>new Promise(resolve=>setTimeout(resolve,500)),()=>new Promise(resolve=>setTimeout(resolve,500)));
 pending.set(key,work);return work;
});
})();
