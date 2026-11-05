/* Physical card sheets; browser printing supplies the PDF writer. */
(async()=>{
'use strict';
const $=id=>document.getElementById(id),status=$('status'),prepare=$('prepare'),print=$('print');
let deck=null,generation=0,preparedGeneration=-1,printChoices=new Map(),undoChoices=new Map(),prepareTimer=null,uploadsInFlight=0;const imageCache=new Map(),customArt=new Map(),uploadRuns=new Map();
const printChoice=card=>printChoices.get(globalThis.MoxPrintPreferences.key(deck.id,card));
const cardKey=card=>globalThis.MoxPrintPreferences.key(deck.id,card);
const printableImages=new Map(),printableURLs=new Set();
async function printableImage(url){
 if(printableImages.has(url))return printableImages.get(url);
 const task=(async()=>{const image=new Image();image.crossOrigin='anonymous';image.src=url;let decodeTimer;try{await Promise.race([image.decode(),new Promise((_,reject)=>{decodeTimer=setTimeout(()=>{image.src='';reject(Error('Image decode timed out.'));},20000);})]);const width=744,height=1039;if(image.naturalWidth<=width&&image.naturalHeight<=height)return url;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));canvas.width=canvas.height=0;if(!blob)return url;const result=URL.createObjectURL(blob);printableURLs.add(result);return result;}catch{return url;}finally{clearTimeout(decodeTimer);}})();printableImages.set(url,task);return task;
}
window.addEventListener('pagehide',()=>{for(const url of printableURLs)URL.revokeObjectURL(url);});
const tokenQuantities=new Map(),expandedCards=new Set();
const printCount=card=>card.section==='tokens'?card.qty:($('copies').checked?card.qty:1);
const progress=$('print-progress');
function setProgress(value){progress.hidden=false;if(value===null)progress.removeAttribute('value');else progress.value=Math.max(0,Math.min(100,value));}
setProgress(null);
const commanderFirst=(a,b)=>Number(b.section==='commanders')-Number(a.section==='commanders');
function selectedCards(){
 if(!deck)return [];
 const cards=[...deck.cards],P=globalThis.MoxPrintPreferences;
 if(deck.id&&typeof printChoices!=='undefined'){
  const keys=new Set(cards.map(card=>P.key(deck.id,card)));
  for(const [key,choice] of printChoices)if(choice.section==='tokens'&&choice.standaloneToken===true&&!keys.has(key)){cards.push({...choice,id:choice.tokenSourceId,qty:1,isToken:true,type:'Token',scryfallId:choice.printingId});keys.add(key);}
 }
 const uniqueTokens=new Map(),nonTokens=[];
 for(const card of cards){if(card.section!=='tokens'){nonTokens.push(card);continue;}const identity=cardKey(card),previous=uniqueTokens.get(identity),choice=printChoice(card),oldChoice=previous&&printChoice(previous);if(!previous||choice&&(!oldChoice||(choice.selectedAt||0)>=(oldChoice.selectedAt||0)))uniqueTokens.set(identity,{...card,qty:1});}
 for(const card of uniqueTokens.values())card.qty=tokenQuantities.get(cardKey(card))??1;
 return [...nonTokens,...uniqueTokens.values()].sort(commanderFirst).filter(c=>(c.qty>0||c.section==='tokens')&&(['mainboard','commanders','companions'].includes(c.section)||$('sideboard').checked&&c.section==='sideboard'||$('tokens').checked&&c.section==='tokens')&&!($('basics').checked&&/\bbasic\b.*\bland\b/i.test(c.type||'')));
}
function renderCardList(){
 $('card-list').replaceChildren();
 let tokenHeadingShown=false;
 for(const card of selectedCards().sort((a,b)=>Number(a.section==='tokens')-Number(b.section==='tokens')||commanderFirst(a,b)||a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true}))){
  if(card.section==='tokens'&&!tokenHeadingShown){const heading=document.createElement('h3');heading.textContent='Tokens';$('card-list').append(heading);tokenHeadingShown=true;}
  const key=cardKey(card),row=document.createElement('details');row.className='print-card-row';row.open=expandedCards.has(key);
  row.addEventListener('toggle',()=>{if(row.isConnected){if(row.open)expandedCards.add(key);else expandedCards.delete(key);}});
  const summary=document.createElement('summary');
  const title=document.createElement('strong');title.textContent=printCount(card)+' ? '+card.name;
  const choice=printChoice(card),detail=document.createElement('small');detail.textContent=customArt.has(key)?'Custom image selected':choice?'Print-only edition: '+choice.set+' #'+choice.collectorNumber:'Deck printing';
  const label=document.createElement('label');label.className='art-upload';label.textContent='Upload custom art';
  const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.setAttribute('aria-label','Custom art for '+card.name);label.append(input);
  const reset=document.createElement('button');reset.type='button';reset.textContent=customArt.has(key)?'Remove custom upload':'Use deck printing';reset.hidden=!customArt.has(key)&&!choice;
  reset.addEventListener('click',async()=>{uploadRuns.set(key,{});try{if(customArt.has(key)){await globalThis.MoxPrintArtStore.clear(deck.id,card);await browser.storage.local.remove('mrd_uploaded_art_v1:'+key);URL.revokeObjectURL(customArt.get(key));customArt.delete(key);invalidate();return;}const previous=await globalThis.MoxPrintPreferences.clear(deck.id,card);if(previous)undoChoices.set(key,previous);printChoices.delete(key);invalidate();}catch(error){status.textContent='Could not reset print artwork: '+error.message;}});
  const undo=document.createElement('button');undo.type='button';undo.textContent='Restore previous custom printing';undo.hidden=!undoChoices.has(key)||!!choice||customArt.has(key);
  undo.addEventListener('click',async()=>{undo.disabled=true;try{const previous=await globalThis.MoxPrintPreferences.restore(deck.id,card);printChoices.set(key,previous);undoChoices.delete(key);invalidate();}catch(error){status.textContent='Could not restore print artwork: '+error.message;undo.disabled=false;}});
  input.addEventListener('change',async()=>{
   const file=input.files[0];if(!file)return;
   const ticket={};uploadRuns.set(key,ticket);input.disabled=true;detail.textContent='Reading image?';uploadsInFlight++;generation++;clearTimeout(prepareTimer);print.disabled=true;$('save-pdf').disabled=true;prepare.disabled=true;let url=null;
   try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image.');
    if(file.size>20*1024*1024)throw Error('Choose an image smaller than 20 MB.');
    url=URL.createObjectURL(file);
    const image=new Image();image.src=url;await image.decode();
    if(uploadRuns.get(key)!==ticket){URL.revokeObjectURL(url);return;}
    await globalThis.MoxPrintArtStore.save(deck.id,card,file);await browser.storage.local.remove('mrd_uploaded_art_v1:'+key);
    if(uploadRuns.get(key)!==ticket){URL.revokeObjectURL(url);return;}
    if(customArt.has(key))URL.revokeObjectURL(customArt.get(key));
    customArt.set(key,url);invalidate();status.textContent='Custom art saved for '+card.name+'. It will stay selected even if the deck edition changes. The preview will update automatically.';
   }catch(error){if(url)URL.revokeObjectURL(url);if(uploadRuns.get(key)===ticket){detail.textContent=error.message;input.disabled=false;input.value='';prepare.disabled=!deck;}}
   finally{uploadsInFlight--;if(!uploadsInFlight&&deck){prepare.disabled=false;schedulePrepare();}}
  });
  summary.append(title);const body=document.createElement('div');body.className='print-card-details';body.append(detail,label,reset,undo);
  if(card.section==='tokens'){const quantityLabel=document.createElement('label');quantityLabel.textContent='Copies to print';const quantity=document.createElement('input');quantity.type='number';quantity.min='0';quantity.max='100';quantity.step='1';quantity.value=String(card.qty);quantity.setAttribute('aria-label','Copies of '+card.name);quantity.addEventListener('change',async()=>{const count=Number(quantity.value);if(!Number.isInteger(count)||count<0||count>100){quantity.setCustomValidity('Choose a whole number from 0 to 100.');quantity.reportValidity();return;}quantity.setCustomValidity('');tokenQuantities.set(key,count);expandedCards.add(key);invalidate();try{await browser.storage.local.set({['mrd_token_quantity:'+key]:count});}catch(error){status.textContent='Quantity changed, but could not be saved: '+error.message;}});quantityLabel.append(quantity);body.prepend(quantityLabel);}row.append(summary,body);$('card-list').append(row);
 }
}
const pageRule=document.createElement('style');document.head.append(pageRule);
const controls=['paper','gap','margin','basics','copies','sideboard','tokens','guides','guide-style'];
function schedulePrepare(){clearTimeout(prepareTimer);prepareTimer=setTimeout(()=>{if(deck&&!prepare.disabled)prepare.click();},300);}
function invalidate(){generation++;preparedGeneration=-1;setProgress(null);print.disabled=true;$('save-pdf').disabled=true;prepare.disabled=!deck||uploadsInFlight>0;$('sheets').replaceChildren();renderCardList();status.textContent='Updating print preview?';schedulePrepare();}
controls.forEach(id=>$(id).addEventListener('change',invalidate));
function imageFor(card){
 if(customArt.has(cardKey(card)))return Promise.resolve(customArt.get(cardKey(card)));
 const choice=printChoice(card);if(choice)card={...card,scryfallId:choice.printingId,set:choice.set,collectorNumber:choice.collectorNumber};
 const identity=JSON.stringify([card.name,card.scryfallId,card.set,card.collectorNumber]);
 if(!imageCache.has(identity))imageCache.set(identity,browser.runtime.sendMessage({type:'mrd-card-art',name:card.name,...(card.scryfallId?{printingId:card.scryfallId}:card.set&&card.collectorNumber?{printing:{set:card.set,collectorNumber:card.collectorNumber}}:{})}).then(reply=>{
  if(!reply?.ok||!reply.url)throw Error('No card image for '+card.name);
  return reply.url;
 }).catch(error=>{imageCache.delete(identity);throw error;}));
 return imageCache.get(identity);
}
prepare.addEventListener('click',async()=>{
 clearTimeout(prepareTimer);
 const run=++generation;preparedGeneration=-1;setProgress(0);prepare.disabled=true;print.disabled=true;$('save-pdf').disabled=true;$('sheets').replaceChildren();
 try{
  const gap=Number($('gap').value),margin=Number($('margin').value);
  if(!Number.isFinite(gap)||gap<0||gap>20||!Number.isFinite(margin)||margin<0||margin>25)throw Error('Use spacing from 0?20 mm and margins from 0?25 mm.');
  const [width,height]=$('paper').value==='a4'?[210,297]:[215.9,279.4];
  const cols=Math.floor((width-2*margin+gap)/(63+gap)),rows=Math.floor((height-2*margin+gap)/(88+gap)),perPage=cols*rows;
  if(!perPage)throw Error('These margins leave no room for a card.');
  const selected=selectedCards().filter(card=>card.qty>0);
  const total=selected.reduce((sum,card)=>{if(!Number.isSafeInteger(card.qty)||card.qty<1)throw Error('Invalid card quantity. Reload the deck and try again.');return sum+printCount(card);},0);
  if(total>1500)throw Error('Limit the export to 1,500 cards or turn off Print every copy.');
  const cards=selected.flatMap(card=>Array.from({length:printCount(card)},()=>card));
  if(!cards.length)throw Error('No cards match these options.');
  if(cards.length>1500)throw Error('Limit the export to 1,500 cards or turn off Print every copy.');
  pageRule.textContent='@page{size:'+width+'mm '+height+'mm;margin:0}';
  const left=(width-(cols*63+(cols-1)*gap))/2,top=(height-(rows*88+(rows-1)*gap))/2;
  const sheets=document.createDocumentFragment();let sheet;
  for(let i=0;i<cards.length;i++){
   if(run!==generation)return;
   status.textContent='Loading card images: '+(i+1)+' / '+cards.length;
   const url=await printableImage(await imageFor(cards[i]));if(run!==generation)return;setProgress(90*(i+1)/cards.length);
   if(i%perPage===0){sheet=document.createElement('section');sheet.className='sheet'+($('guide-style').value==='rounded'?' rounded-cards':'')+($('guides').checked?' guides':'');sheet.style.width=width+'mm';sheet.style.height=height+'mm';sheets.append(sheet);}
   const position=i%perPage,img=document.createElement('img');img.alt=cards[i].name;img.src=url;
   img.style.left=(left+(position%cols)*(63+gap))+'mm';img.style.top=(top+Math.floor(position/cols)*(88+gap))+'mm';sheet.append(img);
  }
  $('sheets').append(sheets);
  status.textContent='Rendering print sheets?';let decoded=0;const sheetImages=[...$('sheets').querySelectorAll('img')];await Promise.all(sheetImages.map(async img=>{await img.decode();if(run===generation)setProgress(90+10*(++decoded)/sheetImages.length);}));if(run!==generation)return;setProgress(100);
  status.textContent=deck.name+' ? '+cards.length+' cards ? '+Math.ceil(cards.length/perPage)+' sheets ? '+perPage+' cards per sheet';preparedGeneration=run;print.disabled=false;$('save-pdf').disabled=false;
 }catch(error){if(run===generation){progress.hidden=true;status.textContent='Could not prepare sheets: '+error.message;}}
 finally{if(run===generation)prepare.disabled=false;}
});
let printing=false;
async function openPrintDialog(pdf){if(printing||print.disabled)return;printing=true;print.disabled=true;$('save-pdf').disabled=true;status.textContent=pdf?'Choose Save as PDF in the destination list, use 100% scale, and disable headers and footers.':'Opening print dialog? Use 100% scale and disable headers and footers.';try{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));window.print();}finally{printing=false;print.disabled=preparedGeneration!==generation;$('save-pdf').disabled=print.disabled;}}
print.addEventListener('click',()=>openPrintDialog(false));$('save-pdf').addEventListener('click',async()=>{if(printing||print.disabled)return;printing=true;print.disabled=true;$('save-pdf').disabled=true;try{await globalThis.LemFieldPDF.save([...$('sheets').children],deck.name,(done,total)=>{status.textContent='Creating PDF: '+done+' / '+total+' sheets';setProgress(100*done/total);});status.textContent='PDF downloaded.';}catch(error){status.textContent='Could not save PDF: '+error.message;}finally{printing=false;print.disabled=preparedGeneration!==generation;$('save-pdf').disabled=print.disabled;}});
try{
 const tab=Number(new URLSearchParams(location.search).get('tab'));if(!Number.isInteger(tab)||tab<1)throw Error('Open export from a Moxfield deck.');
 const reply=await browser.tabs.sendMessage(tab,{type:'mrd-export-deck'});
 if(!reply?.ok||!Array.isArray(reply.deck?.cards)||reply.deck.cards.some(card=>!card||typeof card.name!=='string'||!Number.isSafeInteger(card.qty)||card.qty<0))throw Error(reply?.error||'Deck data is unavailable. Reload the Moxfield tab and try again.');
 deck=reply.deck;const tokenResult=await browser.runtime.sendMessage({type:'mrd-deck-tokens',names:[...new Set(deck.cards.filter(card=>['mainboard','commanders','companions','sideboard'].includes(card.section)).map(card=>card.name))]});if(tokenResult?.ok){const existing=new Set(deck.cards.filter(card=>card.section==='tokens').map(card=>card.scryfallId||[card.name,card.set,card.collectorNumber].join('|')));for(const token of tokenResult.cards||[])if(!existing.has(token.scryfallId)&&!deck.cards.some(card=>card.section==='tokens'&&card.name===token.name&&card.set===token.set&&card.collectorNumber===token.collectorNumber)){deck.cards.push(token);existing.add(token.scryfallId);}}else status.textContent='Some associated tokens could not be loaded. '+(tokenResult?.error||'');printChoices=await globalThis.MoxPrintPreferences.read(deck.id);undoChoices=await globalThis.MoxPrintPreferences.read(deck.id,true);let artWarning='';try{const savedArt=await globalThis.MoxPrintArtStore.read(deck.id);for(const [key,blob] of savedArt)customArt.set(key,URL.createObjectURL(blob));}catch{artWarning=' Saved custom artwork could not be loaded; deck printing is shown.';}const uploads=await browser.storage.local.get(null);for(const [key,value] of Object.entries(uploads))if(key.startsWith('mrd_token_quantity:')&&Number.isInteger(value)&&value>=0&&value<=100)tokenQuantities.set(key.slice('mrd_token_quantity:'.length),value);for(const [key,value] of Object.entries(uploads))if(key.startsWith('mrd_uploaded_art_v1:'+globalThis.MoxPrintPreferences.prefix(deck.id))&&/^data:image\/jpeg;base64,/.test(value?.url||''))customArt.set(key.slice('mrd_uploaded_art_v1:'.length),value.url);renderCardList();document.title=deck.name+' - Card sheets';$('status').textContent=deck.name+' ? '+deck.cards.reduce((sum,c)=>sum+c.qty,0)+' cards loaded. Preparing sheets?'+artWarning;prepare.disabled=false;if(!artWarning)schedulePrepare();
 browser.storage.onChanged.addListener((changes,area)=>{const P=globalThis.MoxPrintPreferences;if(area!=='local')return;let quantitiesChanged=false;for(const [key,change] of Object.entries(changes))if(key.startsWith('mrd_token_quantity:'+P.prefix(deck.id))){const tokenKey=key.slice('mrd_token_quantity:'.length);if(Number.isInteger(change.newValue)&&change.newValue>=0&&change.newValue<=100)tokenQuantities.set(tokenKey,change.newValue);else tokenQuantities.delete(tokenKey);quantitiesChanged=true;}if(!quantitiesChanged&&!Object.keys(changes).some(key=>key.startsWith(P.prefix(deck.id))||key.startsWith(P.undoPrefix(deck.id))))return;Promise.all([P.read(deck.id),P.read(deck.id,true)]).then(([choices,previous])=>{printChoices=choices;undoChoices=previous;invalidate();status.textContent='Print settings changed. The preview will update automatically.';}).catch(error=>{status.textContent='Could not refresh print choices: '+error.message;});});
}catch(error){progress.hidden=true;status.textContent=error.message;}
})();
