/* Page-session bulk writes: reviewed entries, copy/read-back/delete moves, no retries. */
(()=>{
 'use strict';
 globalThis.MoxDeckBulk={async apply(message,{request,decks,deadline}){
  const model=globalThis.MoxDeckSelection;
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(message.deck||''))throw Error('Invalid deck.');
  const owned=await decks(deadline),deck=owned.find(d=>d.publicId===message.deck);if(!deck)throw Error('Choose one of your own Moxfield decks.');
  const read=()=>request('/v3/decks/all/'+deck.publicId,undefined,deadline);
  let raw=await read();const reviewed=message.plan;
  const plan=model.plan(raw,reviewed?.entries,reviewed?.operation,reviewed?.destination);
  if(JSON.stringify(plan)!==JSON.stringify(reviewed))throw Error('The deck changed since selection. Refresh and review the selection again.');
  let acknowledged=0,attempted=false,expected=model.signature(raw);
  const endpoint=row=>'/v2/decks/'+deck.id+'/cards/'+row.section+'/'+row.id;
  try{
   for(const row of plan.entries){
    if(location.pathname!==('/decks/'+deck.publicId)&&location.pathname!==('/decks/'+deck.publicId+'/'))throw Error('The open deck changed.');
    raw=await read();if(model.signature(raw)!==expected)throw Error('The deck changed during the operation.');
    const before=model.rows(raw);
    if(plan.operation==='move'){
     const target={...row,section:plan.destination},prior=before.find(r=>model.key(r)===model.key(target)),quantity=row.quantity+(prior?.quantity||0);
     attempted=true;
     if(prior)await request(endpoint(target),{quantity},deadline,'PUT');
     else {
      await request('/v2/decks/'+deck.id+'/cards/'+plan.destination,{cardId:row.id,quantity:row.quantity,usePrefPrinting:false},deadline,'POST');
      if(Object.keys(row.properties).length)await request(endpoint(target),row.properties,deadline,'PUT');
     }
     const copied=await read(),actual=model.rows(copied),source=actual.filter(r=>model.key(r)===model.key(row)),destination=actual.filter(r=>model.key(r)===model.key(target));
     // Compare the whole editable deck, not just the two affected entries.
     const expectedRows=before.filter(r=>model.key(r)!==model.key(target));expectedRows.push({...target,quantity});
     const signature=items=>JSON.stringify(items.map(r=>[model.key(r),r.quantity,r.properties,r.custom]).sort((a,b)=>a[0].localeCompare(b[0])));
     if(source.length!==1||source[0].quantity!==row.quantity||destination.length!==1||destination[0].quantity!==quantity||signature(actual)!==signature(expectedRows))throw Error('Destination copy could not be verified. The source was not removed.');
    }
    attempted=true;await request(endpoint(row),undefined,deadline,'DELETE');
    const checked=await read(),actual=model.rows(checked),remaining=actual.filter(r=>model.key(r)===model.key(row));
    if(remaining.length)throw Error('Removal could not be verified.');
    const wanted=before.filter(r=>model.key(r)!==model.key(row));
    if(plan.operation==='move'){
     const target=wanted.find(r=>r.section===plan.destination&&r.id===row.id);
     if(target)target.quantity+=row.quantity;else wanted.push({...row,section:plan.destination});
    }
    const sig=items=>JSON.stringify(items.map(r=>[model.key(r),r.quantity,r.properties,r.custom]).sort((a,b)=>a[0].localeCompare(b[0])));
    if(sig(actual)!==sig(wanted))throw Error('Deck read-back differs from the reviewed action.');
    raw=checked;expected=model.signature(raw);acknowledged++;
   }
   window.postMessage({source:'mrd-deck-response-v2',id:deck.publicId,deck:raw},location.origin);
   if(location.pathname.split('/')[2]===deck.publicId)window.postMessage({source:'mrd-deck-updated-v1',id:deck.publicId},location.origin);
   return {acknowledged,operation:plan.operation};
  }catch(error){throw Error((attempted?'Bulk action may be partial ('+acknowledged+' entries verified). Check both boards before retrying. ':'No selected entries changed. ')+error.message);}
 }};
})();
