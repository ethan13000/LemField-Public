/* Shared, deterministic identities and reviewed plans for native deck selections. */
(()=>{
 'use strict';
 const boards=['mainboard','sideboard','maybeboard'];
 const validID=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
 const key=row=>row.section+':'+row.id;
 // The new editor repeats card links in analysis panels and commander groups.
 // Only a matching board-main row key and card hash identify an editable entry.
 function nativeIdentity(rowKey,hash){
  const match=typeof rowKey==='string'&&rowKey.match(/^(mainboard|sideboard|maybeboard)-main-\d+\|([A-Za-z0-9_-]{1,100})$/);
  return match&&validID(hash)&&match[2]===hash?{section:match[1],id:hash}:null;
 }
 const cleanName=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
 const matchesName=(row,name)=>(row.names||[row.name]).some(alias=>cleanName(alias)===cleanName(name));
 function rows(raw){
  const source=raw?.boards||raw||{},result=[];
  for(const section of boards){
   const board=source[section]||(section==='mainboard'?source.mainBoard:null);
   if(!board)continue;
   for(const entry of Object.values(board.cards||board.cardEntries||board)){
    if(!entry||typeof entry!=='object')continue;
    const card=entry.card||entry.cardData||entry,id=String(entry.cardId||card.id||''),quantity=Number(entry.quantity??entry.count??1);
    if(!validID(id)||!Number.isInteger(quantity)||quantity<1||quantity>999||typeof card.name!=='string')continue;
    const properties={};for(const field of ['finish','isFoil','isAlter','isProxy','useCmcOverride','useManaCostOverride','useColorIdentityOverride','cmcOverride','manaCostOverride','colorIdentityOverride'])if(entry[field]!==undefined)properties[field]=entry[field];
    const custom=['tags','categories','userTags'].some(f=>entry[f]&&(typeof entry[f]==='object'?Object.keys(entry[f]).length>0:typeof entry[f]==='string'&&entry[f].trim().length>0))||Object.keys(properties).some(f=>/Override$/.test(f)&&properties[f]!=null&&properties[f]!==false);
    // Native rows can display one face while the API names the whole card.
    const names=[...new Set([card.name,...card.name.split(/\s*\/\/\s*/),...(card.card_faces||card.cardFaces||[]).map(face=>face?.name)].filter(name=>typeof name==='string'&&name.trim()))];
    result.push({section,id,name:card.name,...(names.length>1?{names}:{}),quantity,properties,custom});
   }
  }
  return result;
 }
 function plan(raw,selected,operation,destination,limit=20){
  if(!Array.isArray(selected)||!selected.length||selected.length>limit||!['remove','move'].includes(operation)||operation==='move'&&!boards.includes(destination))throw Error('Choose 1 to '+limit+' card entries and a valid action.');
  const available=rows(raw),seen=new Set();
  const entries=selected.map(selectedRow=>{
   const identity=key(selectedRow);if(seen.has(identity))throw Error('The same entry was selected more than once.');seen.add(identity);
   const matches=available.filter(row=>key(row)===identity);if(matches.length!==1)throw Error('A selected printing is missing or ambiguous. Refresh the deck.');
   const row=matches[0];
   if(operation==='move'){
    if(row.section===destination)throw Error(row.name+' is already in the destination.');
    if(row.custom)throw Error('Move tagged or customized entries with Moxfield’s native controls: '+row.name);
    const targets=available.filter(other=>other.section===destination&&other.id===row.id);
    if(targets.length>1||targets[0]&&(targets[0].custom||JSON.stringify(targets[0].properties)!==JSON.stringify(row.properties)))throw Error('Destination printing has different card settings: '+row.name);
    if(row.quantity+(targets[0]?.quantity||0)>999)throw Error('Destination quantity exceeds 999: '+row.name);
   }
   return row;
  });
  return {operation,destination:operation==='move'?destination:null,entries};
 }
 const signature=raw=>JSON.stringify(rows(raw).map(row=>[key(row),row.quantity,row.properties,row.custom]).sort((a,b)=>a[0].localeCompare(b[0])));
 globalThis.MoxDeckSelection={boards,key,rows,plan,signature,matchesName,nativeIdentity};
})();
