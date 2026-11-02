/* Physical card sheets; browser printing supplies the PDF writer. */
(async()=>{
'use strict';
const $=id=>document.getElementById(id),status=$('status'),prepare=$('prepare'),print=$('print');
let deck=null,generation=0;const imageCache=new Map(),customArt=new Map(),uploadRuns=new Map();
const cardKey=card=>JSON.stringify([card.name,card.scryfallId,card.set,card.collectorNumber]);
const expandedCards=new Set();
function selectedCards(){return deck?deck.cards.filter(c=>c.qty>0&&(['mainboard','commanders','companions'].includes(c.section)||$('sideboard').checked&&c.section==='sideboard')&&!($('basics').checked&&/\bbasic\b.*\bland\b/i.test(c.type||''))):[];}
function renderCardList(){
 $('card-list').replaceChildren();
 for(const card of selectedCards().sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true}))){
  const key=cardKey(card),row=document.createElement('details');row.className='print-card-row';row.open=expandedCards.has(key);
  row.addEventListener('toggle',()=>{if(row.isConnected){if(row.open)expandedCards.add(key);else expandedCards.delete(key);}});
  const summary=document.createElement('summary');
  const title=document.createElement('strong');title.textContent=($('copies').checked?card.qty:1)+' × '+card.name;
  const detail=document.createElement('small');detail.textContent=customArt.has(key)?'Custom image selected':'Original printing';
  const label=document.createElement('label');label.className='art-upload';label.textContent='Upload custom art';
  const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.setAttribute('aria-label','Custom art for '+card.name);label.append(input);
  const reset=document.createElement('button');reset.type='button';reset.textContent='Use original';reset.hidden=!customArt.has(key);
  reset.addEventListener('click',()=>{uploadRuns.set(key,{});customArt.delete(key);invalidate();});
  input.addEventListener('change',async()=>{
   const file=input.files[0];if(!file)return;
   const ticket={};uploadRuns.set(key,ticket);input.disabled=true;detail.textContent='Reading image…';
   try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image.');
    if(file.size>20*1024*1024)throw Error('Choose an image smaller than 20 MB.');
    const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read image.'));reader.readAsDataURL(file);});
    const image=new Image();image.src=url;await image.decode();
    if(uploadRuns.get(key)!==ticket)return;
    customArt.set(key,url);invalidate();status.textContent='Custom art ready for '+card.name+'. Prepare sheets to update the preview.';
   }catch(error){if(uploadRuns.get(key)===ticket){detail.textContent=error.message;input.disabled=false;input.value='';}}
  });
  summary.append(title);const body=document.createElement('div');body.className='print-card-details';body.append(detail,label,reset);
  row.append(summary,body);$('card-list').append(row);
 }
}
const pageRule=document.createElement('style');document.head.append(pageRule);
const controls=['paper','gap','margin','basics','copies','sideboard','guides'];
function invalidate(){generation++;print.disabled=true;prepare.disabled=!deck;$('sheets').replaceChildren();renderCardList();status.textContent='Options changed. Prepare sheets to update the preview.';}
controls.forEach(id=>$(id).addEventListener('change',invalidate));
function imageFor(card){
 if(customArt.has(cardKey(card)))return Promise.resolve(customArt.get(cardKey(card)));
 const identity=JSON.stringify([card.name,card.scryfallId,card.set,card.collectorNumber]);
 if(!imageCache.has(identity))imageCache.set(identity,browser.runtime.sendMessage({type:'mrd-card-art',name:card.name,...(card.scryfallId?{printingId:card.scryfallId}:card.set&&card.collectorNumber?{printing:{set:card.set,collectorNumber:card.collectorNumber}}:{})}).then(reply=>{
  if(!reply?.ok||!reply.url)throw Error('No card image for '+card.name);
  return reply.url;
 }).catch(error=>{imageCache.delete(identity);throw error;}));
 return imageCache.get(identity);
}
prepare.addEventListener('click',async()=>{
 const run=++generation;prepare.disabled=true;print.disabled=true;$('sheets').replaceChildren();
 try{
  const gap=Number($('gap').value),margin=Number($('margin').value);
  if(!Number.isFinite(gap)||gap<0||gap>20||!Number.isFinite(margin)||margin<0||margin>25)throw Error('Use spacing from 0–20 mm and margins from 0–25 mm.');
  const [width,height]=$('paper').value==='a4'?[210,297]:[215.9,279.4];
  const cols=Math.floor((width-2*margin+gap)/(63+gap)),rows=Math.floor((height-2*margin+gap)/(88+gap)),perPage=cols*rows;
  if(!perPage)throw Error('These margins leave no room for a card.');
  const selected=selectedCards();
  const total=selected.reduce((sum,card)=>{if(!Number.isSafeInteger(card.qty)||card.qty<1)throw Error('Invalid card quantity. Reload the deck and try again.');return sum+($('copies').checked?card.qty:1);},0);
  if(total>1500)throw Error('Limit the export to 1,500 cards or turn off Print every copy.');
  const cards=selected.flatMap(card=>Array.from({length:$('copies').checked?card.qty:1},()=>card));
  if(!cards.length)throw Error('No cards match these options.');
  if(cards.length>1500)throw Error('Limit the export to 1,500 cards or turn off Print every copy.');
  pageRule.textContent='@page{size:'+width+'mm '+height+'mm;margin:0}';
  const left=(width-(cols*63+(cols-1)*gap))/2,top=(height-(rows*88+(rows-1)*gap))/2;
  const sheets=document.createDocumentFragment();let sheet;
  for(let i=0;i<cards.length;i++){
   if(run!==generation)return;
   status.textContent='Loading card images: '+(i+1)+' / '+cards.length;
   const url=await imageFor(cards[i]);if(run!==generation)return;
   if(i%perPage===0){sheet=document.createElement('section');sheet.className='sheet'+($('guides').checked?' guides':'');sheet.style.width=width+'mm';sheet.style.height=height+'mm';sheets.append(sheet);}
   const position=i%perPage,img=document.createElement('img');img.alt=cards[i].name;img.src=url;
   img.style.left=(left+(position%cols)*(63+gap))+'mm';img.style.top=(top+Math.floor(position/cols)*(88+gap))+'mm';sheet.append(img);
  }
  $('sheets').append(sheets);
  await Promise.all([...$('sheets').querySelectorAll('img')].map(img=>img.decode()));if(run!==generation)return;
  status.textContent=deck.name+' · '+cards.length+' cards · '+Math.ceil(cards.length/perPage)+' sheets · '+perPage+' cards per sheet';print.disabled=false;
 }catch(error){if(run===generation)status.textContent='Could not prepare sheets: '+error.message;}
 finally{if(run===generation)prepare.disabled=false;}
});
print.addEventListener('click',()=>window.print());
try{
 const tab=Number(new URLSearchParams(location.search).get('tab'));if(!Number.isInteger(tab)||tab<1)throw Error('Open export from a Moxfield deck.');
 const reply=await browser.tabs.sendMessage(tab,{type:'mrd-export-deck'});
 if(!reply?.ok||!Array.isArray(reply.deck?.cards)||reply.deck.cards.some(card=>!card||typeof card.name!=='string'||!Number.isSafeInteger(card.qty)||card.qty<0))throw Error(reply?.error||'Deck data is unavailable. Reload the Moxfield tab and try again.');
 deck=reply.deck;renderCardList();document.title=deck.name+' - Card sheets';$('status').textContent=deck.name+' · '+deck.cards.reduce((sum,c)=>sum+c.qty,0)+' cards loaded. Choose options and prepare sheets.';prepare.disabled=false;
}catch(error){status.textContent=error.message;}
})();
