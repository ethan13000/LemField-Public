/* Print-only edition choices. Never writes to a Moxfield deck. */
(()=>{
 'use strict';
 const prefix=deck=>{if(typeof deck!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(deck))throw Error('Invalid deck for print selection.');return 'mrd_print_edition_v1:'+deck+':';};
 const key=(deck,card)=>{
  if(typeof card?.name!=='string'||!card.name.trim()||card.name.length>160||!['mainboard','commanders','companions','sideboard','maybeboard','tokens'].includes(card.section))throw Error('Choose a card from the current deck.');
  const parts=[card.section,card.name.normalize('NFKC').trim().toLowerCase()];
  if(card.section==='tokens'){const source=card.tokenSourceId||card.cardId||card.id||card.scryfallId;if(source)parts.push(String(source));}
  return prefix(deck)+encodeURIComponent(JSON.stringify(parts));
 };
 const compatible=(storedKey,canonical)=>{if(storedKey===canonical)return true;try{const a=JSON.parse(decodeURIComponent(storedKey.slice(storedKey.lastIndexOf(':')+1))),b=JSON.parse(decodeURIComponent(canonical.slice(canonical.lastIndexOf(':')+1)));return a[0]==='tokens'&&b[0]==='tokens'&&a[1]===b[1]&&(a.length===2||a.length===3&&b.length===3&&a[2]===b[2]);}catch{return false;}};
 const valid=choice=>choice?.version===1&&typeof choice.printingId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(choice.printingId)&&typeof choice.set==='string'&&/^[a-z0-9]{2,10}$/i.test(choice.set)&&typeof choice.collectorNumber==='string'&&choice.collectorNumber.length>0&&choice.collectorNumber.length<=30;
 const undoPrefix=deck=>prefix(deck).replace('mrd_print_edition_v1:','mrd_print_edition_undo_v1:');
 const undoKey=(deck,card)=>key(deck,card).replace(prefix(deck),undoPrefix(deck));
 // A temporary extension can lose its own storage when removed/reinstalled.
 // Keep a second copy on the Moxfield origin, independent of extension identity.
 const backupPrefix='lemfield_print_backup_v1:';
 const siteStorage=()=>{try{return /^https:\/\/(?:www\.)?moxfield\.com$/.test(location.origin)?localStorage:null;}catch{return null;}};
 const backup=(storedKey,choice)=>{try{const site=siteStorage();if(choice)site?.setItem(backupPrefix+storedKey,JSON.stringify(choice));else site?.removeItem(backupPrefix+storedKey);}catch{}};
 const restored=(async()=>{try{const site=siteStorage();if(!site)return;const values=await browser.storage.local.get(null),missing={};for(let index=0;index<site.length;index++){const entry=site.key(index);if(!entry?.startsWith(backupPrefix))continue;const storedKey=entry.slice(backupPrefix.length),choice=(()=>{try{return JSON.parse(site.getItem(entry));}catch{return null;}})();if(!valid(choice))continue;const deck=storedKey.match(/^mrd_print_edition_v1:([A-Za-z0-9_-]+):/)?.[1];if(!deck||!compatible(storedKey,key(deck,choice)))continue;const canonical=key(deck,choice),current=missing[canonical]||values[canonical];if(Object.hasOwn(values.mrd_print_sync_meta_v1||{},canonical))continue;if(!current||(choice.selectedAt||0)>(current.selectedAt||0))missing[canonical]=choice;}if(Object.keys(missing).length)await browser.storage.local.set(missing);for(const [storedKey,choice] of Object.entries(values)){if(storedKey.startsWith('mrd_print_edition_v1:'))backup(storedKey,valid(choice)?choice:null);}}catch{}})();
 browser.storage.onChanged?.addListener((changes,area)=>{if(area==='local')for(const [storedKey,change] of Object.entries(changes))if(storedKey.startsWith('mrd_print_edition_v1:'))backup(storedKey,valid(change.newValue)?change.newValue:null);});
 globalThis.MoxPrintPreferences={key,prefix,undoPrefix,
  async save(deck,card,printing){
   await restored;
   const choice={version:1,selectedAt:Date.now(),name:card.name,section:card.section,printingId:printing.id,set:printing.set,collectorNumber:printing.collectorNumber,...(card.section==='tokens'&&(card.tokenSourceId||card.cardId||card.id||card.scryfallId)?{tokenSourceId:String(card.tokenSourceId||card.cardId||card.id||card.scryfallId)}:{})};
   if(card.section==='tokens'&&card.standaloneToken===true)choice.standaloneToken=true;
   if(!valid(choice))throw Error('This edition does not have a valid Scryfall printing ID.');
   await browser.storage.local.set({[key(deck,card)]:choice});backup(key(deck,card),choice);return choice;
  },
  async read(deck,undo=false){
   await restored;
   const values=await browser.storage.local.get(null),choices=new Map(),start=undo?undoPrefix(deck):prefix(deck);
   for(const [storedKey,choice] of Object.entries(values||{})){
    if(!storedKey.startsWith(start)||!valid(choice))continue;
    try{const canonical=undo?undoKey(deck,choice):key(deck,choice);if(compatible(storedKey,canonical)){const current=choices.get(key(deck,choice));if(!current||(choice.selectedAt||0)>=(current.selectedAt||0))choices.set(key(deck,choice),choice);if(storedKey!==canonical){await browser.storage.local.set({[canonical]:choices.get(key(deck,choice))});await browser.storage.local.remove(storedKey);backup(storedKey,null);backup(canonical,choices.get(key(deck,choice)));}}}catch{}
   }
   return choices;
  },
  async clear(deck,card){
   await restored;
   const activeKey=key(deck,card),choice=(await browser.storage.local.get(activeKey))[activeKey];
   if(valid(choice))await browser.storage.local.set({[undoKey(deck,card)]:choice});
   await browser.storage.local.remove(activeKey);backup(activeKey,null);return valid(choice)?choice:null;
  },
  async restore(deck,card){
   await restored;
   const savedKey=undoKey(deck,card),choice=(await browser.storage.local.get(savedKey))[savedKey];
   if(!valid(choice)||key(deck,choice)!==key(deck,card))throw Error('No previous print-only edition is available.');
   await browser.storage.local.set({[key(deck,card)]:choice});backup(key(deck,card),choice);await browser.storage.local.remove(savedKey);return choice;
  }
 };
})();
