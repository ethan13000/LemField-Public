/* Pure recommendation filters and printing grouping. */
(()=>{
'use strict';
const number=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const key=value=>String(value||'').trim().toLowerCase();
const strings=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'):[];
const tags=card=>[...new Set([...strings(card.tags),...strings(card.keywords),...strings(card.frameEffects),...strings(card.promoTypes),...(card.secretLair?['Secret Lair']:[])].filter(value=>typeof value==='string'&&value.trim()))];
const secretLair=card=>/^sl[dxcp]$/i.test(card.set||'')||/secret lair/i.test(card.setName||card.set_name||'');
function metadata(card){
 card=card&&typeof card==='object'?card:{};
 const faces=Array.isArray(card.card_faces)?card.card_faces.filter(face=>face&&typeof face==='object'):[];
 return {manaCost:String(card.mana_cost||card.card_faces?.[0]?.mana_cost||''),oracleId:card.oracle_id||null,oracle:String(card.oracle_text||faces.map(f=>f.oracle_text||'').join('\n')),type:String(card.type_line||faces.map(f=>f.type_line||'').join(' // ')),commanderLegality:String(card.legalities?.commander||''),manaValue:number(card.cmc),colors:strings(card.color_identity).filter(color=>/^[WUBRG]$/.test(color)).join(''),colorIdentityKnown:Array.isArray(card.color_identity),price:number(card.prices?.usd)??number(card.prices?.usd_foil)??number(card.prices?.usd_etched),keywords:strings(card.keywords),set:card.set||'',setName:card.set_name||'',secretLair:secretLair(card),frameEffects:strings(card.frame_effects),promoTypes:strings(card.promo_types),detailsLoaded:true};
}
function condense(rows){
 const groups=new Map();
 for(const row of rows){const id=row.oracleId||key(String(row.name).split(' // ')[0]);
  if(!groups.has(id))groups.set(id,{...row,tags:tags(row),duplicateCount:1,variants:[row]});
  else {const group=groups.get(id);group.duplicateCount++;group.variants.push(row);group.tags=[...new Set([...group.tags,...tags(row)])];}
 }
 return [...groups.values()];
}
function filter(rows,options={}){
 const terms=key(options.query).split(/\s+/).filter(Boolean),wantedTag=key(options.tag),maxMana=number(options.maxMana),maxPrice=number(options.maxPrice);
 let result=options.condense===false?[...rows]:condense(rows);
 result=result.filter(card=>{
  const allTags=tags(card),text=key([card.name,card.oracle,card.type,card.set,card.setName,...allTags].join(' '));
  if(!terms.every(term=>text.includes(term)))return false;
  if(wantedTag&&!allTags.some(tag=>key(tag)===wantedTag))return false;
  if(options.type&&!key(card.type).includes(key(options.type)))return false;
  if(maxMana!==null&&(number(card.manaValue)===null||card.manaValue>maxMana))return false;
  if(maxPrice!==null&&(number(card.price)===null||card.price>maxPrice))return false;
  if(options.colors!==undefined&&options.colors!==null&&(!card.colorIdentityKnown||[...String(card.colors||'')].some(color=>!options.colors.includes(color))))return false;
  if(options.role){if(!card.detailsLoaded)return false;const R=globalThis.MoxRules;const rule=R?.asRule(options.role);if(!rule||!R.matches({...card,tags:allTags,name:card.name,colors:card.colors||'',manaValue:card.manaValue??null},rule))return false;}
  return true;
 });
 if(['manaValue','price','tag','synergy','name'].includes(options.sort))result.sort((a,b)=>{
  if(options.sort==='tag')return (tags(a).sort()[0]||'\uffff').localeCompare(tags(b).sort()[0]||'\uffff')||a.name.localeCompare(b.name);
  if(options.sort==='name')return a.name.localeCompare(b.name);
  const av=number(a[options.sort]),bv=number(b[options.sort]);if(av===null||bv===null)return av===bv?a.name.localeCompare(b.name):av===null?1:-1;
  return (options.sort==='synergy'?bv-av:av-bv)||a.name.localeCompare(b.name);
 });
 return result;
}
function printing(card){
 card=card&&typeof card==='object'?card:{};
 const images=globalThis.MoxEDHREC.imageURLs(card),image=images[0];
 let url=null;try{const candidate=new URL(card.scryfall_uri);if(candidate.origin==='https://scryfall.com'&&candidate.pathname.startsWith('/card/'))url=candidate.href;}catch{}
 return {...metadata(card),id:String(card.id||''),name:String(card.name||''),printedName:String(card.printed_name||card.name||''),image:globalThis.MoxEDHREC.imageURL(image),images,url,illustrationId:card.illustration_id||card.card_faces?.[0]?.illustration_id||null,collectorNumber:String(card.collector_number||''),releasedAt:card.released_at||'',finishes:card.finishes||[],rarity:card.rarity||'',borderColor:card.border_color||'',fullArt:card.full_art===true,textless:card.textless===true,promo:card.promo===true,digital:card.digital===true};
}
function printingTags(card){return [...new Set([...tags(card),...(card.finishes||[]),card.rarity,card.borderColor?card.borderColor+' border':'',...(card.fullArt?['Full art']:[]),...(card.textless?['Textless']:[]),...(card.promo?['Promo']:[]),...(card.digital?['Digital']:[])].filter(Boolean))];}
function printings(rows,options={}){
 const unique=new Map();for(const row of rows){const id=row.id||[row.oracleId||key(row.name),key(row.set),row.collectorNumber,row.printedName].join('|');if(!unique.has(id))unique.set(id,row);}
 let result=[...unique.values()].filter(card=>{
  const allTags=printingTags(card).map(key);
  return (!options.secretLair||card.secretLair)&&(!options.tag||allTags.includes(key(options.tag)))&&(options.includeTags||[]).every(tag=>allTags.includes(key(tag)))&&!(options.excludeTags||[]).some(tag=>allTags.includes(key(tag)))&&key(options.query).split(/\s+/).every(term=>key([card.name,card.printedName,card.set,card.setName,card.collectorNumber,...allTags].join(' ')).includes(term));
 });
 const compare=(a,b)=>options.sort==='oldest'?(a.releasedAt||'9999').localeCompare(b.releasedAt||'9999'):options.sort==='secretLair'?Number(b.secretLair)-Number(a.secretLair)||b.releasedAt.localeCompare(a.releasedAt):options.sort==='set'?a.setName.localeCompare(b.setName)||a.collectorNumber.localeCompare(b.collectorNumber):options.sort==='tag'?(tags(a).sort()[0]||'\uffff').localeCompare(tags(b).sort()[0]||'\uffff'):options.sort==='price'?(a.price??Infinity)-(b.price??Infinity):b.releasedAt.localeCompare(a.releasedAt);
 result.sort(compare);
 if(options.condense){const groups=new Map();for(const row of result){const id=row.illustrationId?(row.oracleId||key(row.name))+'|'+row.illustrationId+'|'+key(row.printedName)+'|'+row.frameEffects.join(','):row.id;
   if(!groups.has(id))groups.set(id,{...row,variants:[row]});else groups.get(id).variants.push(row);
  }result=[...groups.values()];}
 return result;
}
globalThis.MoxCardSearch={metadata,tags,printingTags,condense,filter,printing,printings};
})();
