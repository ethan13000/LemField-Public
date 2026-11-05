const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const root=path.resolve(__dirname,'..');
(async()=>{
 let listener,calls=0;const ctx={browser:{runtime:{onMessage:{addListener:f=>listener=f}}},fetch:async()=>{calls++;return {ok:false,status:403}},AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),ctx);
 const a=listener({type:'mrd-read-deck',id:'deckA'}),b=listener({type:'mrd-read-deck',id:'deckA'});assert.equal(a,b);assert.equal((await a).ok,false);assert.equal(calls,1);
 assert.equal(listener({type:'mrd-read-deck',id:'../bad'}),undefined);
 ctx.fetch=async()=>{calls++;return calls===2?{ok:false,status:404}:{ok:true,json:async()=>({boards:{}})}};assert.equal((await listener({type:'mrd-read-deck',id:'deckA'})).ok,true);assert.equal(calls,3);
 const dom=new JSDOM('',{url:'https://moxfield.com/decks/deckA',runScripts:'outside-only'}),w=dom.window,out=[];let resolve;
 w.postMessage=x=>out.push(x);w.fetch=()=>new Promise(r=>resolve=r);w.eval(fs.readFileSync(path.join(root,'page-hook.js'),'utf8'));
 const request=w.fetch('https://api2.moxfield.com/v3/decks/all/deckA');w.history.pushState({},'', '/decks/deckB');resolve({ok:true,clone:()=>({json:async()=>({boards:{},publicId:'deckA'})})});await request;await new Promise(r=>setTimeout(r,0));assert(!out.some(m=>m.source==='mrd-deck-response-v2'));
 const requestB=w.fetch(new w.URL('https://api2.moxfield.com/v3/decks/all/deckB'));resolve({ok:true,clone:()=>({json:async()=>({boards:{},publicId:'deckB'})})});await requestB;await new Promise(r=>setTimeout(r,0));assert.equal(out.filter(m=>m.source==='mrd-deck-response-v2').length,1);
 w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{source:'mrd-ready-v1'}}));assert.equal(out.filter(m=>m.source==='mrd-deck-response-v2').length,2);w.close();console.log('PASS: API request coalescing, forbidden/invalid requests, v2 fallback, stale page capture rejection, URL inputs, early-response replay.');
})().catch(e=>{console.error(e);process.exit(1)});

