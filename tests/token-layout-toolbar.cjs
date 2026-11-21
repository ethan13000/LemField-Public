const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');require('../rules.js');
const source=fs.readFileSync(require.resolve('../edhrec.js'),'utf8'),context={};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function printingTokenDescription('),source.indexOf('function browsePrintings(')),context);
const label=context.printingTokenDescription({tokenColors:['G','W'],power:'1',toughness:'1',type:'Token Creature — Elf Warrior',set:'tc14',collectorNumber:'23'});assert.equal(label,'Green/White · 1/1 · Elf Warrior · TC14 #23');assert(!label.includes('?'));
const cards=global.MoxRules.normalizeDeck({boards:{tokens:{cards:{}}},tokens:[{id:'token',name:'Elf Warrior',layout:'token',type_line:'Token Creature — Elf Warrior'},{id:'regular',name:'Elvish Warmaster',layout:'normal',type_line:'Creature — Elf Warrior'},{id:'emblem',name:'Emblem',layout:'emblem',type_line:'Emblem — Nissa'}]});assert.equal(cards.length,2);assert(!cards.some(card=>card.id==='regular'));
const input={closest:()=>null},clone={closest:()=>null};let inputs=[input],created=0,moved=0,removed=0;
const toolbar={location:{pathname:'/decks/test'},featurePrefs:{mrd_features:{}},document:{querySelectorAll:selector=>selector.startsWith('input')?inputs:[]},visible:()=>true,legacyPrintingScope:()=>null,launchers:new Map(),createExplorerLauncher:()=>{created++;return {remove(){removed++;}};},placeLauncher:()=>moved++,nativeEDHREC:()=>false};
vm.createContext(toolbar);vm.runInContext(source.slice(source.indexOf('let persistentExplorer=null;'),source.indexOf('function schedule(){')),toolbar);toolbar.injectLaunchers();assert.equal(created,1,'Search toolbar gets Explorer without any EDHREC link');toolbar.injectLaunchers();assert.equal(created,1);assert.equal(moved,1);
inputs=[clone];toolbar.injectLaunchers();assert.equal(created,1,'Cloned sticky toolbar reuses existing launcher');assert.equal(moved,2);toolbar.location.pathname='/cards/test';toolbar.injectLaunchers();assert.equal(removed,1);
// New editor capture: View Options remains, but Find and add / EDHREC do not.
inputs=[];let modernControls=[{closest:()=>null}],lastSource,lastInput;
toolbar.document.querySelectorAll=selector=>selector.startsWith('input')?inputs:selector==='[data-testid="deck-view-options-open"]'?modernControls:[];
toolbar.createExplorerLauncher=(source,input)=>{created++;lastSource=source;lastInput=input;return {remove(){removed++;}};};
toolbar.placeLauncher=(source,host,input)=>{moved++;lastSource=source;lastInput=input;};
toolbar.location.pathname='/decks/test';toolbar.injectLaunchers();assert.equal(created,2,'New editor gets Explorer without a search field');assert.equal(lastSource,modernControls[0]);assert.equal(lastInput,null,'New toolbar placement does not wrap native controls in a search row');
modernControls=[{closest:()=>null}];toolbar.injectLaunchers();assert.equal(created,2,'Native toolbar redraw reuses the launcher');assert.equal(lastSource,modernControls[0]);
inputs=[input];toolbar.injectLaunchers();assert.equal(lastSource,input,'Legacy search field still takes priority when present');assert.equal(lastInput,input);
inputs=[];toolbar.featurePrefs.mrd_features.explorer=false;toolbar.injectLaunchers();assert.equal(removed,2,'Disabled Explorer removes the modern launcher');
console.log('PASS: readable token labels, no token-creator duplicates, independent persistent Explorer launcher and sticky-toolbar reanchoring.');

