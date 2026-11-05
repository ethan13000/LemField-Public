/* Bound remote service bodies before parsing; no executable HTML or dependencies. */
(()=>{
'use strict';
async function text(response,limit=8*1024*1024){
 const declared=Number(response.headers?.get?.('content-length'));if(Number.isFinite(declared)&&declared>limit)throw Error('Service response exceeds the size limit.');
 if(response.body?.getReader){
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;const chunk=part.value instanceof Uint8Array?part.value:new Uint8Array(part.value);size+=chunk.byteLength;if(size>limit){await reader.cancel().catch(()=>{});throw Error('Service response exceeds the size limit.');}chunks.push(chunk);}}
  finally{reader.releaseLock?.();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(bytes);
 }
 const value=await response.text();if(value.length>limit||new TextEncoder().encode(value).byteLength>limit)throw Error('Service response exceeds the size limit.');return value;
}
async function json(response,limit=16*1024*1024){
 // Offline fixtures can provide JSON-only responses; real Fetch Responses expose text/body.
 if(!response.body?.getReader&&typeof response.text!=='function'){const declared=Number(response.headers?.get?.('content-length'));if(Number.isFinite(declared)&&declared>limit)throw Error('Service response exceeds the size limit.');return response.json();}
 return JSON.parse(await text(response,limit));
}
globalThis.MoxResponses={text,json};
})();
