/* Persistent feature switches for the extension action menu. */
(async()=>{
 const boxes=[...document.querySelectorAll('[data-feature]')],message=document.getElementById('message');
 const defaults={requirements:true,edhrec:true,printing:true,scryfall:true,deckSearch:true,pdf:true,explorer:true,sidebar:true,highlight:false};
 document.getElementById('export-pdf').addEventListener('click',async()=>{
  const [tab]=await browser.tabs.query({active:true,currentWindow:true});
  if(!tab?.id||!/^https:\/\/(www\.)?moxfield\.com\/decks\//.test(tab.url||'')){message.textContent='Open a Moxfield deck first.';return;}
  await browser.tabs.create({url:browser.runtime.getURL('export.html')+'?tab='+tab.id});
 });
 const stored=await browser.storage.local.get('mrd_features');
 const features={...defaults,...(stored.mrd_features||{})};
 document.getElementById('export-pdf').hidden=features.pdf===false;
 for(const box of boxes){
  box.checked=features[box.dataset.feature]===true;
  box.addEventListener('change',async()=>{
   const previous=features[box.dataset.feature];features[box.dataset.feature]=box.checked;
   document.getElementById('export-pdf').hidden=features.pdf===false;
   try{await browser.storage.local.set({mrd_features:features});message.textContent='Saved. Refresh Moxfield tabs to apply feature changes.';}
   catch(error){features[box.dataset.feature]=previous;box.checked=previous;document.getElementById('export-pdf').hidden=features.pdf===false;message.textContent='Could not save: '+error.message;}
  });
 }
})().catch(error=>{document.getElementById('message').textContent='Could not load settings: '+error.message;});
