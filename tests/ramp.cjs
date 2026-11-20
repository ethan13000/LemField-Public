'use strict';
const assert=require('node:assert/strict');require('../rules.js');const R=globalThis.MoxRules;
const legacyPattern="add \\{|add (one|two|three|[a-z ]+) mana|search your library for (a|up to [^ ]+ )?(basic )?land|put (a|that|those) lands? [^\\n]{0,60} onto the battlefield|create [^\\n]{0,30}treasure token";
const ramp=R.asRule('ramp');
const card=(name,oracle,type='Sorcery',qty=1)=>R.normalizeCard({section:'mainboard',quantity:qty,card:{name,oracle_text:oracle,type_line:type}});
const positives=[
 card('Rampant Growth','Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.'),
 card('Cultivate','Search your library for up to two basic land cards, reveal those cards, and put one onto the battlefield tapped and the other into your hand. Then shuffle.'),
 card("Nature's Lore",'Search your library for a Forest card, put that card onto the battlefield, then shuffle.'),
 card('Three Visits','Search your library for a Forest card, put that card onto the battlefield, then shuffle.'),
 card('Skyshroud Claim','Search your library for up to two Forest cards, put them onto the battlefield, then shuffle.'),
 card('Farseek','Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.'),
 card('Sakura-Tribe Elder','Sacrifice Sakura-Tribe Elder: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.','Creature'),
 card('Harrow','Search your library for up to two basic land cards, put them onto the battlefield, then shuffle.'),
 card('Growth Spiral','Draw a card. You may put a land card from your hand onto the battlefield.','Instant'),
 card('Splendid Reclamation','Return all land cards from your graveyard to the battlefield tapped.'),
 card('Exploration','You may play an additional land on each of your turns.','Enchantment'),
 card('Azusa, Lost but Seeking','You may play two additional lands on each of your turns.','Creature'),
 card('Explore','You may play an additional land this turn. Draw a card.'),
 card('Wild Growth','Enchant land\nWhenever enchanted land is tapped for mana, its controller adds an additional {G}.','Enchantment'),
 card('Sol Ring','{T}: Add {C}{C}.','Artifact'),
 card('Birds of Paradise','Flying\n{T}: Add one mana of any color.','Creature'),
 card('Treasure','Create two Treasure tokens.')
];
for(const c of positives)assert(R.matches(c,ramp),c.name);
for(const c of [
 card('Forest','{T}: Add {G}.','Basic Land ? Forest'),
 card('Evolving Wilds','{T}, Sacrifice Evolving Wilds: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.','Land'),
 card('Lay of the Land','Search your library for a basic land card, reveal it, put it into your hand, then shuffle.'),
 card('Sylvan Scrying','Search your library for a land card, reveal it, put it into your hand, then shuffle.'),
 card('Landcycling','Basic landcycling {2} ({2}, Discard this card: Search your library for a basic land card, reveal it, put it into your hand, then shuffle.)'),
 card('Landfall','Whenever a land you control enters, draw a card.','Creature')
])assert(!R.matches(c,ramp),c.name);
const oldRule=()=>({...R.asRule('ramp'),min:17,max:23,criteria:[{field:'oracle',op:'regex',value:legacyPattern},{field:'type',op:'regex',value:'land',negate:true}]});
const settings={schemaVersion:3,profiles:[{id:'custom',name:'Saved',rules:[oldRule()]}],deckProfiles:{deck:{custom:{id:'custom',name:'Deck saved',rules:[oldRule()]}}},manualOverrides:{explore:{ramp:false}}};
const updated=R.sanitizeSettings(settings,true);
for(const rule of [updated.profiles[0].rules[0],updated.deckProfiles.deck.custom.rules[0]]){
 assert.deepEqual(rule.criteria,ramp.criteria);assert.equal(rule.min,17);assert.equal(rule.max,23);
 assert.equal(R.evaluate(positives,[rule],['mainboard'])[0].count,positives.length);
}
assert.equal(R.evaluate(positives,[ramp],['mainboard'],updated.manualOverrides)[0].count,positives.length-1);
assert.deepEqual(R.sanitizeSettings(updated,true),updated,'Idempotent settings migration');
for(const edit of [r=>r.criteria[0].value='my custom text',r=>r.criteria.push({field:'tag',op:'contains',value:'custom'}),r=>r.logic='any',r=>r.criteria[0].negate=true]){
 const rule=oldRule();edit(rule);const result=R.sanitizeSettings({schemaVersion:3,profiles:[{id:'custom',rules:[rule]}]});assert.deepEqual(result.profiles[0].rules[0].criteria,rule.criteria,'Custom ramp criteria preserved');
}
const ancient=oldRule();ancient.criteria.pop();const migrated=R.sanitizeSettings({profiles:[{id:'custom',rules:[ancient]}]},true);assert.deepEqual(migrated.profiles[0].rules[0].criteria,ramp.criteria);
const query=R.requirementSearch(ramp).query;assert(query.includes('additional land'));assert(query.includes('forest'));
assert(ramp.criteria[0].value.length<=400);assert.equal(R.sanitizeSettings({profiles:[{id:'custom',rules:[ramp]}]},true).profiles[0].rules[0].criteria[0].value,ramp.criteria[0].value);
console.log('PASS: land ramp, typed searches, extra land plays, mana auras, non-ramp exclusions, quantity counts, saved/global/deck/strict migrations and custom-rule preservation.');
