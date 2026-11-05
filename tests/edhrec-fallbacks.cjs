const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const page={container:{json_dict:{card:{name:'Example'},cardlists:[{tag:'topcards',header:'Top Cards',cardviews:[{name:'Related',num_decks:40,potential_decks:100,lift:2}]}]}}};
const scripts=[{textContent:JSON.stringify({props:{pageProps:{data:page}}})}];
class Parser{
 parseFromString(html){const body={textContent:'',querySelectorAll:()=>[]};return {body,querySelector:()=>null,querySelectorAll:selector=>html==='EMBEDDED'&&selector==='script#__NEXT_DATA__,script[type="application/json"]'?scripts:[]};}
}
(async()=>{
 const listeners=[],calls=[];let fetchResult;
 const context={URL,AbortController,DOMParser:Parser,setTimeout,clearTimeout,browser:{runtime:{onMessage:{addListener:f=>listeners.push(f)}}},fetch:async(url,options)=>{calls.push({url,options});return fetchResult(url);}};
 vm.createContext(context);for(const file of ['edhrec-data.js','background.js','similar-background.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),context);
 const read=listeners.find(f=>f.toString().includes('mrd-read-edhrec')),similar=listeners.find(f=>f.toString().includes('mrd-similar-edhrec'));
 fetchResult=url=>url.endsWith('.json')?{ok:false,status:403}:{ok:true,text:async()=> 'EMBEDDED'};
 const card=await read({type:'mrd-read-edhrec',slug:'example',kind:'cards'});
 assert.equal(card.ok,true);assert.equal(card.data.allCards[0].inclusion,40);assert.equal(card.data.source,'html');
 assert.equal(calls.length,2);assert(calls[0].url.endsWith('/cards/example.json'));assert.equal(calls[1].url,'https://edhrec.com/cards/example');
 assert(calls.every(call=>call.options.credentials==='omit'));
 const before=calls.length,sim=similar({type:'mrd-similar-edhrec',slug:'example'});assert.equal(sim,similar({type:'mrd-similar-edhrec',slug:'example'}));
 const result=await sim;assert.equal(result.ok,true);assert.equal(result.cards[0].name,'Related');assert.equal(calls.length-before,2);
 fetchResult=()=>({ok:false,status:403});
 const blockedMessage={type:'mrd-read-edhrec',slug:'blocked',kind:'cards'},blocked=await read(blockedMessage);assert.equal(blocked.ok,false);assert.equal(blocked.code,'blocked');assert(!blocked.error.includes('HTTP'));
 let count=calls.length;await read(blockedMessage);assert.equal(calls.length,count);await read({...blockedMessage,retry:true});assert.equal(calls.length,count+2,'Explicit retry bypasses failed cache');
 const blockedSimilar={type:'mrd-similar-edhrec',slug:'blocked'};assert.equal((await similar(blockedSimilar)).code,'blocked');count=calls.length;await similar(blockedSimilar);assert.equal(calls.length,count);await similar({...blockedSimilar,retry:true});assert.equal(calls.length,count+2);
 fetchResult=()=>({ok:false,status:429});count=calls.length;assert.equal((await read({type:'mrd-read-edhrec',slug:'limited',kind:'cards'})).code,'rate_limited');assert.equal(calls.length,count+1);
 count=calls.length;assert.equal((await similar({type:'mrd-similar-edhrec',slug:'limited'})).code,'rate_limited');assert.equal(calls.length,count+1);
 assert.equal(context.MoxEDHREC.pageFromHTML('EMPTY'),null);
 console.log('PASS: card-first lookup, JSON 403/public-page recovery, embedded JSON extraction, similar-card fallback/coalescing, useful blocked states, fresh retries, and rate-limit stop.');
})().catch(error=>{console.error(error);process.exitCode=1});

