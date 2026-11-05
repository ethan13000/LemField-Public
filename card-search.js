/* Pure recommendation filters and printing grouping. */
(()=>{
'use strict';
const number=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const key=value=>String(value||'').trim().toLowerCase();
const strings=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'):[];
const tags=card=>[...new Set([...strings(card.tags),...strings(card.keywords),...strings(card.frameEffects),...strings(card.promoTypes),...(card.secretLair?['Secret Lair']:[])].filter(value=>typeof value==='string'&&value.trim()))];
const triggerPatterns={death:/\b(?:dies|die|died)\b|\bput into (?:a|the) graveyard from the battlefield\b/i,attack:/\battack(?:s|ed)?\b/i,block:/\bblock(?:s|ed)?\b/i,enter:/\benter(?:s|ed)?(?: the battlefield)?\b/i,leave:/\bleav(?:es|ing) (?:the )?battlefield\b/i,cast:/\bcast(?:s|ing)?\b/i,combat:/\bdeals? combat damage\b/i,upkeep:/\bupkeep\b/i,end:/\bend step\b/i,draw:/\bdraw(?:s|n)?\b/i,discard:/\bdiscard(?:s|ed)?\b/i,sacrifice:/\bsacrific(?:e|es|ed)\b/i,tap:/\b(?:becomes? tapped|tap(?:s|ped)?\b)/i};
Object.assign(triggerPatterns,{
 'counters-added':/\b(?:put|puts|place|places|add|adds)\b[^,\n]{0,100}\bcounters?\b|\bcounters?\b[^,\n]{0,80}\b(?:put|placed|added)\b/i,
 'counters-removed':/\bremov(?:e|es|ed)\b[^,\n]{0,100}\bcounters?\b|\bcounters?\b[^,\n]{0,80}\bremoved\b/i,
 lifegain:/\bgain(?:s|ed)?\b[^,\n]{0,60}\blife\b/i,lifeloss:/\b(?:lose|loses|lost)\b[^,\n]{0,60}\blife\b/i,
 landfall:/\blands?\b[^,\n]{0,80}\benter(?:s|ed)?\b/i,
 'token-create':/\bcreat(?:e|es|ed)\b[^,\n]{0,100}\btokens?\b/i,
 damage:/\bdeal(?:s|t)?\b[^,\n]{0,60}\bdamage\b/i,
 untap:/\b(?:untaps?|becomes? untapped)\b/i,scry:/\bscr(?:y|ies)\b/i,surveil:/\bsurveils?\b/i,mill:/\bmills?\b/i,proliferate:/\bproliferates?\b/i
});
function triggers(card){
 const found=new Set(),text=String(card?.oracle||'');
 for(const line of text.split(/\n|(?=\bWhenever\b)|(?=\bWhen\b)|(?=\bAt the beginning\b)/i)){
  const clause=line.trim();if(!/^(?:when(?:ever)?\b|at the beginning\b)/i.test(clause))continue;
  const condition=clause.split(',')[0];for(const [name,pattern] of Object.entries(triggerPatterns))if(pattern.test(condition))found.add(name);
  if(triggerPatterns['counters-added'].test(condition)&&(/\+1\/\+1 counters?\b/i.test(condition)||/\b(?:one or more|a|another|any|one|two|three) counters?\b/i.test(condition)))found.add('plus-one-counters');
 }
 return [...found];
}
function createsTokenKind(card,kind){
 const wanted=key(kind);if(!wanted)return true;if(!card.detailsLoaded)return false;
 const words=wanted.split(/\s+/),text=key(card.oracle);
 if(wanted==='incubator'&&/\bincubate\b/.test(text))return true;
 return [...text.matchAll(/\bcreat(?:e|es|ing)\b([^.!?\n]*?\btokens?\b)/g)].some(match=>{const description=match[1].split(/[^a-z0-9'-]+/);return words.every(word=>description.includes(word));});
}
function discoveryQuery(options={}){
 const parts=[],literal=value=>JSON.stringify(String(value));
 if(key(options.tokenKind))parts.push('o:'+literal(key(options.tokenKind)==='incubator'?'incubat':key(options.tokenKind)));
 if(options.type)parts.push('t:'+literal(options.type));
 for(const term of key(options.typeLine).split(/\s+/).filter(term=>/^[a-z0-9'-]+$/i.test(term)))parts.push('t:'+literal(term));
 const min=number(options.minMana),max=number(options.maxMana);if(min!==null)parts.push('mv>='+min);if(max!==null)parts.push('mv<='+max);
 for(const keyword of strings(options.keywords))if(keyword.length<=60)parts.push('o:'+literal(keyword));
 const triggerTerms={death:'(o:die or o:dies)',attack:'(o:attack or o:attacks)',block:'(o:block or o:blocks)',enter:'(o:enter or o:enters)',leave:'(o:leave or o:leaves)',cast:'o:cast',combat:'o:"combat damage"',upkeep:'o:upkeep',end:'o:"end step"',draw:'(o:draw or o:draws)',discard:'o:discard',sacrifice:'o:sacrifice',tap:'(o:tap or o:tapped)'};
 Object.assign(triggerTerms,{'plus-one-counters':'o:counter (o:put or o:place or o:add)','counters-added':'o:counter (o:put or o:place or o:add)','counters-removed':'o:counter o:remov',lifegain:'o:gain o:life',lifeloss:'(o:lose or o:lost) o:life',landfall:'o:land o:enter','token-create':'o:creat o:token',damage:'(o:deal or o:dealt) o:damage',untap:'o:untap',scry:'(o:scry or o:scries)',surveil:'o:surveil',mill:'o:mill',proliferate:'o:proliferate'});
 for(const trigger of strings(options.triggers))if(triggerTerms[trigger])parts.push(triggerTerms[trigger]);
 let query='';for(const part of parts)if(query.length+part.length+1<=450)query+=(query?' ':'')+part;return query;
}
const secretLair=card=>/^sl[dxcp]$/i.test(card.set||'')||/secret lair/i.test(card.setName||card.set_name||'');
function metadata(card){
 card=card&&typeof card==='object'?card:{};
 const faces=Array.isArray(card.card_faces)?card.card_faces.filter(face=>face&&typeof face==='object'):[];
 return {tokenColors:Array.isArray(card.colors)?card.colors:null,power:card.power??null,toughness:card.toughness??null,manaCost:String(card.mana_cost||card.card_faces?.[0]?.mana_cost||''),oracleId:card.oracle_id||null,oracle:String(card.oracle_text||faces.map(f=>f.oracle_text||'').join('\n')),type:String(card.type_line||faces.map(f=>f.type_line||'').join(' // ')),commanderLegality:String(card.legalities?.commander||''),manaValue:number(card.cmc),colors:strings(card.color_identity).filter(color=>/^[WUBRG]$/.test(color)).join(''),colorIdentityKnown:Array.isArray(card.color_identity),price:number(card.prices?.usd)??number(card.prices?.usd_foil)??number(card.prices?.usd_etched),keywords:strings(card.keywords),set:card.set||'',setName:card.set_name||'',secretLair:secretLair(card),frameEffects:strings(card.frame_effects),promoTypes:strings(card.promo_types),detailsLoaded:true};
}
function condense(rows){
 const groups=new Map();
 for(const row of rows){const id=row.oracleId||key(String(row.name).split(' // ')[0]);
  if(!groups.has(id))groups.set(id,{...row,tags:tags(row),duplicateCount:1,variants:[row]});
  else {const group=groups.get(id);group.duplicateCount++;group.variants.push(row);group.tags=[...new Set([...group.tags,...tags(row)])];}
 }
 return [...groups.values()];
}
function isBasicLand(card){
 const type=String(card?.type||card?.typeLine||''),name=key(card?.name);
 return /\bbasic\b.*\bland\b/i.test(type)||(!type||/\bland\b/i.test(type))&&/^(?:snow-covered )?(?:plains|island|swamp|mountain|forest|wastes)$/.test(name);
}
function filter(rows,options={}){
 const terms=key(options.query).split(/\s+/).filter(Boolean),typeTerms=key(options.typeLine).split(/\s+/).filter(Boolean),wantedTag=key(options.tag),minMana=number(options.minMana),maxMana=number(options.maxMana),maxPrice=number(options.maxPrice);
 let result=options.condense===false?[...rows]:condense(rows);
 result=result.filter(card=>{
  if(options.excludeBasics&&isBasicLand(card))return false;
  const allTags=tags(card),text=key([card.name,card.oracle,card.type,card.set,card.setName,...allTags].join(' '));
  if(!terms.every(term=>text.includes(term)))return false;
  if(wantedTag&&!allTags.some(tag=>key(tag)===wantedTag))return false;
  if(Array.isArray(options.triggers)&&options.triggers.length&&(!card.detailsLoaded||!options.triggers.every(trigger=>triggers(card).includes(trigger))))return false;
  if(Array.isArray(options.keywords)&&options.keywords.length&&(!card.detailsLoaded||!options.keywords.every(keyword=>strings(card.keywords).some(value=>key(value)===key(keyword)))))return false;
  if(options.type&&!key(card.type).includes(key(options.type)))return false;
  if(typeTerms.length&&!typeTerms.every(term=>key(card.type).includes(term)))return false;
  if(minMana!==null&&(number(card.manaValue)===null||card.manaValue<minMana))return false;
  if(maxMana!==null&&(number(card.manaValue)===null||card.manaValue>maxMana))return false;
  if(maxPrice!==null&&(number(card.price)===null||card.price>maxPrice))return false;
  if(options.colors!==undefined&&options.colors!==null&&(!card.colorIdentityKnown||[...String(card.colors||'')].some(color=>!options.colors.includes(color))))return false;
  if(options.tokenKind&&!createsTokenKind(card,options.tokenKind))return false;
  if(options.role||options.rule){if(!card.detailsLoaded)return false;const R=globalThis.MoxRules;const rule=options.rule||R?.asRule(options.role);if(!rule||!R.matches({...card,tags:allTags,name:card.name,colors:card.colors||'',manaValue:card.manaValue??null},rule))return false;}
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
function tokenVariantMatches(source,candidate){
 const text=value=>String(value??'').normalize('NFKC').replace(/\btoken\b/gi,'').replace(/\s+/g,' ').trim().toLowerCase();
 if(source.type&&text(source.type)!==text(candidate.type))return false;
 if(Array.isArray(source.tokenColors)&&(!Array.isArray(candidate.tokenColors)||[...source.tokenColors].sort().join('')!==[...candidate.tokenColors].sort().join('')))return false;
 for(const field of ['power','toughness'])if(source[field]!=null&&String(source[field])!==String(candidate[field]))return false;
 if(typeof source.oracle==='string'&&(typeof candidate.oracle!=='string'||text(source.oracle)!==text(candidate.oracle)))return false;
 return true;
}
function printing(card){
 card=card&&typeof card==='object'?card:{};
 const images=globalThis.MoxEDHREC.imageURLs(card),image=images[0];
 let url=null;try{const candidate=new URL(card.scryfall_uri);if(candidate.origin==='https://scryfall.com'&&candidate.pathname.startsWith('/card/'))url=candidate.href;}catch{}
 return {...metadata(card),id:String(card.id||''),name:String(card.name||''),printedName:String(card.printed_name||card.name||''),lang:String(card.lang||'en'),image:globalThis.MoxEDHREC.imageURL(image),images,url,illustrationId:card.illustration_id||card.card_faces?.[0]?.illustration_id||null,collectorNumber:String(card.collector_number||''),releasedAt:card.released_at||'',finishes:card.finishes||[],rarity:card.rarity||'',borderColor:card.border_color||'',layout:card.layout||'',fullArt:card.full_art===true,textless:card.textless===true,promo:card.promo===true,digital:card.digital===true};
}
function printingTags(card){return [...new Set([...tags(card),...(card.finishes||[]),card.rarity,card.borderColor?card.borderColor+' border':'',...(card.fullArt?['Full art']:[]),...(card.textless?['Textless']:[]),...(card.promo?['Promo']:[]),...(card.digital?['Digital']:[])].filter(Boolean))];}
function printings(rows,options={}){
 const unique=new Map();for(const row of rows){const id=row.id||[row.oracleId||key(row.name),key(row.set),row.collectorNumber,row.printedName].join('|');if(!unique.has(id))unique.set(id,row);}
 let result=[...unique.values()].filter(card=>{
  if(options.tokenReference&&!tokenVariantMatches(options.tokenReference,card))return false;
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
globalThis.MoxCardSearch={metadata,tags,triggers,createsTokenKind,tokenVariantMatches,isBasicLand,discoveryQuery,printingTags,condense,filter,printing,printings};
})();
