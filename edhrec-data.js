/* Lift is a ratio, never a synergy percentage. */
(()=>{
'use strict';
const number=v=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const slug=name=>String(name).split(' // ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-');
const safeURL=(value,fallback)=>{try{const u=new URL(value||fallback,'https://edhrec.com');return u.origin==='https://edhrec.com'&&/^\/(cards|commanders|tags|themes)\//.test(u.pathname)?u.href:null;}catch{return null;}};
const imageURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['cards.scryfall.io','card-images.edhrec.com','cloudflare.edhrec.com','assets.moxfield.net'].includes(u.hostname)?u.href:null;}catch{return null;}};
const validCardName=name=>{const key=String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');return !!key&&!['cardrecs','charts','cardrecommendations','similarcards','viewmore','showmore'].includes(key);};
function imageURLs(view){
 const candidates=[];
 const add=value=>{if(typeof value==='string')candidates.push(value);else if(Array.isArray(value))value.forEach(add);else if(value&&typeof value==='object')for(const size of ['normal','large','png','small'])add(value[size]);};
 add(view.image);add(view.image_uri);add(view.image_uris);add(view.images);for(const face of view.card_faces||[])add(face.image_uris);
 return [...new Set(candidates.map(imageURL).filter(Boolean))];
}
function image(view){return imageURLs(view)[0]||null;}
function synergy(view){
 return number(view.synergy_percent)??number(String(view.label||'').match(/([+-]?[\d.]+)\s*%\s*synergy/i)?.[1])??(number(view.synergy)!==null?100*number(view.synergy):null);
}
function popularCommanders(dict){
 const rawGroups=dict.cardlists||[],groups=(Array.isArray(rawGroups)?rawGroups:Object.values(rawGroups||{})).filter(list=>/commander/i.test(list.tag||list.header||''));
 const preferred=groups.filter(list=>/top|popular/i.test(list.tag||list.header||'')),unique=new Map();
 for(const list of preferred.length?preferred:groups)for(const view of (Array.isArray(list.cardviews)?list.cardviews:Object.values(list.cardviews||{}))){
  if(!validCardName(view.name))continue;
  const url=safeURL(view.url,`/commanders/${view.sanitized||slug(view.name)}`);if(!url||!new URL(url).pathname.startsWith('/commanders/'))continue;
  const key=slug(view.name),numDecks=number(view.num_decks),potential=number(view.potential_decks);
  if(!unique.has(key))unique.set(key,{key,name:view.name,url,image:image(view),numDecks,potentialDecks:potential,inclusion:potential>0&&numDecks!==null?100*numDecks/potential:null,synergy:synergy(view)});
 }
 return [...unique.values()];
}
function normalize(data,kind,key){
 const dict=data?.container?.json_dict;
 if(!dict||!dict.card)throw new Error('EDHREC returned an unfamiliar page format.');
 const card=dict.card, unique=new Map(),categories=[];
 const rawLists=dict.cardlists||[],lists=Array.isArray(rawLists)?rawLists:Object.values(rawLists||{});
 for(const list of lists){
  if(/commander/i.test(list.tag||list.header||''))continue;
  const tag=String(list.tag||''),header=String(list.header||''),category={id:String(list.tag||slug(header||'cards')),name:/new[\s_-]*cards/i.test(tag)?'New Cards':header||'Cards',keys:[]};
  const cardviews=Array.isArray(list.cardviews)?list.cardviews:Object.values(list.cardviews||{});
  for(const view of cardviews){
   if(!validCardName(view.name)||/^\/commanders\//.test(view.url||''))continue;
   const lift=number(view.lift)??number(String(view.label||'').match(/([\d.]+)\s*(?:x\s*)?lift/i)?.[1]);
   const url=safeURL(view.url,`/cards/${view.sanitized||slug(view.name)}`);
   if(!url)continue;
   const id=slug(view.name),numDecks=number(view.num_decks),potential=number(view.potential_decks);
   const inclusion=potential>0&&numDecks!==null?100*numDecks/potential:number(String(view.label||'').match(/([\d.]+)%/)?.[1]);
   const row={key:id,name:view.name,lift,synergy:synergy(view),url,image:image(view),inclusion,numDecks,potentialDecks:potential,type:String(view.type||view.primary_type||''),manaValue:number(view.cmc),tags:[category.name,...(Array.isArray(view.tags)?view.tags:[])].map(t=>typeof t==='string'?t:t?.name).filter(Boolean)};
   if(!unique.has(id))unique.set(id,row);
   else {const old=unique.get(id);old.tags=[...new Set([...old.tags,...row.tags])];for(const [key,value] of Object.entries(row))if(old[key]===null||old[key]==='')old[key]=value;}
   category.keys.push(id);
  }
  if(category.keys.length)categories.push(category);
 }
 const rank=kind==='commanders'?(number(card.rank)??number(String(card.label||'').match(/rank\s*#?\s*([\d,]+)/i)?.[1]?.replace(/,/g,''))):null;
 const tags=[],seenTags=new Set(),rawPanels=data.panels?.links||[],panels=Array.isArray(rawPanels)?rawPanels:Object.values(rawPanels||{});
 for(const panel of panels){
  if(!/tag|theme/i.test([panel.header,panel.title,panel.tag].filter(Boolean).join(' ')))continue;
  const rawItems=panel.items||panel.links||panel.cardviews||[],items=Array.isArray(rawItems)?rawItems:Object.values(rawItems||{});
  for(const item of items){const url=safeURL(item.href||item.url||item.path);const name=item.value||item.name||item.label;if(name&&url&&!seenTags.has(url)){seenTags.add(url);tags.push({name:String(name),count:item.count??item.num_decks??null,url});}}
 }
 const allCards=[...unique.values()],numDecks=number(card.num_decks),potential=number(card.potential_decks);
 return {name:card.name||key,kind,url:`https://edhrec.com/${kind}/${key}`,image:image(card),rank,tags,categories,allCards,popularCommanders:popularCommanders(dict),numDecks,inclusion:potential>0&&numDecks!==null?100*numDecks/potential:null,cards:allCards.filter(c=>c.lift!==null).sort((a,b)=>b.lift-a.lift||a.name.localeCompare(b.name))};
}
function supplementHTML(data,html){
 const doc=new DOMParser().parseFromString(html,'text/html');
 doc.querySelectorAll('script,style,nav,footer').forEach(el=>el.remove());
 const rank=doc.body.textContent.match(/#\s*([\d,]+)\s*Rank/i);
 if(data.kind==='commanders'&&data.rank===null&&rank)data.rank=number(rank[1].replace(/,/g,''));
 if(!data.tags.length){
  const label=[...doc.querySelectorAll('h1,h2,h3,h4,h5,span,div,strong')].find(el=>el.textContent.replace(/\s+/g,' ').trim().toLowerCase()==='popular tags');
  const commanderSlug=data.kind==='commanders'?new URL(data.url).pathname.split('/').filter(Boolean)[1]:null;
  const isTagURL=url=>{const parts=new URL(url).pathname.split('/').filter(Boolean);return parts[0]==='tags'||parts[0]==='themes'||(commanderSlug&&parts.length===3&&parts[0]==='commanders'&&parts[1]===commanderSlug);};
  const collect=scope=>[...scope.querySelectorAll('a[href]')].map(a=>({name:a.textContent.trim(),url:safeURL(a.getAttribute('href'))})).filter(tag=>tag.name&&tag.url&&isTagURL(tag.url));
  for(let scope=label?.parentElement,depth=0;scope&&depth<6;scope=scope.parentElement,depth++){
   const links=collect(scope);if(links.length){data.tags=[...new Map(links.map(tag=>[tag.url,tag])).values()];break;}
  }
 }
 const original=new Map((data.allCards||data.cards||[]).map(c=>[slug(c.name),c]));
 const cards=new Map(data.cards.map(c=>[slug(c.name),c]));
 for(const link of doc.querySelectorAll('a[href^="/cards/"]')){
  const item=link.closest('li');
  if(!item||new Set([...item.querySelectorAll('a[href^="/cards/"]')].map(a=>a.getAttribute('href'))).size!==1)continue;
  const lift=number(item.textContent.match(/([\d.]+)\s*(?:x\s*)?Lift/i)?.[1]);
  const name=link.textContent.trim(),url=safeURL(link.getAttribute('href'));
  if(validCardName(name)&&url){
   const key=slug(name),previous=original.get(key)||cards.get(key)||{};
   const inclusion=number(item.textContent.match(/([\d.]+)\s*%\s*Inclusion/i)?.[1]);
   const deckMatch=item.textContent.match(/([\d,.]+)\s*([KMB])?\s*Decks/i);
   const deckCount=deckMatch?number(deckMatch[1].replace(/,/g,''))*({K:1e3,M:1e6,B:1e9}[deckMatch[2]?.toUpperCase()]||1):null;
   if(lift!==null||inclusion!==null||deckCount!==null){
    const row={...previous,key,name,lift:lift??previous.lift??null,synergy:previous.synergy??number(item.textContent.match(/([+-]?[\d.]+)\s*%\s*synergy/i)?.[1]),url,image:previous.image||imageURL(item.querySelector('img')?.src),inclusion:previous.inclusion??inclusion,numDecks:previous.numDecks??deckCount,potentialDecks:previous.potentialDecks??null};
    original.set(key,row);if(row.lift!==null)cards.set(key,row);
   }
  }
 }
 data.cards=[...cards.values()].sort((a,b)=>b.lift-a.lift||a.name.localeCompare(b.name));
 const all=new Map(original);
 for(const card of data.cards)all.set(card.key||slug(card.name),{...all.get(card.key||slug(card.name)),...card});
 data.allCards=[...all.values()];
 const headings=[...doc.querySelectorAll('h2,h3,h4,h5')],newHeading=headings.find(heading=>/^new cards$/i.test(heading.textContent.trim()));
 if(newHeading){const headingIndex=headings.indexOf(newHeading),nextHeading=headings[headingIndex+1],keys=[];
  for(const anchor of doc.querySelectorAll('li a[href^="/cards/"]')){
   if(!(newHeading.compareDocumentPosition(anchor)&4)||(nextHeading&&!(anchor.compareDocumentPosition(nextHeading)&4)))continue;
   const name=anchor.textContent.trim(),url=safeURL(anchor.getAttribute('href'));if(!validCardName(name)||!url)continue;keys.push(slug(name));
  }
  if(keys.length){data.categories=data.categories||[];let category=data.categories.find(item=>/new[\s_-]*cards/i.test(item.name||'')||/new[\s_-]*cards/i.test(item.id||''));if(!category){category={id:'newcards',name:'New Cards',keys:[]};data.categories.push(category);}category.keys=[...new Set([...(category.keys||[]),...keys])];}
 }
 const commanders=new Map((data.popularCommanders||[]).map(c=>[c.key||slug(c.name),c]));
 for(const anchor of doc.querySelectorAll('a[href^="/commanders/"]')){
  const item=anchor.closest('li'),name=anchor.textContent.trim(),url=safeURL(anchor.getAttribute('href'));
  if(!item||!name||!url||new URL(url).pathname.split('/').filter(Boolean).length!==2)continue;
  const links=item.querySelectorAll('a[href^="/commanders/"]');if(new Set([...links].map(a=>a.getAttribute('href'))).size!==1)continue;
  const key=slug(name);if(commanders.has(key))continue;
  const decks=item.textContent.match(/([\d,.]+)\s*([KMB])?\s*Decks/i);
  commanders.set(key,{key,name,url,image:imageURL(item.querySelector('img')?.src),inclusion:number(item.textContent.match(/([\d.]+)\s*%\s*Inclusion/i)?.[1]),numDecks:decks?Number(decks[1].replace(/,/g,''))*({K:1e3,M:1e6,B:1e9}[decks[2]?.toUpperCase()]||1):null,synergy:number(item.textContent.match(/([+-]?[\d.]+)\s*%\s*synergy/i)?.[1])});
 }
 data.popularCommanders=[...commanders.values()];
 return data;
}
function browse(data,{category='top',sort='inclusion',query=''}={}){
 let rows=[...(data.allCards||data.cards||[])];
 if(category==='lift')rows=rows.filter(c=>c.lift!==null&&c.lift!==undefined);
 else if(category!=='all'&&category!=='top'){
  const keys=new Set(data.categories?.find(c=>c.id===category)?.keys||[]);rows=rows.filter(c=>keys.has(c.key||slug(c.name)));
 }else if(category==='top'){
  const top=data.categories?.find(c=>/^topcards$/i.test(c.id));
  if(top){const keys=new Set(top.keys);rows=rows.filter(c=>keys.has(c.key||slug(c.name)));}
 }
 const term=query.trim().toLowerCase();if(term)rows=rows.filter(c=>c.name.toLowerCase().includes(term));
 const field=category==='lift'?'lift':sort;
 rows.sort((a,b)=>field==='name'?a.name.localeCompare(b.name):(b[field]??-Infinity)-(a[field]??-Infinity)||a.name.localeCompare(b.name));
 return rows;
}
function commanderInclusion(data,name){
 const row=(data.allCards||data.cards||[]).find(card=>slug(card.name)===slug(name));
 return row?{inclusion:row.inclusion??null,numDecks:row.numDecks??null,potentialDecks:row.potentialDecks??null,lift:row.lift??null}:null;
}
function similar(data){
 const dict=data?.container?.json_dict||{},rawGroups=dict.cardlists||data?.cardlists||[],groups=Array.isArray(rawGroups)?rawGroups:Object.values(rawGroups||{}),rows=groups.flatMap(group=>Array.isArray(group?.cardviews)?group.cardviews:[]);
 if(Array.isArray(dict.cardviews))rows.push(...dict.cardviews);
 for(const list of [data?.similar_cards,data?.similar,dict.similar_cards,dict.similar])if(Array.isArray(list))rows.push(...list);
 if(!rows.length){const queue=[data];let inspected=0;while(queue.length&&inspected++<5000){const value=queue.shift();if(!value||typeof value!=='object')continue;if(Array.isArray(value.cardviews))rows.push(...value.cardviews);for(const child of Object.values(value))if(child&&typeof child==='object')queue.push(child);}}
 const unique=new Map();
 for(const view of rows){
  if(!validCardName(view?.name)||/^\/commanders\//.test(view.url||''))continue;
  const key=slug(view.name),url=safeURL(view.url,`/cards/${view.sanitized||key}`);if(!url)continue;
  const numDecks=number(view.num_decks),potentialDecks=number(view.potential_decks),inclusion=number(view.inclusion)??(potentialDecks>0&&numDecks!==null?100*numDecks/potentialDecks:number(String(view.label||'').match(/([\d.]+)%/)?.[1])),lift=number(view.lift)??number(String(view.label||'').match(/([\d.]+)\s*(?:x\s*)?lift/i)?.[1]);
  unique.set(key,{key,name:view.name,url,image:image(view),inclusion,numDecks,potentialDecks,lift});
 }
 return [...unique.values()];
}
function pageFromHTML(html){
 const doc=new DOMParser().parseFromString(html,'text/html');
 for(const script of doc.querySelectorAll('script#__NEXT_DATA__,script[type="application/json"]')){
  if(script.textContent.length>6000000)continue;
  try{
   const queue=[JSON.parse(script.textContent)];let inspected=0;
   while(queue.length&&inspected++<2000){const value=queue.shift();if(!value||typeof value!=='object')continue;
    if(value.container?.json_dict)return value;
    if(value.json_dict?.card||value.json_dict?.cardlists)return {container:value};
    for(const child of Object.values(value))if(child&&typeof child==='object')queue.push(child);
   }
  }catch{/* Embedded JSON is optional; never execute page scripts. */}
 }
 return null;
}
function similarHTML(html){
 const embedded=pageFromHTML(html);if(embedded){const cards=similar(embedded);if(cards.length)return cards;}
 const doc=new DOMParser().parseFromString(html,'text/html'),scope=doc.querySelector('main')||doc.body,unique=new Map();
 scope.querySelectorAll('nav,footer,header,script,style').forEach(node=>node.remove());
 for(const a of scope.querySelectorAll('li a[href]')){
  const url=safeURL(a.getAttribute('href')),name=a.textContent.trim();
  if(!url||!validCardName(name)||name.length>160||/\/similar-cards/.test(url))continue;
  if(!new URL(url).pathname.startsWith('/cards/'))continue;
  const key=slug(name),item=a.closest('li')||a.parentElement,text=item?.textContent||a.textContent,deckMatch=text.match(/([\d,.]+)\s*([KMB])?\s*Decks/i),numDecks=deckMatch?number(deckMatch[1].replace(/,/g,''))*({K:1e3,M:1e6,B:1e9}[deckMatch[2]?.toUpperCase()]||1):null;
  unique.set(key,{key,name,url,image:imageURL(item?.querySelector('img')?.src),inclusion:number(text.match(/([\d.]+)\s*%\s*Inclusion/i)?.[1]),numDecks,lift:number(text.match(/([\d.]+)\s*(?:x\s*)?Lift/i)?.[1])});
 }
 return [...unique.values()];
}
globalThis.MoxEDHREC={slug,normalize,safeURL,supplementHTML,imageURL,imageURLs,browse,commanderInclusion,similar,similarHTML,pageFromHTML};
})();
