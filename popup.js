/* Persistent feature switches for the extension action menu. */
(async()=>{
 const boxes=[...document.querySelectorAll('[data-feature]')],message=document.getElementById('message');
 const defaults={requirements:true,edhrec:true,printing:true,scryfall:true,deckSearch:true,pdf:true,explorer:true,sidebar:true,highlight:false,searchAdd:true,prefetchRoles:true};
 const syncStatus=document.getElementById('sync-status'),syncButtons=['sync-now','export-settings','import-settings'].map(id=>document.getElementById(id));
 const requestSync=async(action,values={})=>{const reply=await browser.runtime.sendMessage({type:'mrd-print-sync',action,...values});if(!reply?.ok)throw Error(reply?.error||'Print settings are unavailable. Reload LemField and try again.');return reply;};
 const showSync=status=>{syncStatus.textContent=status?.message||'Browser sync has not been checked yet.';};
 const withSync=async action=>{syncButtons.forEach(button=>{button.disabled=true;});try{await action();}catch(error){syncStatus.textContent=error.message;}finally{syncButtons.forEach(button=>{button.disabled=false;});}};
 document.getElementById('sync-now').addEventListener('click',()=>withSync(async()=>showSync((await requestSync('now')).status)));
 document.getElementById('export-settings').addEventListener('click',()=>withSync(async()=>{
  const {backup}=await requestSync('export'),url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download='lemfield-print-settings-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);syncStatus.textContent='Print settings exported. Import this file on your other device.';
 }));
 const importFile=document.getElementById('import-settings-file');
 document.getElementById('import-settings').addEventListener('click',()=>importFile.click());
 importFile.addEventListener('change',()=>withSync(async()=>{try{const file=importFile.files?.[0];if(!file)return;if(file.size>5*1024*1024)throw Error('Choose a backup smaller than 5 MB.');const reply=await requestSync('import',{backup:JSON.parse(await file.text())});syncStatus.textContent='Imported '+reply.count+' print settings. '+reply.status.message;}finally{importFile.value='';}}));
 requestSync('status').then(reply=>showSync(reply.status),error=>{syncStatus.textContent=error.message;});
 browser.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.mrd_print_sync_status_v1)showSync(changes.mrd_print_sync_status_v1.newValue);});
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
