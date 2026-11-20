const assert=require('node:assert/strict'),fs=require('fs'),vm=require('node:vm');
(async()=>{
const events={},responses=[],writes=[];let qty=3,wrong=false;const raw=()=>({boards:{mainboard:{cards:[{quantity:qty,card:{id:'a',name:'Elf',type_line:'Creature'}}]}}});
class XHR{open(){}setRequestHeader(){}}
const window={addEventListener:(t,f)=>events[t]=f,postMessage:r=>responses.push(r),fetch:async(url,options={})=>{
 if(url.endsWith('/session'))return {ok:true};
 if(url.endsWith('/v3/decks'))return {ok:true,json:async()=>({decks:[{id:'internal',publicId:'public',name:'Deck'}]})};
 if(url.endsWith('/v3/decks/all/public'))return {ok:true,json:async()=>raw()};
 if(options.method==='PUT'){writes.push({url,body:JSON.parse(options.body)});qty=wrong?0:1;return {ok:true,json:async()=>({})};}
 throw Error('Unexpected '+url);
}};
const ctx={window,XMLHttpRequest:XHR,location:{pathname:'/decks/public',origin:'https://moxfield.com'},URL,AbortController,setTimeout,clearTimeout};
vm.createContext(ctx);for(const f of ['duplicates.js','deck-bridge.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+f),'utf8'),ctx);
await window.fetch('https://api2.moxfield.com/session',{headers:{Authorization:'Bearer test'}});
let sequence=0;async function command(plan){const requestId='00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0');events.message({source:window,origin:ctx.location.origin,data:{source:'mrd-deck-command-v1',requestId,action:'removeDuplicates',deck:'public',plan}});for(let i=0;i<100;i++){await new Promise(r=>setImmediate(r));const reply=responses.find(r=>r.requestId===requestId);if(reply)return reply;}throw Error('Missing reply');}
const plan=[{id:'a',name:'Elf',from:3,to:1}];let reply=await command(plan);assert(reply.ok);assert.equal(writes[0].url,'https://api2.moxfield.com/v2/decks/internal/cards/mainboard/a');assert.equal(writes[0].body.quantity,1);
qty=4;reply=await command(plan);assert(!reply.ok);assert.equal(writes.length,1,'Stale preview never writes');
qty=3;wrong=true;reply=await command(plan);assert(!reply.ok);assert.match(reply.error,/partial/,'Incorrect readback never reports success');
console.log('PASS: owned cleanup PUT, exact quantity verification and stale-plan rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
