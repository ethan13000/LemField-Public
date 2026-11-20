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
 closest(selector){for(let node=this;node;node=node.parentElement){if(selector==='[data-card-id]'&&node.attributes['data-card-id'])return node;if(selector.startsWith('[data-mrd-owned]')&&node.attributes['data-mrd-owned'])return node;}return null;}
 descendants(){return this.children.flatMap(node=>[node,...node.descendants()]);}
 querySelectorAll(selector){const nodes=this.descendants();if(selector.startsWith('h1,')){const tags=selector.split(',');return nodes.filter(node=>tags.includes(node.tag)||node.attributes.role==='heading');}if(selector.includes('a[href'))return nodes.filter(node=>node.tag==='a'||node.attributes['data-card-name']);return [];}
 querySelector(selector){if(selector.includes('a[href'))return this.querySelectorAll(selector)[0]||null;return this.descendants().find(node=>selector==='img'?node.tag==='img':selector.startsWith('button')?node.tag==='button':false)||null;}
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
 console.log('PASS: native-row/group checkboxes, mixed selection state, regrouping, ambiguity exclusions, click isolation, rerenders, select/clear, reviewed cancel/submit, 25-entry batching and route cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
