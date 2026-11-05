const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 let listener;const calls=[];
 const raw=name=>({name,oracle_id:name,oracle_text:'Destroy all creatures.',type_line:'Sorcery',color_identity:['W'],legalities:{commander:'legal'},image_uris:{normal:'https://cards.scryfall.io/normal/test.jpg'}});
 const ctx={URL,URLSearchParams,AbortController,setTimeout:(fn,ms)=>ms===500?setImmediate(fn):setTimeout(fn,ms),clearTimeout,browser:{runtime:{onMessage:{addListener:fn=>listener=fn}}},fetch:async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>options.method==='POST'?{data:[raw('Beta'),raw('Alpha')]}:{data:[raw('Extra')],has_more:true}};
 }};
 vm.createContext(ctx);for(const file of ['edhrec-data.js','card-search.js','art-background.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
 assert.equal(listener({type:'mrd-card-details-batch',names:Array(76).fill('A')}),undefined);
 assert.equal(listener({type:'mrd-role-cards',query:'abc',page:0}),undefined);
 const message={type:'mrd-card-details-batch',names:['Alpha','Missing','Beta']},first=listener(message);assert.equal(first,listener(message),'Coalesce identical batches');
 const result=await first;assert(result.ok);assert.equal(result.cards[0].details.oracleId,'Alpha');assert.equal(result.cards[1].ok,false);assert.equal(result.cards[2].details.oracleId,'Beta','Map by identity, not API ordering');
 assert.equal(calls[0].url,'https://api.scryfall.com/cards/collection');assert.equal(calls[0].options.credentials,'omit');assert.equal(JSON.parse(calls[0].options.body).identifiers.length,3);
 await listener({type:'mrd-card-details-batch',names:['Beta','Alpha']});assert.equal(calls.length,1,'Batch cache serves subsequent reads');
 const found=await listener({type:'mrd-role-cards',query:'f:commander id<=W o:"destroy all"',page:2});assert(found.ok&&found.hasMore);assert.equal(found.cards[0].source,'scryfall');assert.equal(found.cards[0].inclusion,null);assert.equal(found.cards[0].detailsLoaded,true);
 const url=new URL(calls.at(-1).url);assert.equal(url.origin,'https://api.scryfall.com');assert.equal(url.searchParams.get('page'),'2');assert.equal(url.searchParams.get('order'),'edhrec');assert.equal(calls.at(-1).options.credentials,'omit');
 await listener({type:'mrd-role-cards',query:'f:commander id<=W o:"destroy all"',page:2});assert.equal(calls.length,2);
 console.log('PASS: bounded batch requests, coalescing, identity mapping, missing cards, reusable cache, paginated fixed-endpoint role discovery and honest source statistics.');
})().catch(error=>{console.error(error);process.exitCode=1;});

