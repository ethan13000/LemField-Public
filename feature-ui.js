/* Style only extension-owned interfaces, including their shadow roots. */
(async()=>{
 'use strict';
 let prefs=(await browser.storage.local.get('mrd_features')).mrd_features||{};
 const roots=new Map();
 const owned='#mrd-root,#mrd-sidebar,[data-mrd-owned],.mrd-edhrec,.mrd-edh-launcher,[data-mrd-printings-host],[data-mrd-dialog-host]';
 const sheet=document.createElement('style');document.head.append(sheet);
 function update(){
  sheet.textContent=(prefs.sidebar===false?'#mrd-sidebar{display:none!important}':'')+(prefs.explorer===false?'.mrd-edh-launcher{display:none!important}':'')+(prefs.highlight?'#mrd-deck-print,#mrd-deck-print *,.mrd-search-add button,#mrd-deck-search-filter-row,#mrd-deck-search-filter-row *,#mrd-scryfall-add-row button{color:#ffab55!important;border-color:#ffab55!important;accent-color:#ffab55!important}':'');
  for(const [root,style] of roots){
   style.textContent=(prefs.explorer===false?'.edh-advanced{display:none!important}':'')+(prefs.highlight?':host{--purple:#ffab55!important}button,a,summary,h2,h3,label{color:#ffab55!important}button,input,select{border-color:#ffab55!important;accent-color:#ffab55!important}':'');
   if(!root.host.isConnected)roots.delete(root);
  }
 }
 function scan(nodes){
  let added=false;
  const hosts=new Set();
  for(const node of nodes||[]){
   if(node.nodeType!==1||node.closest?.('[data-mrd-owned]'))continue;
   if(node.matches?.(owned))hosts.add(node);
   for(const host of node.querySelectorAll?.(owned)||[])hosts.add(host);
  }
  for(const host of hosts){if(host.shadowRoot&&!roots.has(host.shadowRoot)){const style=document.createElement('style');host.shadowRoot.append(style);roots.set(host.shadowRoot,style);added=true;}}
  if(added)update();
 }
 let scanQueued=false;const pendingNodes=new Set();
 const observer=new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&!node.closest?.('[data-mrd-owned]'))pendingNodes.add(node);
  if(!pendingNodes.size||scanQueued)return;
  scanQueued=true;queueMicrotask(()=>{scanQueued=false;const nodes=[...pendingNodes];pendingNodes.clear();scan(nodes);});
 });
 observer.observe(document.body,{childList:true,subtree:true});
 browser.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.mrd_features){prefs=changes.mrd_features.newValue||{};update();scan();}});
 update();scan([document.documentElement]);
})();
