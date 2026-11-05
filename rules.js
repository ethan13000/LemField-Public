/* Built-in role library, deck templates, and pure card evaluator. */
(function(root){
'use strict';
const criterion=(field,op,value)=>({field,op,value});
const oracle=pattern=>criterion('oracle','regex',pattern);
const type=pattern=>criterion('type','regex',pattern);
const mana=(op,n)=>criterion('manaValue',op,String(n));
// These heuristic roles inspect Oracle text rather than relying on a fixed card list.
// Templates are editable; users can adjust false positives with manual exclusions.
const library=[
 ['Interaction','spot','Spot removal',10,[oracle('destroy target|exile target|damage to (any )?target|deals? [^\\n]{0,65} damage to target|return target [^\\n]{0,45} to (its owner.s )?hand|target creature gets -[0-9x]')]],
 ['Interaction','wipes','Board wipes',3,[oracle('destroy all|exile all|each creature gets -|all creatures get -|deals? [^\\n]{0,65} damage to each creature|deals? [^\\n]{0,65} damage to all creatures|each player sacrifices [^\\n]{0,40}creature')]],
 ['Interaction','counter','Counterspells',6,[oracle('counter target (spell|activated|triggered ability)|counter (it|that spell)|counter all spells')]],
 ['Interaction','artifact-removal','Artifact removal',3,[oracle('(destroy|exile) target artifact|destroy (all|each) artifacts|exile all artifacts|artifact or enchantment')]],
 ['Interaction','enchantment-removal','Enchantment removal',2,[oracle('(destroy|exile) target enchantment|destroy (all|each) enchantments|exile all enchantments|artifact or enchantment')]],
 ['Interaction','grave-hate','Graveyard hate',2,[oracle('exile target (card from a graveyard|graveyard)|exile (all|each|target player.s|up to [^\\n]{0,30})[^\\n]{0,40}graveyard|cards in graveyards (lose|can.t)|exile (that|those) cards? (instead|from)')]],
 ['Interaction','protection','Protection',4,[oracle('hexproof|indestructible|phase out|phases out|protection from|prevent all damage|creatures you control gain ward|spells you control can.t be countered')]],
 ['Interaction','combat-tricks','Combat tricks',3,[oracle('target creature gets \\+[0-9x]|target creature gains (first strike|double strike|trample|lifelink)|untap target (attacking|blocking)? ?creature')]],
 ['Cards','draw','Card draw',10,[oracle('draws? (a|one|two|three|four|[0-9x]+) cards?|draws? cards|draws? a card')]],
 ['Cards','selection','Card selection',6,[oracle('scry [0-9x]+|surveil [0-9x]+|look at the top [^\\n]{0,65} cards? of your library|reveal the top [^\\n]{0,65} cards? of your library|impulse draw')]],
 ['Cards','tutors','Tutors',2,[oracle('search your library for (a|an|up to|any|two|three|[0-9x]+)[^\\n]{0,85}(card|creature|artifact|enchantment|instant|sorcery|planeswalker)')]],
 ['Cards','recursion','Recursion',4,[oracle('return target [^\\n]{0,55} from your graveyard to (your hand|the battlefield)|put target [^\\n]{0,40} from (a|your) graveyard onto the battlefield|cast [^\\n]{0,55} from your graveyard|you may cast [^\\n]{0,50} from your graveyard')]],
 ['Cards','discard','Discard outlets',3,[oracle('discard (a|one|two|[0-9x]+) cards?|discard your hand|discard a card:')]],
 ['Cards','wheel','Wheel effects',2,[oracle('each player discards (their hand|his or her hand)|discard your hand, then draw|each player (shuffles|draws) [^\\n]{0,60} cards')]],
 ['Mana','ramp','Ramp',10,[oracle('add \\{|add (one|two|three|[a-z ]+) mana|search your library for (a|up to [^ ]+ )?(basic )?land|put (a|that|those) lands? [^\\n]{0,60} onto the battlefield|create [^\\n]{0,30}treasure token')]],
 ['Mana','mana-rocks','Mana rocks',6,[type('artifact'),oracle('\\{T\\}: Add|add \\{|add one mana of any color|add [a-z]+ mana')]],
 ['Mana','mana-dorks','Mana creatures',4,[type('creature'),oracle('\\{T\\}: Add|add \\{|add one mana of any color')]],
 ['Mana','lands','Lands',32,[type('land')]],
 ['Mana','basic-lands','Basic lands',12,[type('basic land')]],
 ['Mana','nonbasic-lands','Nonbasic lands',20,[type('land')]],
 ['Mana','fixing','Mana fixing',6,[oracle('add one mana of any color|add one mana of any type|add mana of any color|search your library for a (basic )?land card')]],
 ['Mana curve','mv0','Mana value 0',0,[mana('lte',0)]],
 ['Mana curve','mv1','Mana value 1',8,[mana('gte',1),mana('lte',1)]],
 ['Mana curve','mv2','Mana value 2',12,[mana('gte',2),mana('lte',2)]],
 ['Mana curve','mv3','Mana value 3',12,[mana('gte',3),mana('lte',3)]],
 ['Mana curve','mv4','Mana value 4',8,[mana('gte',4),mana('lte',4)]],
 ['Mana curve','mv5','Mana value 5+',6,[mana('gte',5)]],
 ['Mana curve','mv1-2','Mana value 1–2',20,[mana('gte',1),mana('lte',2)]],
 ['Mana curve','mv1-3','Mana value 1–3',30,[mana('gte',1),mana('lte',3)]],
 ['Types','creatures','Creatures',25,[type('creature')]],
 ['Types','instants','Instants',10,[type('instant')]],
 ['Types','sorceries','Sorceries',8,[type('sorcery')]],
 ['Types','artifacts','Artifacts',10,[type('artifact')]],
 ['Types','enchantments','Enchantments',6,[type('enchantment')]],
 ['Types','planeswalkers','Planeswalkers',2,[type('planeswalker')]],
 ['Strategy','token-makers','Token generation',8,[oracle('create [^\\n]{0,80} token|populate|incubate [0-9x]+')]],
 ['Strategy','sacrifice','Sacrifice outlets',5,[oracle('sacrifice (a|another|any number of|target|one|two|[0-9x]+) [^\\n]{0,30}:|sacrifice a creature:|sacrifice another creature:')]],
 ['Strategy','reanimation','Reanimation',6,[oracle('(return|put) [^\\n]{0,70}creature [^\\n]{0,50} graveyard [^\\n]{0,50} battlefield|reanimate target creature')]],
 ['Strategy','mill','Mill',7,[oracle('mill [0-9x]+|mills [0-9x]+|put the top [^\\n]{0,60} cards? of [^\\n]{0,30}library into [^\\n]{0,30}graveyard')]],
 ['Strategy','self-mill','Self-mill',5,[oracle('you mill|mill [0-9x]+ cards?|mill a card|put the top [^\\n]{0,60} cards? of your library into your graveyard')]],
 ['Strategy','life-gain','Life gain',6,[oracle('you gain [0-9x]+ life|you gain life|lifelink|gain that much life')]],
 ['Strategy','life-loss','Life loss',6,[oracle('each opponent loses [0-9x]+ life|target player loses [0-9x]+ life|each player loses [0-9x]+ life|drain')]],
 ['Strategy','+1-counters','+1/+1 counters',8,[oracle('\\+1/\\+1 counter|proliferate')]],
 ['Strategy','evasion','Evasion',7,[oracle('flying|menace|unblockable|can.t be blocked|shadow|skulk|fear|intimidate')]],
 ['Strategy','haste','Haste enablers',4,[oracle('gain haste|has haste|creatures you control have haste')]],
 ['Strategy','extra-combat','Extra combats',3,[oracle('additional combat phase|extra combat phase')]],
 ['Strategy','stax','Tax effects',4,[oracle('spells [^\\n]{0,50} cost [^\\n]{0,25} more to cast|can.t cast|can.t untap|enter(s)? the battlefield tapped|skip(s)? (their|your)')]],
 ['Strategy','grave-payoffs','Graveyard payoffs',5,[oracle('for each creature card in your graveyard|whenever [^\\n]{0,55} dies|whenever a creature dies|whenever [^\\n]{0,55} leaves your graveyard|delirium|threshold')]]
];
const presetLibrary=library.map(([group,id,name,min,criteria])=>({group,id,name,min,max:id==='lands'?41:null,logic:(['mana-rocks','mana-dorks'].includes(id)||id.startsWith('mv')&&id!=='mv0')?'all':'any',criteria}));
// Entries with intentionally multiple criteria use AND; nonbasic must explicitly exclude basic.
const nonbasic=presetLibrary.find(p=>p.id==='nonbasic-lands');nonbasic.logic='all';nonbasic.criteria=[type('land'),{...type('basic'),negate:true}];
const ramp=presetLibrary.find(p=>p.id==='ramp');ramp.logic='all';ramp.criteria.push({...type('land'),negate:true});
const asRule=(id,custom={})=>{const p=presetLibrary.find(x=>x.id===id);if(!p)return null;return JSON.parse(JSON.stringify({...p,id:p.id,...custom}));};
const profileDefinitions=[
 ['commander','Commander — balanced','General-purpose Commander', [['spot',10],['wipes',3],['ramp',10],['draw',10],['mv1-2',20]]],
 ['aggro','Aggro','Lower curve and pressure', [['creatures',28],['mv1-2',24],['draw',7],['spot',7],['ramp',7],['protection',4]]],
 ['control','Control','Answers, sweepers, and selection', [['spot',12],['counter',8],['wipes',4],['draw',12],['ramp',9],['grave-hate',2]]],
 ['midrange','Midrange','Flexible threats and answers', [['creatures',24],['spot',10],['wipes',3],['ramp',10],['draw',10],['recursion',4]]],
 ['aristocrats','Aristocrats','Sacrifice and death triggers', [['sacrifice',6],['token-makers',8],['recursion',6],['draw',10],['spot',8],['ramp',10]]],
 ['reanimator','Reanimator','Graveyard-based strategy', [['reanimation',7],['discard',5],['self-mill',6],['recursion',6],['draw',9],['ramp',9]]],
 ['tokens','Tokens','Go-wide creature strategy', [['token-makers',11],['creatures',25],['draw',9],['ramp',10],['wipes',2],['protection',5]]],
 ['spellslinger','Spellslinger','Instant and sorcery focused', [['instants',16],['sorceries',12],['draw',12],['counter',6],['spot',9],['ramp',9]]],
 ['tribal','Typal / tribal','Creature-type synergy', [['creatures',31],['draw',10],['ramp',10],['spot',9],['wipes',2],['protection',4]]],
 ['voltron','Voltron','Protect and enhance a threat', [['protection',9],['spot',9],['draw',10],['ramp',10],['artifacts',10],['evasion',5]]],
 ['landfall','Lands','Land-focused strategies', [['lands',39],['ramp',13],['draw',10],['recursion',5],['spot',8],['wipes',3]]],
 ['lifegain','Lifegain','Life gain and payoffs', [['life-gain',10],['draw',10],['ramp',10],['spot',9],['wipes',3],['creatures',25]]],
 ['mill','Mill','Self-mill or opponent mill', [['mill',10],['self-mill',6],['recursion',5],['draw',10],['spot',10],['ramp',9]]],
 ['combo','Combo','Assemble and protect combos', [['tutors',5],['draw',12],['protection',7],['counter',6],['ramp',12],['spot',7]]]
];
const templates=profileDefinitions.map(([id,name,description,chosen])=>({id,name,description,rules:(chosen.some(([role])=>role==='lands')?chosen:[['lands',32],...chosen]).map(([role,min])=>asRule(role,{min}))}));
const defaults={profiles:templates.map(p=>({id:p.id,name:p.name,rules:JSON.parse(JSON.stringify(p.rules)),template:p.id})),selectedProfile:'commander',perDeck:{},layout:'inline',countSections:['mainboard'],manualOverrides:{},tagOverrides:{}};
function normalizeCard(entry){
 const card=entry.card||entry.cardData||entry;const rawQty=Number(entry.quantity??entry.count??1);const qty=Number.isFinite(rawQty)?Math.max(0,Math.floor(rawQty)):0;
 const faces=card.card_faces||card.cardFaces||[];
 const texts=[card.oracle_text,card.oracleText,card.text,...faces.map(f=>f.oracle_text||f.oracleText)].filter(Boolean);
 const rawTags=[...(Array.isArray(entry.tags)?entry.tags:[]),...(Array.isArray(entry.categories)?entry.categories:[]),...(Array.isArray(entry.userTags)?entry.userTags:[]),...(Array.isArray(card.tags)?card.tags:[])];
 const tags=rawTags.map(x=>typeof x==='string'?x:(x?.name||'')).filter(Boolean);
 const color=card.color_identity||card.colorIdentity||[];
 const art={image:card.image||card.imageUrl||card.image_url||null,image_uris:card.image_uris||card.imageUris||null,card_faces:faces,scryfallId:card.scryfall_id||card.scryfallId||null,set:typeof card.set==='object'?card.set?.code:card.set||'',collectorNumber:String(card.collector_number??card.collectorNumber??card.cn??''),manaCost:card.mana_cost||card.manaCost||''};
 const type=card.type_line||card.typeLine||'';
 return {...art,uniqueCardId:String(card.uniqueCardId||''),tokenColors:Array.isArray(card.colors)?card.colors:null,power:card.power??null,toughness:card.toughness??null,id:String(entry.cardId||card.id||card.cardId||''),name:card.name||entry.name||'Unknown',qty,oracle:texts.join('\n'),type,isToken:card.isToken===true||card.is_token===true||card.layout==='token'||/\btoken\b/i.test(type),manaValue:card.cmc==null&&card.manaValue==null&&card.mana_value==null?null:Number(card.cmc??card.manaValue??card.mana_value),colors:Array.isArray(color)?color.join(''):String(color),colorIdentityKnown:card.color_identity!=null||card.colorIdentity!=null,tags,section:entry.section||'mainboard'};
}
function normalizeDeck(data){
 const result=[];if(!data||typeof data!=='object')return result;
 const source=data.boards||data;
 const sections={mainboard:source.mainboard||source.mainBoard||source.cards,commanders:source.commanders||source.commander,companions:source.companions,sideboard:source.sideboard||source.sideBoard,maybeboard:source.maybeboard||source.maybeBoard,tokens:data.boards&&Array.isArray(data.tokens)?[...Object.values(source.tokens?.cards||{}),...data.tokens.filter(entry=>{const card=entry.card||entry;return card.isToken===true||card.is_token===true||['token','double_faced_token','emblem'].includes(card.layout)||/\b(?:token|emblem)\b/i.test(card.type_line||card.typeLine||'');})]:source.tokens||data.tokens};
 for(const [section,board] of Object.entries(sections)){
  if(!board)continue;
  const raw=board.cards||board.cardEntries||board;
  const entries=Array.isArray(raw)?raw:Object.values(raw);
  for(const e of entries){if(!e||typeof e!=='object')continue;try{const c=normalizeCard(e);if(c.qty>0&&c.name!=='Unknown'&&!(section==='tokens'&&c.id&&result.some(row=>row.section==='tokens'&&row.id===c.id)))result.push({...c,section,isToken:section==='tokens'||c.isToken});}catch(_) {}}
 }
 return result;
}
const regexCache=new Map();
const builtInPatterns=new Set(presetLibrary.flatMap(rule=>rule.criteria.filter(c=>c.op==='regex').map(c=>c.value)));
const reservedKey=key=>['__proto__','constructor','prototype'].includes(key);
const safeID=id=>typeof id==='string'&&id.length>0&&id.length<=120&&!reservedKey(id);
const dictionary=value=>Object.assign(Object.create(null),value||{});
const ownValue=(object,key)=>object&&Object.prototype.hasOwnProperty.call(object,key)?object[key]:undefined;
function isSafePattern(pattern){
 if(typeof pattern!=='string'||!pattern||pattern.length>400)return false;
 if(builtInPatterns.has(pattern))return true;
 const stack=[];let inClass=false,lastGroup=null,unbounded=0,repetitions=0,optional=0,alternatives=0;
 for(let i=0;i<pattern.length;i++){
  const ch=pattern[i];
  if(ch==='\\'){if(!inClass&&/[1-9k]/.test(pattern[i+1]||''))return false;i++;lastGroup=null;continue;}
  if(ch==='['){inClass=true;lastGroup=null;continue;}if(ch===']'&&inClass){inClass=false;continue;}if(inClass)continue;
  if(ch==='('){if(pattern[i+1]==='?'&&pattern[i+2]!==':')return false;stack.push({quantified:false,alternative:false});lastGroup=null;continue;}
  if(ch===')'){lastGroup=stack.pop()||null;if(lastGroup?.alternative)for(const group of stack)group.alternative=true;continue;}
  if(ch==='|'){if(stack.length){stack[stack.length-1].alternative=true;if(++alternatives>12)return false;}else {unbounded=0;repetitions=0;optional=0;alternatives=0;}lastGroup=null;continue;}
  let repeated=false,quantifier=false;
  if(ch==='*'||ch==='+'){quantifier=true;repeated=true;if(++unbounded>1)return false;}
  else if(ch==='?'&&pattern[i-1]!== '('){quantifier=true;if(++optional>8)return false;}
  else if(ch==='{'){
   const match=pattern.slice(i).match(/^\{(\d+)(?:,(\d*))?\}/);
   if(match){const max=match[2]===undefined?Number(match[1]):match[2]===''?Infinity:Number(match[2]);if(max>100&&max!==Infinity)return false;repeated=max>1;quantifier=true;if(max===Infinity&&++unbounded>1)return false;i+=match[0].length-1;}
  }
  if(quantifier){if(repeated&&++repetitions>2)return false;if(repeated&&lastGroup&&(lastGroup.quantified||lastGroup.alternative))return false;for(const group of stack)group.quantified=true;}
  else lastGroup=null;
 }
 try{new RegExp(pattern,'i');return true;}catch{return false;}
}
function landsFallback(rule,cards=[]){
 const criteria=rule.criteria||[],preset=rule.presetId||rule.id;
 const landCondition=c=>c.field==='type'&&!c.negate&&['contains','equals','regex'].includes(c.op)&&/^(?:basic )?land$/i.test(String(c.value).trim());
 if(!['lands','basic-lands','nonbasic-lands'].includes(preset)&&!((rule.logic!=='any'||criteria.length===1)&&criteria.some(landCondition)))return null;
 const commanders=cards.filter(c=>c.section==='commanders');
 const known=commanders.length&&commanders.every(c=>c.colorIdentityKnown!==false&&typeof c.colors==='string');
 const colors='WUBRG'.split('').filter(color=>commanders.some(c=>String(c.colors||'').toUpperCase().includes(color))).join('');
 const pages={'':'colorless',W:'mono-white',U:'mono-blue',B:'mono-black',R:'mono-red',G:'mono-green',WU:'azorius',WB:'orzhov',WR:'boros',WG:'selesnya',UB:'dimir',UR:'izzet',UG:'simic',BR:'rakdos',BG:'golgari',RG:'gruul',WUB:'esper',WUR:'jeskai',WUG:'bant',WBR:'mardu',WBG:'abzan',WRG:'naya',UBR:'grixis',UBG:'sultai',URG:'temur',BRG:'jund',WUBR:'yore-tiller',WUBG:'witch-maw',WURG:'ink-treader',WBRG:'dune-brood',UBRG:'glint-eye',WUBRG:'five-color'};
 return {url:'https://edhrec.com/lands'+(known?'/'+pages[colors]:''),colors:known?colors:null};
}
function requirementFallback(rule,cards=[]){
 const lands=landsFallback(rule,cards);if(lands)return {...lands,label:'lands'};
 const criteria=rule.criteria||[];
 if((rule.presetId||rule.id)==='instants'||((rule.logic!=='any'||criteria.length===1)&&criteria.some(c=>c.field==='type'&&!c.negate&&['contains','equals','regex'].includes(c.op)&&/^instant$/i.test(String(c.value).trim()))))return {url:'https://edhrec.com/top/instants',label:'instants',colors:null};
 return null;
}
function sidebarPosition(value,viewportHeight=10000){
 const top=Number(value?.top),height=Number.isFinite(viewportHeight)?viewportHeight:10000;
 return {side:value?.side==='left'?'left':'right',top:Math.min(Math.max(8,height-64),Math.max(8,Number.isFinite(top)?top:92))};
}
// Native text clauses avoid sending local JavaScript regex syntax to Moxfield.
// These are discovery searches: phrase conjunctions can be broader than local regex.
const nativeRoleSearch={
 spot:'o:"destroy target" or o:"exile target" or o:"damage to target" or o:"damage to any target" or (o:"return target" o:"hand") or o:"target creature gets -"',
 wipes:'o:"destroy all" or o:"exile all" or o:"each creature gets -" or o:"all creatures get -" or o:"damage to each creature" or o:"damage to all creatures" or (o:"each player sacrifices" o:"creature")',
 counter:'o:"counter target spell" or o:"counter target activated" or o:"counter target triggered ability" or o:"counter it" or o:"counter that spell" or o:"counter all spells"',
 'artifact-removal':'o:"destroy target artifact" or o:"exile target artifact" or o:"destroy all artifacts" or o:"destroy each artifacts" or o:"exile all artifacts" or o:"artifact or enchantment"',
 'enchantment-removal':'o:"destroy target enchantment" or o:"exile target enchantment" or o:"destroy all enchantments" or o:"destroy each enchantments" or o:"exile all enchantments" or o:"artifact or enchantment"',
 'grave-hate':'(o:"exile" o:"graveyard") or (o:"cards in graveyards" o:"lose") or (o:"cards in graveyards" o:"can\'t") or (o:"exile" o:"instead")',
 protection:'o:"hexproof" or o:"indestructible" or o:"phase out" or o:"phases out" or o:"protection from" or o:"prevent all damage" or o:"creatures you control gain ward" or o:"spells you control can\'t be countered"',
 'combat-tricks':'o:"target creature gets +" or o:"target creature gains first strike" or o:"target creature gains double strike" or o:"target creature gains trample" or o:"target creature gains lifelink" or (o:"untap target" o:"creature")',
 draw:'(o:"draw" o:"card")',selection:'o:"scry" or o:"surveil" or (o:"look at the top" o:"your library") or (o:"reveal the top" o:"your library") or o:"impulse draw"',
 tutors:'o:"search your library for"',recursion:'(o:"return target" o:"from your graveyard") or (o:"put target" o:"graveyard" o:"battlefield") or (o:"cast" o:"from your graveyard")',
 discard:'(o:"discard" o:"card") or o:"discard your hand"',wheel:'o:"each player discards their hand" or o:"each player discards his or her hand" or o:"discard your hand, then draw" or (o:"each player" o:"cards" o:"draws") or (o:"each player shuffles" o:"cards")',
 ramp:'o:"add {" or (o:"add" o:"mana") or (o:"search your library" o:"land") or (o:"put" o:"land" o:"onto the battlefield") or (o:"create" o:"treasure token")',
 'mana-rocks':'o:"{T}: Add" or o:"add {" or o:"add one mana of any color" or (o:"add" o:"mana")',
 'mana-dorks':'o:"{T}: Add" or o:"add {" or o:"add one mana of any color"',
 fixing:'o:"add one mana of any color" or o:"add one mana of any type" or o:"add mana of any color" or (o:"search your library for a" o:"land card")',
 'token-makers':'(o:"create" o:"token") or o:"populate" or o:"incubate"',sacrifice:'(o:"sacrifice" o:":")',reanimation:'(o:"creature" o:"graveyard" o:"battlefield") or o:"reanimate target creature"',
 mill:'o:"mill" or o:"mills" or (o:"put the top" o:"library into" o:"graveyard")','self-mill':'o:"you mill" or o:"mill" or (o:"put the top" o:"cards of your library into your graveyard")',
 'life-gain':'(o:"you gain" o:"life") or o:"lifelink" or o:"gain that much life"','life-loss':'(o:"each opponent loses" o:"life") or (o:"target player loses" o:"life") or (o:"each player loses" o:"life") or o:"drain"',
 '+1-counters':'o:"+1/+1 counter" or o:"proliferate"',evasion:'o:"flying" or o:"menace" or o:"unblockable" or o:"can\'t be blocked" or o:"shadow" or o:"skulk" or o:"fear" or o:"intimidate"',
 haste:'o:"gain haste" or o:"has haste" or o:"creatures you control have haste"','extra-combat':'o:"additional combat phase" or o:"extra combat phase"',
 stax:'(o:"spells" o:"cost" o:"more to cast") or o:"can\'t cast" or o:"can\'t untap" or o:"enter the battlefield tapped" or o:"enters the battlefield tapped" or o:"skip their" or o:"skip your" or o:"skips their" or o:"skips your"',
 'grave-payoffs':'o:"for each creature card in your graveyard" or (o:"whenever" o:"dies") or (o:"whenever" o:"leaves your graveyard") or o:"delirium" or o:"threshold"'
};
const nativePatternSearch=new Map(library.flatMap(([,id,,,criteria])=>criteria.filter(c=>c.field==='oracle'&&nativeRoleSearch[id]).map(c=>[c.value,nativeRoleSearch[id]])));
function requirementSearch(rule,cards=[]){
 const quote=value=>'"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
 const terms=[];let approximate=false;
 for(const c of rule.criteria||[]){
  const value=String(c.value??'');if(!value.trim())return {error:'Set a value for every condition before searching.'};
  let term='',termApproximate=false;
  if(c.field==='manaValue'&&['gte','lte','equals'].includes(c.op)&&Number.isFinite(Number(value)))term='mv'+({gte:'>=',lte:'<=',equals:'='})[c.op]+Number(value);
  else if(['oracle','type','name'].includes(c.field)&&['contains','notContains','regex','equals'].includes(c.op)){
   const field={oracle:'o',type:'t',name:'name'}[c.field];
   if(c.op==='regex'){
    try{new RegExp(value);}catch{return {error:'Fix the invalid pattern before searching.'};}
    if(c.field==='oracle'&&nativePatternSearch.has(value)){term=nativePatternSearch.get(value);termApproximate=true;}
    else if(!/[\\.^$*+?()[\]{}]/.test(value)&&value.split('|').every(part=>part.trim()))term=value.split('|').map(part=>field+':'+quote(part)).join(' or ');
    else return {error:'This custom regex cannot be translated safely into a Moxfield search. Use text conditions for the search.'};
   }else if(c.op==='equals'){term=field+':'+quote(value);termApproximate=true;}
   else term=(c.op==='notContains'?'-':'')+field+':'+quote(value);
  }else return {error:'Moxfield search supports card text, name, type, and numeric mana-value conditions. Manual tag and color rules cannot be translated.'};
  if(c.negate&&termApproximate)return {error:'This negated pattern cannot be translated safely into a Moxfield search. Use text conditions for the search.'};
  approximate=approximate||termApproximate;terms.push(c.negate?' -('+term+')':'('+term+')');
 }
 if(!terms.length)return {error:'Add a condition before searching.'};
 const commanders=cards.filter(c=>c.section==='commanders'),colors=[...new Set(commanders.flatMap(c=>String(c.colors||'').toUpperCase().split('')).filter(c=>'WUBRG'.includes(c)))].join('');
 const colorsKnown=commanders.length&&commanders.every(card=>card.colorIdentityKnown!==false&&typeof card.colors==='string');
 const query='f:commander '+(colorsKnown?'id<='+(colors||'c')+' ':'')+'('+terms.join(rule.logic==='any'?' or ':' ')+') sort:edhrec dir:asc';
 return {query,approximate,url:'https://moxfield.com/search/cards?q='+encodeURIComponent(query)};
}
function compare(card,c){
 if(c.field==='manaValue' && card.manaValue==null)return false;
 if(String(c.value??'').trim()==='')return false;
 const actual=c.field==='tag'?card.tags.join(' | '):c.field==='name'?card.name:c.field==='type'?card.type:c.field==='oracle'?card.oracle:c.field==='manaValue'?card.manaValue:c.field==='color'?card.colors:'';
 const expected=String(c.value??'');let ok=false;const s=String(actual).toLowerCase(),v=expected.toLowerCase();
 switch(c.op){
  case 'contains':ok=s.includes(v);break;
  case 'equals':ok=s===v;break;
  case 'notContains':ok=!s.includes(v);break;
  case 'regex':try{if(!regexCache.has(expected)){if(!isSafePattern(expected))return false;if(regexCache.size>=256)regexCache.clear();regexCache.set(expected,new RegExp(expected,'i'));}ok=regexCache.get(expected).test(String(actual).slice(0,8000));}catch(_){return false;}break;
  case 'gte':ok=Number(actual)>=Number(expected);break;
  case 'lte':ok=Number(actual)<=Number(expected);break;
 }
 return c.negate?!ok:ok;
}
function matches(card,rule,manualOverrides={},tagOverrides={}){
 const key=card.name.toLowerCase(),override=ownValue(ownValue(manualOverrides,key),rule.id);
 if(override===true||override===false)return override;
 const customTags=ownValue(tagOverrides,key),tagged={...card,tags:[...(Array.isArray(card.tags)?card.tags:[]),...(Array.isArray(customTags)?customTags:[])]},criteria=Array.isArray(rule.criteria)?rule.criteria:[];
 return !!criteria.length&&(rule.logic==='any'?criteria.some(c=>compare(tagged,c)):criteria.every(c=>compare(tagged,c)));
}
function explainMatch(card,rule,manualOverrides={},tagOverrides={}){
 const key=card.name.toLowerCase(),override=ownValue(ownValue(manualOverrides,key),rule.id);
 if(typeof override==='boolean')return {matched:override,manual:true,reasons:[{text:override?'Manually included in this requirement.':'Manually excluded from this requirement.'}]};
 const customTags=ownValue(tagOverrides,key),tagged={...card,tags:[...(Array.isArray(card.tags)?card.tags:[]),...(Array.isArray(customTags)?customTags:[])]};
 const labels={oracle:'Card text',type:'Card type',name:'Card name',tag:'Tags',manaValue:'Mana value',color:'Color identity'};
 const reasons=(rule.criteria||[]).filter(c=>compare(tagged,c)).map(c=>{
  const actual=String(c.field==='tag'?tagged.tags.join(' | '):c.field==='color'?tagged.colors:tagged[c.field]??'');
  let highlight='';
  if(!c.negate&&c.op==='regex'&&isSafePattern(c.value))try{highlight=actual.slice(0,8000).match(new RegExp(c.value,'i'))?.[0]||'';}catch{}
  if(!c.negate&&c.op==='contains'){const index=actual.toLowerCase().indexOf(String(c.value).toLowerCase());if(index>=0)highlight=actual.slice(index,index+String(c.value).length);}
  return {text:`${labels[c.field]||c.field}: ${c.negate?'not ':''}${({regex:'matches pattern',contains:'contains',notContains:'does not contain',equals:'equals',gte:'at least',lte:'at most'})[c.op]||c.op} ${c.value}`,actual,highlight};
 });
 return {matched:matches(card,rule,manualOverrides,tagOverrides),manual:false,reasons};
}
function evaluate(cards,rules,sections,manualOverrides={},tagOverrides={}){const zones=new Set(sections);const selected=(cards||[]).filter(c=>zones.has(c.section));return (rules||[]).map(rule=>{
 const matching=selected.filter(c=>matches(c,rule,manualOverrides,tagOverrides));
 return {...rule,count:matching.reduce((sum,c)=>sum+c.qty,0),cards:matching};
});}
function sanitizeSettings(value,strict=false){
 const copy=x=>JSON.parse(JSON.stringify(x));
 if(strict&&(!value||!Array.isArray(value.profiles)||!value.profiles.length))throw Error('Profiles missing');
 const input=value&&typeof value==='object'?value:{};
 const result=copy(defaults), ids=new Set();
 const fields=new Set(['oracle','name','type','tag','manaValue','color']);
 const ops=new Set(['contains','notContains','equals','regex','gte','lte']);
 const profiles=[];
 for(const p of (Array.isArray(input.profiles)?input.profiles:[]).slice(0,100)){
  if(!p||!safeID(p.id)||ids.has(p.id)||!Array.isArray(p.rules)){
   if(strict)throw Error('Invalid or duplicate profile');continue;
  }
  ids.add(p.id);
  const rules=[], ruleIds=new Set();
  for(const r of p.rules.slice(0,100)){
   if(!r||!safeID(r.id)||ruleIds.has(r.id)||!Array.isArray(r.criteria)){
    if(strict)throw Error('Invalid or duplicate rule');continue;
   }
   ruleIds.add(r.id);
   const criteria=r.criteria.slice(0,20).filter(c=>c&&fields.has(c.field)&&ops.has(c.op)).map(c=>({field:c.field,op:c.op,value:String(c.value??'').slice(0,400),...(c.negate?{negate:true}:{})}));
   if(strict&&criteria.some(c=>c.op==='regex'&&!isSafePattern(c.value)))throw Error('A rule contains an invalid or overly complex pattern.');
   const min=Number.isFinite(Number(r.min))?Math.max(0,Number(r.min)):0, max=r.max==null||r.max===''?null:Math.max(min,Number.isFinite(Number(r.max))?Number(r.max):min);
   rules.push({...r,name:String(r.name||'Requirement').slice(0,100),min,max,logic:r.logic==='any'?'any':'all',criteria});
  }
  profiles.push({id:p.id,name:String(p.name||'Profile').slice(0,80),rules});
 }
 if(profiles.length)result.profiles=profiles;
 // Migrate only unchanged legacy ramp rules, preserving custom conditions.
 if(!input.schemaVersion)for(const p of result.profiles)for(const r of p.rules){
  if((r.id==='ramp'||r.presetId==='ramp')&&r.criteria.length===1&&r.criteria[0].value===ramp.criteria[0].value){r.logic='all';r.criteria.push(copy(ramp.criteria[1]));}
 }
 // Add a conservative land baseline once to existing built-in profiles.
 // Custom profiles, edited land targets, and subsequent deliberate deletions stay intact.
 if((Number(input.schemaVersion)||0)<2)for(const p of result.profiles){
  if(templates.some(t=>t.id===p.id)&&!p.rules.some(r=>r.id==='lands'||r.presetId==='lands'))p.rules.unshift(asRule('lands',{min:32}));
 }
 // Update built-in land targets once; custom profiles and later edits stay intact.
 if((Number(input.schemaVersion)||0)<3)for(const p of result.profiles){
  if(templates.some(t=>t.id===p.id))for(const r of p.rules){
   if(r.id==='lands'||r.presetId==='lands')r.max=Math.max(41,r.min);
  }
 }
 result.schemaVersion=3;
 const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const entries=value=>Object.entries(record(value)).filter(([key])=>safeID(key)).slice(0,5000);
 const overrides=value=>dictionary(Object.fromEntries(entries(value).map(([name,rules])=>[name,dictionary(Object.fromEntries(entries(rules).filter(([,v])=>typeof v==='boolean')))])));
 result.perDeck=dictionary(Object.fromEntries(entries(input.perDeck).filter(([,id])=>result.profiles.some(p=>p.id===id))));
 result.manualOverrides=overrides(input.manualOverrides);
 result.tagOverrides=dictionary(Object.fromEntries(entries(input.tagOverrides).map(([key,value])=>[key,Array.isArray(value)?value.filter(tag=>typeof tag==='string').slice(0,50).map(tag=>tag.slice(0,100)):[]])));
 if(Array.isArray(input.countSections))result.countSections=[...new Set(input.countSections.filter(x=>['mainboard','commanders','sideboard','companions','maybeboard'].includes(x)))];
 result.selectedProfile=result.profiles.some(p=>p.id===input.selectedProfile)?input.selectedProfile:result.profiles[0].id;
 result.deckProfiles=dictionary();result.deckManualOverrides=dictionary();
 for(const [deck,profiles] of entries(input.deckProfiles).slice(0,1000)){
  result.deckProfiles[deck]=dictionary();
  for(const p of Object.values(record(profiles)).slice(0,100))if(p&&safeID(p.id)&&result.profiles.some(base=>base.id===p.id)&&Array.isArray(p.rules)){
   result.deckProfiles[deck][p.id]=sanitizeSettings({profiles:[p],schemaVersion:3},strict).profiles[0];
  }
 }
 for(const [deck,value] of entries(input.deckManualOverrides).slice(0,1000))result.deckManualOverrides[deck]=overrides(value);
 return result;
}
root.MoxRules={sanitizeSettings,defaults,presetLibrary,templates,asRule,normalizeDeck,normalizeCard,evaluate,compare,matches,explainMatch,requirementSearch,sidebarPosition,landsFallback,requirementFallback,isSafePattern};
})(typeof globalThis!=='undefined'?globalThis:this);
