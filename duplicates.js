/* Shared conservative singleton cleanup plan. Basics and explicit copy exceptions stay. */
(()=>{'use strict';
function plan(cards){
 const groups=new Map();for(const c of cards){if(c.section!=='mainboard'||!Number.isInteger(c.qty)||c.qty<1)continue;const key=String(c.name||'').normalize('NFKC').toLowerCase().trim();if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
 const result=[];for(const rows of groups.values()){
  if(rows.some(c=>/\bbasic\b.*\bland\b/i.test(c.type||'')||/^(?:snow-covered )?(?:plains|island|swamp|mountain|forest|wastes)$/i.test(c.name)||/a deck can have|any number of cards named|up to .*cards named/i.test(c.oracle||'')))continue;
  if(rows.reduce((n,c)=>n+c.qty,0)<2)continue;
  // Never guess how to handle missing metadata or ambiguous IDs.
  if(rows.some(c=>!c.type||!c.id||!/^[A-Za-z0-9_-]{1,100}$/.test(c.id))||new Set(rows.map(c=>c.id)).size!==rows.length)continue;
  rows.forEach((c,i)=>{const keep=i===0?1:0;if(c.qty>keep)result.push({id:c.id,name:c.name,from:c.qty,to:keep});});
 }return result;
}
function rawCards(deck){const board=deck.boards?.mainboard||deck.mainboard||deck.mainBoard||{},entries=board.cards||board.cardEntries||board;return Object.values(entries).filter(e=>e&&typeof e==='object').map(e=>{const c=e.card||e.cardData||e;return {section:'mainboard',qty:Number(e.quantity??e.count??1),id:String(e.cardId||c.id||c.cardId||''),name:c.name||e.name,type:c.type_line||c.typeLine||'',oracle:[c.oracle_text,c.oracleText,c.text,...(c.card_faces||c.cardFaces||[]).map(f=>f.oracle_text||f.oracleText)].filter(Boolean).join('\n')};});}
function rawPlan(deck){return plan(rawCards(deck));}
globalThis.MoxfieldPlusDuplicates={plan,rawPlan,rawCards};
})();
