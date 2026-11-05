const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const events=new Map(),requests=[];let scheduled,mode='search',current=true;
 const ctx={console,URL,Set,Map,location:{pathname:'/decks/test',origin:'https://moxfield.com'},CustomEvent:class{constructor(type){this.type=type;}},setTimeout:fn=>(scheduled=fn,1),clearTimeout(){},window:{addEventListener:(type,fn)=>events.set(type,fn),dispatchEvent(){}},browser:{storage:{local:{get:async()=>({})}},runtime:{sendMessage:async message=>{
  requests.push(message);
  if(mode==='paging')return {ok:true,cards:Array.from({length:60},(_,i)=>row('Page '+message.page+' card '+i)),hasMore:message.page<3};
  if(mode==='warm')return {ok:true,cards:Array.from({length:60},(_,i)=>row('Warm '+i,'U','Destroy all creatures. Draw a card.')),hasMore:false};
  if(mode==='cancel'){current=false;return {ok:true,cards:[row('Late')],hasMore:true};}
  const cards=message.page===1?[row('Wrong color','R'),row('Wrong role','U','Draw a card.'),row('Owned'),...Array.from({length:12},(_,i)=>row('First '+i))]:Array.from({length:60},(_,i)=>row('Extra '+i));
  return {ok:true,cards,hasMore:message.page===1};
 }}}};
 vm.createContext(ctx);for(const file of ['rules.js','edhrec-data.js','card-search.js','role-search.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
 function row(name,colors='U',oracle='Destroy all creatures.'){return {name,oracleId:name,oracle,type:'Sorcery',detailsLoaded:true,colors,colorIdentityKnown:true,commanderLegality:'legal'};}
 const commanders=[{name:'Commander',section:'commanders',qty:1,colors:'U',colorIdentityKnown:true}],rule=ctx.MoxRules.asRule('wipes');
 let pages=[];const result=await ctx.MoxRoleSearch.find({rule,commanders,excludeNames:new Set(['OWNED']),onPage:cards=>pages.push(...cards)});
 assert.equal(result.cards.length,50);assert.equal(requests.length,2,'Continue past a small first page to find 50');
 assert(pages.every(card=>!['Wrong color','Wrong role','Owned'].includes(card.name)),'Exact local role/color/owned checks');
 assert.match(requests[0].query,/id<=U/);assert(!requests[0].query.includes('sort:'));
 assert(ctx.MoxRoleSearch.get('extra 0').detailsLoaded,'Metadata reusable without fetching images');
 await ctx.MoxRoleSearch.find({rule,commanders,excludeNames:new Set(['owned'])});assert.equal(requests.length,2,'Reuse completed search');
 mode='paging';requests.length=0;
 let resumed=await ctx.MoxRoleSearch.find({commanders,target:50});assert.equal(resumed.cards.length,50);assert.equal(requests.length,1);
 resumed=await ctx.MoxRoleSearch.find({commanders,target:100,accept:()=>true});assert.equal(resumed.cards.length,100);assert.equal(requests.at(-1).page,2,'Resume at next page, preserving surplus from the previous page');assert.equal(requests.length,2);
 resumed=await ctx.MoxRoleSearch.find({commanders,target:200});assert.equal(resumed.cards.length,180);assert(resumed.exhausted);assert.equal(requests.at(-1).page,3);
 await ctx.MoxRoleSearch.find({commanders,target:1000});assert.equal(requests.length,3,'No more requests after actual exhaustion');
 requests.length=0;await ctx.MoxRoleSearch.find({commanders,queryOverride:'t:Angel o:"draw a card"',target:1});assert.match(requests[0].query,/t:Angel o:"draw a card"/);assert.match(requests[0].query,/id<=U/,'Scryfall syntax keeps commander colors');
 await assert.rejects(ctx.MoxRoleSearch.find({commanders,queryOverride:'x'.repeat(501)}),/500 characters/);
 const explorer=fs.readFileSync(path.join(root,'edhrec.js'),'utf8'),handler=explorer.match(/more=button\('Show more',\(\)=>\{([^]*?)\}\);more.setAttribute/)[1],expanded={limit:48,pageSize:48,searchExhausted:false,categories:{value:'all'},targets:[],render(){},loadRequirementResults(target){this.targets.push(target);}};
 expanded.loadRequirementResults=target=>expanded.targets.push(target);vm.createContext(expanded);
 for(let click=0;click<4;click++)vm.runInContext(handler,expanded);
 assert.equal(expanded.limit,240,'Repeated Show more never collapses results');assert.equal(expanded.targets.at(-1),240,'UI asks discovery for enough matches to fill the expanded view');
 const deckHandler=explorer.match(/more=button\('Show more deck cards',\(\)=>\{([^]*?)\}\);more.setAttribute/)[1],deckExpanded={limit:20,rows:Array(85),aside:{_deckCardLimit:20},more:{setAttribute(){}},list:{scrollTop:0,children:Array.from({length:85},()=>({getBoundingClientRect:()=>({top:200}),querySelector:()=>({focus(){}})})),getBoundingClientRect:()=>({top:50})},render(){}};vm.createContext(deckExpanded);for(let click=0;click<4;click++)vm.runInContext("(()=>{"+deckHandler+"})()",deckExpanded);assert.equal(deckExpanded.limit,100);assert.equal(deckExpanded.aside._deckCardLimit,100,'Expanded deck preview survives refresh');assert.equal(deckExpanded.more.hidden,true,'Deck preview ends only when all rows are revealed');assert.equal(deckExpanded.list.scrollTop,600,'Each expansion scrolls to its newly added rows');
 mode='cancel';current=true;const cancelled=await ctx.MoxRoleSearch.find({rule,commanders,excludeNames:new Set(['different']),isCurrent:()=>current});assert(cancelled.cancelled);assert.equal(cancelled.cards.length,0,'Stale replies cannot enter results');
 mode='warm';requests.length=0;
 const rules=[ctx.MoxRules.asRule('wipes'),ctx.MoxRules.asRule('draw')];
 ctx.browser.storage.local.get=async()=>({mrd_settings:{profiles:[{id:'custom',name:'Custom',rules}],selectedProfile:'custom',schemaVersion:3}});
 ctx.MoxDecks={preview:async()=>({id:'test',cards:commanders})};
 await scheduled();await tick();
 assert.equal(requests.length,2,'Warm each active requirement, not just the last role');assert(ctx.MoxRoleSearch.rowsForDeck('test').length>=50);assert.equal(ctx.MoxRoleSearch.rowsForDeck('other').length,0);
 ctx.browser.storage.local.get=async()=>({mrd_features:{prefetchRoles:false}});requests.length=0;await scheduled();assert.equal(requests.length,0,'Background search toggle honored');
 console.log('PASS: discovery beyond recommendation pool, 50 matches, exact roles/colors/exclusions, cached metadata, cancellation, each-requirement background search and toggle.');
})().catch(error=>{console.error(error);process.exitCode=1;});
