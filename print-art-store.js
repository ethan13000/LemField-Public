/* Persist uploaded proxy art separately from deck editions and deck writes. */
(()=>{
 'use strict';
 const P=globalThis.MoxPrintPreferences;
 let writes=Promise.resolve();
 function transact(mode,operation){return new Promise((resolve,reject)=>{
  const open=indexedDB.open('lemfield-print-art-v1',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('art',{keyPath:'key'});
  open.onerror=()=>reject(open.error||Error('Could not open artwork storage.'));
  open.onblocked=()=>reject(Error('Artwork storage is busy. Close older Print tabs and retry.'));
  open.onsuccess=()=>{
   const db=open.result;let result;
   try{
    const tx=db.transaction('art',mode),request=operation(tx.objectStore('art'));
    request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||Error('Could not save artwork.'));};
   }catch(error){db.close();reject(error);}
  };
 });}
 const write=operation=>{const work=writes.catch(()=>{}).then(operation);writes=work;return work;};
 const validBlob=blob=>blob instanceof Blob&&blob.size>0&&blob.size<=20*1024*1024&&['image/png','image/jpeg','image/webp'].includes(blob.type);
 globalThis.MoxPrintArtStore={
  save(deck,card,blob){if(!validBlob(blob))return Promise.reject(Error('Choose a PNG, JPEG or WebP smaller than 20 MB.'));const key=P.key(deck,card);return write(()=>transact('readwrite',store=>store.put({key,deck,name:card.name,section:card.section,...(card.section==='tokens'&& (card.tokenSourceId||card.cardId||card.id||card.scryfallId)?{tokenSourceId:String(card.tokenSourceId||card.cardId||card.id||card.scryfallId)}:{}),blob})));},
  clear(deck,card){const key=P.key(deck,card);return write(()=>transact('readwrite',store=>store.delete(key)));},
  async read(deck){await writes.catch(()=>{});const start=P.prefix(deck),records=await transact('readonly',store=>store.getAll(IDBKeyRange.bound(start,start+'\uffff'))),art=new Map();for(const record of records||[]){try{if(record.deck===deck&&P.key(deck,record)===record.key&&validBlob(record.blob))art.set(record.key,record.blob);}catch{}}return art;}
 };
})();
