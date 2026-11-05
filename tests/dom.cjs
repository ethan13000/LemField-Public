const {JSDOM}=require('jsdom');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');require(path.join(root,'rules.js'));const R=global.MoxRules;
const card=(name,type,oracle,qty=1)=>({card:{name,type_line:type,oracle_text:oracle,cmc:2},quantity:qty});
const deck={boards:{mainboard:{cards:[card('Swamp','Basic Land — Swamp','{T}: Add {B}.',30),card('Sol Ring','Artifact','{T}: Add {C}{C}.'),card('Dark Ritual','Instant','Add {B}{B}{B}.'),card('Empty','Creature','',0)]}}};
const cards=R.normalizeDeck(deck);assert.equal(cards.length,3);assert.equal(R.evaluate(cards,[R.asRule('ramp')],['mainboard'])[0].count,2);
assert.equal(R.evaluate(cards,[R.asRule('lands')],['mainboard'])[0].count,30);
assert.equal(R.compare({manaValue:null},{field:'manaValue',op:'lte',value:'0'}),false);assert.equal(R.compare({oracle:'anything'},{field:'oracle',op:'contains',value:''}),false);
assert.equal(R.evaluate(cards,[R.asRule('ramp')],['mainboard'],{'sol ring':{ramp:false}})[0].count,1);
assert.throws(()=>R.sanitizeSettings({profiles:[{}]},true));assert.equal(R.sanitizeSettings({profiles:[{id:'x',name:'X',rules:[]}]}).profiles.length,1);
const legacy=JSON.parse(JSON.stringify(R.defaults));for(const p of legacy.profiles)for(const r of p.rules)if(r.id==='ramp'){r.logic='any';r.criteria=r.criteria.slice(0,1);}
assert.equal(R.sanitizeSettings(legacy).profiles[0].rules.find(r=>r.id==='ramp').criteria.length,2);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 for(const layout of ['flex','grid','block']){
 const dom=new JSDOM(`<main><h1>Deck</h1><section id="analytics"><div id="graphs" style="display:${layout}"><div><div class="chart"><svg></svg><button>Hypergeometric Calculator</button></div></div><div>Instants</div><div>Preview</div></div></section></main>`,{url:'https://moxfield.com/decks/deckA',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window, errors=[];w.addEventListener('error',e=>errors.push(e.message));w.Element.prototype.getClientRects=()=>[{}];
 w.fetch=async()=>({ok:true,clone:()=>({json:async()=>deck})});w.HTMLElement.prototype.scrollIntoView=()=>{};
 let pending=[],handlers=[],saved;
 w.browser={storage:{local:{get:async()=>({}),set:async v=>{saved=v}}},runtime:{getURL:()=> 'https://example.invalid/dashboard.css',sendMessage:()=>new Promise(r=>pending.push(r)),onMessage:{addListener:f=>handlers.push(f)}}};
 for(const f of ['page-hook.js','rules.js','dashboard-style.js','content.js'])w.eval(fs.readFileSync(path.join(root,f),'utf8'));
 await pause(40);
 const send=data=>w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data}));
 send({source:'mrd-deck-response-v2',id:'deckA',deck});await pause(40);
 const host=w.document.querySelector('#mrd-root'),sh=host.shadowRoot;
 assert(sh.textContent.includes('32 cards'));assert.equal(host.nextElementSibling.id,layout==='block'?'':'graphs');
 assert.equal(typeof handlers[0]({type:'snapshot'}).then,'function');
 let snap=await handlers[0]({type:'snapshot'});assert.equal(snap.results.find(r=>r.name==='Ramp').count,2);
 const button=name=>[...sh.querySelectorAll('button')].find(b=>b.textContent===name);
 button('Settings').click();await pause(40);sh.querySelector('[placeholder="New profile name"]').value='Custom';button('Create profile').click();await pause(40);assert.equal(sh.querySelector('.profile-edit input').value,'Custom');assert(saved.mrd_settings.profiles.some(p=>p.name==='Custom'));
 button('Back to requirements').click();await pause(40);button('Refresh').click();await pause(10);
 w.history.pushState({},'', '/decks/deckB');send({source:'mrd-route-v3'});await pause(40);pending[0]({ok:true,data:deck});await pause(40);assert(sh.textContent.includes('0 cards'));
 send({source:'mrd-deck-response-v2',id:'deckB',deck:{boards:{mainboard:{cards:[]}}}});await pause(30);snap=await handlers[0]({type:'snapshot'});assert.equal(snap.readable,true);assert.equal(snap.cards.length,0);
 w.history.pushState({},'', '/');send({source:'mrd-route-v3'});await pause(40);assert(host.hidden);assert(w.document.querySelector('#mrd-sidebar').hidden);
 w.history.pushState({},'', '/decks/deckC');send({source:'mrd-route-v3'});await pause(40);assert(!host.hidden);
 assert.deepEqual(errors,[]);w.close();
 }
 console.log('PASS: 3 DOM layouts, normalization, lands/ramp, legacy migration, overrides, missing mana values, settings validation, profile creation/save, stale API response, empty deck, SPA navigation.');
})().catch(e=>{console.error(e);process.exit(1)});
