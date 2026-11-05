/* DOM parsing is isolated from the worker; no credentials or executable HTML. */
(()=>{
 'use strict';
 let creating=null;
 async function ensureDocument(){
  if(creating)return creating;
  creating=(async()=>{
   if(!await chrome.offscreen.hasDocument())await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['DOM_PARSER'],justification:'Parse public EDHREC fallback HTML without executing it.'});
  })().finally(()=>{creating=null;});
  return creating;
 }
 async function parse(operation,html,values={}){
  if(typeof html!=='string'||html.length>8000000)throw Error('EDHREC fallback page exceeds the parsing limit.');
  await ensureDocument();
  const reply=await browser.runtime.sendMessage({type:'mrd-offscreen-parse-v1',operation,html,...values});
  if(!reply?.ok)throw Error(reply?.error||'Could not parse EDHREC fallback page.');
  return reply.data;
 }
 globalThis.MoxHTML={supplement:(data,html,kind,slug)=>parse('supplement',html,{data,kind,slug}),similar:html=>parse('similar',html)};
})();
