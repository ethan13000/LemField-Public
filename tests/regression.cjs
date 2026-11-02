const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
require(path.join(root,'rules.js'));const R=global.MoxRules;
const card=(name,type,oracle,qty=1)=>({card:{name,type_line:type,oracle_text:oracle,cmc:2},quantity:qty});
const deck={boards:{mainboard:{cards:[card('Swamp','Basic Land — Swamp','{T}: Add {B}.',30),card('Sol Ring','Artifact','{T}: Add {C}{C}.'),card('Dark Ritual','Instant','Add {B}{B}{B}.'),card('Empty','Creature','',0)]}}};
const cards=R.normalizeDeck(deck);
assert.equal(cards.length,3);assert.equal(R.evaluate(cards,[R.asRule('ramp')],['mainboard'])[0].count,2);
assert.equal(R.evaluate(cards,[R.asRule('lands')],['mainboard'])[0].count,30);
assert.equal(R.compare({manaValue:null},{field:'manaValue',op:'lte',value:'0'}),false);
assert.equal(R.compare({oracle:'anything'},{field:'oracle',op:'contains',value:''}),false);
assert.equal(R.evaluate(cards,[R.asRule('ramp')],['mainboard'],{'sol ring':{ramp:false}})[0].count,1);
assert.throws(()=>R.sanitizeSettings({profiles:[{}]},true));
assert.equal(R.sanitizeSettings({profiles:[{id:'x',name:'X',rules:[]}]}).profiles.length,1);
const legacy=JSON.parse(JSON.stringify(R.defaults));for(const p of legacy.profiles)for(const r of p.rules)if(r.id==='ramp'){r.logic='any';r.criteria=r.criteria.slice(0,1);}
assert.equal(R.sanitizeSettings(legacy).profiles[0].rules.find(r=>r.id==='ramp').criteria.length,2);
// Background coalescing, authorization failures and fallback.
(async()=>{
 let listener, calls=0;const context={browser:{runtime:{onMessage:{addListener:f=>listener=f}}},fetch:async()=>{calls++;return {ok:false,status:403}},AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),context);
 const a=listener({type:'mrd-read-deck',id:'deckA'}),b=listener({type:'mrd-read-deck',id:'deckA'});assert.equal(a,b);assert.equal((await a).ok,false);assert.equal(calls,1);
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});const page=await browser.newPage({viewport:{width:1878,height:1257}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://moxfield.com/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><style>body{margin:40px;background:#202020;color:#ddd;font-family:Arial}main{max-width:1700px;margin:auto}.row{display:flex;gap:30px}.col{width:40%;min-width:0}.preview{width:20%}.chart{height:430px}svg{width:100%;height:350px;background:#272329} @media(max-width:600px){body{margin:10px}.row{display:block}.col,.preview{width:100%}}</style><main><h1>Test deck</h1><section id="analytics"><div class="row" id="graphs"><div class="col"><div class="chart"><svg role="img"></svg><button>Hypergeometric Calculator</button></div></div><div class="col"><h2>Instants</h2><p>Dark Ritual</p></div><div class="preview">Card preview</div></div></section></main>`}));
 await page.goto('https://moxfield.com/decks/deckA');
 await page.evaluate(({deck,css})=>{window.pendingReads=[];window.handlers=[];window.browser={storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{getURL:()=>`data:text/css;base64,${css}`,sendMessage:()=>new Promise(resolve=>pendingReads.push(resolve)),onMessage:{addListener:f=>handlers.push(f)}}};window.testDeck=deck;},{deck,css:fs.readFileSync(path.join(root,'dashboard.css')).toString('base64')});
 for(const file of ['page-hook.js','rules.js','dashboard-style.js','content.js'])await page.addScriptTag({path:path.join(root,file)});
 await page.evaluate(()=>window.postMessage({source:'mrd-deck-response-v2',id:'deckA',deck:testDeck},location.origin));
 await page.waitForFunction(()=>document.querySelector('#mrd-root').shadowRoot.textContent.includes('32 cards'));
 assert.equal(await page.locator('#mrd-root').evaluate(e=>e.nextElementSibling.id),'graphs');
 assert.equal(await page.locator('#mrd-root').evaluate(e=>e.parentElement.id),'analytics');
 const panel=await page.locator('#mrd-root').boundingBox(), graphs=await page.locator('#graphs').boundingBox();assert(panel.y+panel.height<=graphs.y);assert(Math.abs(panel.width-graphs.width)<2);
 await page.screenshot({path:path.join(__dirname,'desktop-test.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(__dirname,'mobile-test.png'),fullPage:true});
 await page.getByRole('button',{name:'Settings',exact:true}).first().click();
 await page.getByPlaceholder('New profile name').fill('Custom');await page.getByRole('button',{name:'Create profile',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#mrd-root').shadowRoot.querySelector('.profile-edit input')?.value==='Custom');
 await page.getByRole('button',{name:'Back to requirements'}).click();
 // A delayed API response from A must never populate B.
 await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>pendingReads.length>0);
 await page.evaluate(()=>history.pushState({},'', '/decks/deckB'));await page.waitForTimeout(100);
 await page.evaluate(()=>pendingReads[0]({ok:true,data:testDeck}));await page.waitForTimeout(100);
 assert(await page.locator('#mrd-root').evaluate(e=>e.shadowRoot.textContent.includes('0 cards')));
 await page.evaluate(()=>history.pushState({},'', '/'));await page.waitForTimeout(100);assert(await page.locator('#mrd-root').isHidden());assert(await page.locator('#mrd-sidebar').isHidden());
 await page.evaluate(()=>history.pushState({},'', '/decks/deckC'));await page.waitForTimeout(100);assert(await page.locator('#mrd-root').isVisible());
 // React replacement of the analytics row must reattach one panel only.
 await page.evaluate(()=>{const x=document.querySelector('#graphs');x.replaceWith(x.cloneNode(true));window.dispatchEvent(new Event('resize'));});await page.waitForTimeout(350);assert.equal(await page.locator('#mrd-root').count(),1);assert.equal(await page.locator('#mrd-root').evaluate(e=>e.nextElementSibling.id),'graphs');
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: normalization, ramp migration, overrides, invalid settings, API coalescing, desktop/mobile layout, settings, stale responses, SPA routes, analytics replacement.');
})().catch(e=>{console.error(e);process.exit(1)});
