/* Small adapter for the Promise-based WebExtension APIs used by LemField. */
(()=>{
 'use strict';
 if(typeof globalThis.browser!=='undefined')return;
 if(typeof globalThis.chrome==='undefined')return;
 const api=globalThis.chrome;
 const call=(owner,name)=>(...args)=>new Promise((resolve,reject)=>{
  owner[name](...args,result=>{const error=api.runtime.lastError;if(error)reject(new Error(error.message));else resolve(result);});
 });
 const listeners=new Map();
 const onMessage={
  addListener(listener){
   if(listeners.has(listener))return;
   const wrapped=(message,sender,sendResponse)=>{
    let result;
    try{result=listener(message,sender);}catch(error){sendResponse({ok:false,error:error.message});return false;}
    if(result&&typeof result.then==='function'){
     // Keep only active requests alive, with a hard upper bound. No idle keepalive.
     let settled=false;
     const pulse=typeof document==='undefined'?setInterval(()=>api.runtime.getPlatformInfo(()=>void api.runtime.lastError),20000):null;
     const finish=value=>{if(settled)return;settled=true;clearTimeout(timeout);if(pulse!==null)clearInterval(pulse);sendResponse(value);};
     const timeout=setTimeout(()=>finish({ok:false,error:'Extension request timed out. Please retry.'}),120000);
     Promise.resolve(result).then(finish,error=>finish({ok:false,error:error?.message||'Extension request failed.'}));
     return true;
    }
    if(result!==undefined&&result!==false){sendResponse(result);return false;}
    // Unrelated listeners must not claim the response channel.
    return false;
   };
   listeners.set(listener,wrapped);api.runtime.onMessage.addListener(wrapped);
  },
  removeListener(listener){const wrapped=listeners.get(listener);if(wrapped){api.runtime.onMessage.removeListener(wrapped);listeners.delete(listener);}},
  hasListener:listener=>listeners.has(listener)
 };
 globalThis.browser={
  runtime:{getURL:api.runtime.getURL.bind(api.runtime),sendMessage:call(api.runtime,'sendMessage'),onMessage},
  storage:{local:{get:call(api.storage.local,'get'),set:call(api.storage.local,'set'),remove:call(api.storage.local,'remove')},onChanged:api.storage.onChanged},
  tabs:api.tabs?{query:call(api.tabs,'query'),create:call(api.tabs,'create'),sendMessage:call(api.tabs,'sendMessage')}:undefined
 };
})();
