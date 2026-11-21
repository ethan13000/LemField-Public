'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
class Element{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.children=[];this.attributes={};this.style={};this.dataset={};this.events={};this.value='';this.checked=false;this.disabled=false;this.parentElement=null;}
 append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
 remove(){if(this.parentElement){const siblings=this.parentElement.children,index=siblings.indexOf(this);if(index>=0)siblings.splice(index,1);}this.parentElement=null;}
 before(node){node.remove();node.parentElement=this.parentElement;this.parentElement.children.splice(this.parentElement.children.indexOf(this),0,node);}
 setAttribute(name,value){this.attributes[name]=value;}
 getAttribute(name){return this.attributes[name]??null;}
 addEventListener(type,fn){this.events[type]=fn;}
 get isConnected(){return this.tag==='body'||!!this.parentElement?.isConnected;}
 get selectedOptions(){return this.children.filter(node=>node.value===this.value);}
 get nextElementSibling(){const siblings=this.parentElement?.children||[];return siblings[siblings.indexOf(this)+1]||null;}
 contains(node){return node===this||this.descendants().includes(node);}
 compareDocumentPosition(node){let root=this;while(root.parentElement)root=root.parentElement;const order=[root,...root.descendants()];return order.indexOf(node)>order.indexOf(this)?4:2;}
 closest(selector){for(let node=this;node;node=node.parentElement){if(selector==='ul'&&node.tag==='ul')return node;if(selector==='button,a,[role="button"]'&&(node.tag==='button'||node.tag==='a'||node.attributes.role==='button'))return node;const test=selector.match(/^\[data-testid="([^"]+)"\]$/);if(test&&node.attributes['data-testid']===test[1])return node;if(selector==='[data-card-id]'&&node.attributes['data-card-id'])return node;if(selector.startsWith('[data-mrd-owned]')&&node.attributes['data-mrd-owned'])return node;}return null;}
 descendants(){return this.children.flatMap(node=>[node,...node.descendants()]);}
 querySelectorAll(selector){const nodes=this.descendants();const testIDs=[...selector.matchAll(/\[data-testid="([^"]+)"\]/g)].map(match=>match[1]);if(testIDs.length)return nodes.filter(node=>testIDs.includes(node.attributes['data-testid']));if(selector.startsWith('h1,')){const tags=selector.split(',');return nodes.filter(node=>tags.includes(node.tag)||node.attributes.role==='heading');}if(selector.includes('a[href'))return nodes.filter(node=>node.tag==='a'||node.attributes['data-card-name']);return [];}
 querySelector(selector){if(selector.startsWith('[data-testid='))return this.querySelectorAll(selector)[0]||null;if(selector.includes('a[href'))return this.querySelectorAll(selector)[0]||null;return this.descendants().find(node=>selector==='img'?node.tag==='img':selector.startsWith('button')?node.tag==='button':false)||null;}
}
(async()=>{
 const body=new Element('body'),events={},timers=[];let observer,confirmed=true,submissions=0,confirmText='';
 function nativeRow(name){const row=new Element('div'),link=new Element('a',name),nativeButton=new Element('button','Menu');row.append(link,nativeButton);body.append(row);return {row,link};}
 const alpha=nativeRow('Alpha'),beta=nativeRow('Beta'),ambiguous=nativeRow('Ambiguous'),commander=nativeRow('Commander');
 const creatureGroup=new Element('div'),creatureHeading=new Element('a','Creatures\n (2)');creatureGroup.append(creatureHeading,alpha.row,beta.row);body.append(creatureGroup);
 const state={boards:{mainboard:{cards:[{card:{id:'a',name:'Alpha'},quantity:3},{card:{id:'b',name:'Beta'},quantity:1},{card:{id:'c',name:'Ambiguous'},quantity:1}]},sideboard:{cards:[{card:{id:'c',name:'Ambiguous'},quantity:1}]},commanders:{cards:[{card:{id:'cmd',name:'Commander'},quantity:1}]}}};
 const context={document:{body,createElement:tag=>new Element(tag),querySelectorAll:selector=>body.querySelectorAll(selector)},location:{pathname:'/decks/public',origin:'https://moxfield.com',reload(){}},window:{addEventListener:(name,fn)=>events[name]=fn,confirm:text=>{confirmText=text;return confirmed;}},setTimeout:fn=>{timers.push(fn);return timers.length;},MutationObserver:class{constructor(fn){observer=fn;}observe(){}},MoxDecks:{readCurrent:async()=>structuredClone(state),bulkSelection:async(plan,id)=>{assert.equal(id,'public');assert.equal(plan.entries[0].quantity,3);submissions++;return {acknowledged:plan.entries.length};}}};
 vm.createContext(context);for(const file of ['deck-selection-model.js','deck-selection.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),context);
 const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};await settle();
 const nodes=()=>body.descendants(),checkboxes=()=>nodes().filter(node=>node.tag==='input'&&node.type==='checkbox'&&!Object.hasOwn(node.parentElement.attributes,'data-mrd-group-select')),groupBoxes=()=>nodes().filter(node=>node.tag==='input'&&Object.hasOwn(node.parentElement?.attributes||{},'data-mrd-group-select')),find=text=>nodes().find(node=>node.tag==='button'&&node.textContent===text),count=()=>nodes().find(node=>node.tag==='strong').textContent;
 assert.equal(checkboxes().length,2,'Only unambiguous editable list rows receive checkboxes');assert.equal(ambiguous.row.children.length,2,'Same printing in multiple boards is not guessed');assert.equal(commander.row.children.length,2,'Commander rows stay excluded');
 const bar=nodes().find(node=>node.attributes['data-mrd-owned']==='deck-selection');
 assert.equal(bar.hidden,true,'Toolbar starts hidden with no selection');assert.equal(bar.style.display,'none');
 assert.equal(nodes().filter(node=>node.tag==='button'&&node.textContent==='Move to').length,1,'One move action replaces the separate destination buttons');
 assert.equal(nodes().filter(node=>node.tag==='select').length,1,'Destination is the only dropdown; source is inferred from card rows');
 const first=checkboxes()[0];first.checked=true;first.onchange({stopPropagation(){}});assert.equal(count(),'1 selected');assert.equal(find('Remove selected').disabled,false);assert.equal(bar.hidden,false);assert.equal(bar.style.display,'flex','First selection shows the toolbar');
 assert.equal(groupBoxes().length,1,'One checkbox is attached to the rendered group heading');const group=groupBoxes()[0];assert.equal(group.indeterminate,true,'Partially selected group is mixed');assert.equal(group.getAttribute('aria-checked'),'mixed');
 group.checked=true;group.onchange({stopPropagation(){}});assert.equal(count(),'2 selected','Group checkbox selects every member');assert.equal(group.checked,true);assert.equal(group.indeterminate,false);
 group.checked=false;group.onchange({stopPropagation(){}});assert.equal(count(),'0 selected','Unchecking group clears every member');assert.equal(bar.hidden,true);
 first.checked=true;first.onchange({stopPropagation(){}});
 let stopped=false;first.parentElement.events.click({stopPropagation(){stopped=true;}});assert(stopped,'Checkbox clicks stop before native card handlers');
 observer([{target:body}]);timers.splice(0).forEach(fn=>fn());assert.equal(checkboxes().length,2,'Rescans do not duplicate controls');assert.equal(checkboxes()[0].checked,true,'Rescan retains selected identity');
 assert.equal(groupBoxes().length,1,'Rescans do not duplicate group controls');
 const tagGroup=new Element('div'),tagHeading=new Element('span','Custom role (1)');tagGroup.append(tagHeading,beta.row);creatureGroup.append(tagGroup);creatureHeading.textContent='Creatures (1)';observer([{target:body}]);timers.splice(0).forEach(fn=>fn());
 assert.equal(groupBoxes().length,2,'Regrouping adds the new heading control');assert.equal(group.checked,true,'Old group now reflects only its remaining card');
 const tagCheckbox=groupBoxes().find(input=>input.getAttribute('aria-label').includes('Custom role'));tagCheckbox.checked=true;tagCheckbox.onchange({stopPropagation(){}});assert.equal(count(),'2 selected','A non-type group selects its own rendered members');
 find('Clear').onclick();assert.equal(count(),'0 selected');assert.equal(bar.hidden,true,'Clear hides the toolbar');find('Select listed').onclick();assert.equal(count(),'2 selected');find('Clear').onclick();
 first.checked=true;first.onchange({stopPropagation(){}});confirmed=false;await find('Remove selected').onclick();await settle();assert.equal(submissions,0,'Cancel never submits');assert.match(confirmText,/3 copies/,'Review shows whole-entry quantities');
 first.checked=true;first.onchange({stopPropagation(){}});confirmed=true;await find('Remove selected').onclick();await settle();assert.equal(submissions,1);assert.equal(count(),'0 selected','Completed writes clear selection');assert.equal(bar.hidden,true,'Completed operations hide the selection toolbar');assert(nodes().some(node=>node.attributes['data-mrd-owned']==='deck-selection-feedback'),'Operation feedback remains accessible after the toolbar hides');
 context.location.pathname='/decks/another';events.popstate();await settle();assert.equal(count(),'0 selected','Navigation clears selection');
 const largeGroup=new Element('div'),largeHeading=new Element('button','Mana value 1 (25)');largeGroup.append(largeHeading);body.append(largeGroup);
 for(let index=0;index<25;index++){const name='Group card '+index;state.boards.mainboard.cards.push({card:{id:'g'+index,name},quantity:1});largeGroup.append(nativeRow(name).row);}
 events['mrd-current-deck-updated']();await settle();const largeCheckbox=groupBoxes().find(input=>input.getAttribute('aria-label').includes('Mana value 1'));assert(largeCheckbox);largeCheckbox.checked=true;largeCheckbox.onchange({stopPropagation(){}});assert.equal(count(),'25 selected','Entire groups can exceed one write batch');
 const batches=[];context.MoxDecks.bulkSelection=async plan=>{batches.push(plan.entries.length);return {acknowledged:plan.entries.length};};await find('Remove selected').onclick();await settle();assert.deepEqual(batches,[20,5],'Large selection is written in bounded batches without truncation');
 for(let index=25;index<45;index++){const name='Group card '+index;state.boards.mainboard.cards.push({card:{id:'g'+index,name},quantity:1});largeGroup.append(nativeRow(name).row);}largeHeading.textContent='Mana value 1 (45)';events['mrd-current-deck-updated']();await settle();
 const failedGroup=groupBoxes().find(input=>input.getAttribute('aria-label').includes('Mana value 1'));failedGroup.checked=true;failedGroup.onchange({stopPropagation(){}});const failedBatches=[];
 context.MoxDecks.bulkSelection=async plan=>{failedBatches.push(plan.entries.length);if(failedBatches.length===2)throw Error('Uncertain write; check deck');return {acknowledged:plan.entries.length};};await find('Remove selected').onclick();await settle();assert.deepEqual(failedBatches,[20,20],'Failed batch prevents the third batch and is not retried');assert(nodes().some(node=>node.textContent.includes('20 entries completed before this batch stopped.')),'Earlier completed batches are reported after a later failure');
 context.location.pathname='/search/cards';events.popstate();await settle();assert(!body.children.some(node=>node.attributes['data-mrd-owned']==='deck-selection'),'Toolbar removed off deck routes');assert.equal(checkboxes().length,0);
 // Moxfield displays face names while the deck API can use a combined card name.
 state.boards={mainboard:{cards:[
  {card:{id:'adventure',name:'Grave Researcher // Reanimate'},quantity:2},
  {card:{id:'battle',name:'Invasion of Ikoria // Zilortha, Apex of Ikoria'},quantity:1},
  {card:{id:'faces',name:'API title',cardFaces:[{name:'Visible face'},{name:'Other face'}]},quantity:1},
  {card:{id:'shared-a',name:'Shared face // First spell'},quantity:1},
  {card:{id:'shared-b',name:'Shared face // Second spell'},quantity:1}
 ]},sideboard:{cards:[]},maybeboard:{cards:[]}};
 const adventure=nativeRow('Grave Researcher'),battle=nativeRow('Invasion of Ikoria'),face=nativeRow('Visible face'),sharedA=nativeRow('Shared face'),sharedB=nativeRow('Shared face');
 const adventureGroup=new Element('div'),adventureHeading=new Element('a','Adventure cards (1)');adventureGroup.append(adventureHeading,adventure.row);body.append(adventureGroup);
 // Both face links within one native row still receive only one checkbox.
 adventure.row.append(new Element('a','Reanimate'));
 context.location.pathname='/decks/public';events.popstate();await settle();
 assert.equal(checkboxes().length,3,'Adventure, battle and metadata-only face names receive checkboxes');
 assert.equal(sharedA.row.children.length,2,'Ambiguous face names stay unselectable');assert.equal(sharedB.row.children.length,2);
 assert.equal(adventure.row.descendants().filter(node=>node.tag==='input').length,1,'Multiple face links in one row share a checkbox');
 assert(battle.row.descendants().some(node=>node.tag==='input'),'Double-faced battle front is selectable');assert(face.row.descendants().some(node=>node.tag==='input'),'Explicit API face metadata is recognized');
 const adventureCheckbox=groupBoxes().find(input=>input.getAttribute('aria-label').includes('Adventure cards'));assert(adventureCheckbox);adventureCheckbox.checked=true;adventureCheckbox.onchange({stopPropagation(){}});assert.equal(count(),'1 selected','Adventure group selection includes its displayed front face');
 let adventurePlan;context.MoxDecks.bulkSelection=async(plan,id)=>{assert.equal(id,'public');adventurePlan=plan;return {acknowledged:1};};await find('Remove selected').onclick();await settle();
 assert.equal(adventurePlan.entries[0].id,'adventure');assert.equal(adventurePlan.entries[0].name,'Grave Researcher // Reanimate');assert.equal(adventurePlan.entries[0].quantity,2,'Face-name selection retains exact printing and full quantity');

 const editorBody=new Element('body'),editorEvents={},editorTimers=[];let editorObserver;
 function editorGroup(title){const ul=new Element('ul'),headingRow=new Element('li'),heading=new Element('a'),label=new Element('span',title),total=new Element('span','(2)');label.setAttribute('data-testid','deck-view-header-options-title');total.setAttribute('data-testid','deck-view-header-options-total');heading.attributes.role='button';heading.append(label,total);headingRow.append(heading);ul.append(headingRow);editorBody.append(ul);return {ul,heading};}
 function editorRow(group,id,rowKey,name){const li=new Element('li'),link=new Element('a',name),options=new Element('a','Options');li.setAttribute('data-testid','deck-view-table-row');link.setAttribute('data-testid','deck-view-table-row-name');li.setAttribute('data-hash',id);li.setAttribute('data-row-key',rowKey);options.setAttribute('data-testid','deck-view-table-row-options-trigger');options.attributes.role='button';li.append(link,options);group.ul.append(li);return {li,link};}
 const mainGroup=editorGroup('Creatures'),sideGroup=editorGroup('Sideboard'),maybeGroup=editorGroup('Considering'),commanderGroup=editorGroup('Commander'),curveGroup=editorGroup('Mana value 3'),tokenGroup=editorGroup('Tokens');
 const mainAlpha=editorRow(mainGroup,'same','mainboard-main-3|same','Front'),sideAlpha=editorRow(sideGroup,'same','sideboard-main-3|same','Back'),maybeBeta=editorRow(maybeGroup,'other','maybeboard-main-1|other','Other');
 const nativeCommander=editorRow(commanderGroup,'cmd','mainboard-commander-0|cmd','Commander'),nativeCurve=editorRow(curveGroup,'same','curve-6|same','Front'),nativeToken=editorRow(tokenGroup,'other','tokens-main-0|other','Other');
 const hashMismatch=editorRow(mainGroup,'same','mainboard-main-3|other','Front'),unsupported=editorRow(mainGroup,'same','mainboard-companion-0|same','Front');
 const legacyAnalysis=new Element('div');legacyAnalysis.append(new Element('a','Other'),new Element('button','Details'));editorBody.append(legacyAnalysis);
 const editorState={boards:{mainboard:{cards:[{quantity:2,card:{id:'same',name:'Front // Back'}}]},sideboard:{cards:[{quantity:1,card:{id:'same',name:'Front // Back'}}]},maybeboard:{cards:[{quantity:1,card:{id:'other',name:'Other'}}]},commanders:{cards:[{quantity:1,card:{id:'cmd',name:'Commander'}}]}}};
 const editorContext={document:{body:editorBody,createElement:tag=>new Element(tag),querySelectorAll:selector=>editorBody.querySelectorAll(selector)},location:{pathname:'/decks/neweditor',origin:'https://moxfield.com'},window:{addEventListener:(name,fn)=>editorEvents[name]=fn,confirm:()=>false},setTimeout:fn=>{editorTimers.push(fn);return editorTimers.length;},MutationObserver:class{constructor(fn){editorObserver=fn;}observe(){}},MoxDecks:{readCurrent:async()=>structuredClone(editorState)}};
 vm.createContext(editorContext);for(const file of ['deck-selection-model.js','deck-selection.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),editorContext);await settle();
 const editorNodes=()=>editorBody.descendants(),editorCheckboxes=()=>editorNodes().filter(node=>node.tag==='input'&&node.type==='checkbox'&&!Object.hasOwn(node.parentElement.attributes,'data-mrd-group-select')),editorGroupBoxes=()=>editorNodes().filter(node=>node.tag==='input'&&Object.hasOwn(node.parentElement?.attributes||{},'data-mrd-group-select'));
 assert.equal(editorCheckboxes().length,3,'New editor uses exact board+hash identity even when the printing occurs on multiple boards');
 assert(editorCheckboxes().some(input=>input.getAttribute('aria-label').includes('from mainboard')));assert(editorCheckboxes().some(input=>input.getAttribute('aria-label').includes('from sideboard')));assert(editorCheckboxes().some(input=>input.getAttribute('aria-label').includes('from maybeboard')));
 for(const {li} of [nativeCommander,nativeCurve,nativeToken,hashMismatch,unsupported])assert.equal(li.descendants().filter(node=>node.tag==='input').length,0,'Commander, analysis, token, mismatched and unsupported rows cannot receive selection controls');
 assert.equal(legacyAnalysis.descendants().filter(node=>node.tag==='input').length,0,'Legacy fallback never scans analysis links when stable native editor rows are present');
 assert.equal(editorGroupBoxes().length,3,'Only actual editable deck groups receive selection controls');const mainBox=editorGroupBoxes().find(input=>input.getAttribute('aria-label').includes('Creatures'));mainBox.checked=true;mainBox.onchange({stopPropagation(){}});assert.equal(editorCheckboxes().filter(input=>input.checked).length,1,'Native group selection includes only editable member rows in its own ul');assert(editorCheckboxes().find(input=>input.checked).getAttribute('aria-label').includes('from mainboard'));
 const modernModel=editorContext.MoxDeckSelection;assert.equal(modernModel.nativeIdentity('curve-6|same','same'),null);assert.equal(modernModel.nativeIdentity('mainboard-main-3|same','different'),null);assert.equal(modernModel.nativeIdentity('mainboard-commander-0|cmd','cmd'),null);
 editorObserver([{target:editorBody}]);editorTimers.splice(0).forEach(fn=>fn());assert.equal(editorCheckboxes().length,3,'New editor rescans preserve one checkbox per exact entry');assert.equal(editorGroupBoxes().length,3);
 const editorMarker=new Element('button','Group by');editorMarker.setAttribute('data-testid','deck-view-options-group-by');editorBody.append(editorMarker);for(const native of editorBody.querySelectorAll('[data-testid="deck-view-table-row"]'))native.remove();editorObserver([{target:editorBody}]);editorTimers.splice(0).forEach(fn=>fn());assert.equal(editorCheckboxes().length,0,'Empty or transitioning new editors never fall back to selecting unrelated analysis links');
 console.log('PASS: new editor board/hash rows, same-printing board isolation, face-name aliases, native ul groups and analysis/commander/token exclusions.');
 console.log('PASS: native-row/group checkboxes, mixed selection state, regrouping, ambiguity exclusions, click isolation, rerenders, select/clear, reviewed cancel/submit, 25-entry batching and route cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
