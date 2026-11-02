/* Focused regressions for the Alpha 4 controls and export allocation limit. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../deck-search-filter.js'),'utf8');
class Element{
 constructor(){this.style={setProperty(){}};this.listeners={};this.className='';}
 addEventListener(type,fn){this.listeners[type]=fn;}
 append(...nodes){this.children=nodes;}
 replaceChildren(node){this.child=node;}
}
const native=new Element();native.className='native-checkbox';native.cloneNode=()=>{throw Error('Native input must not be cloned');};
const collection={querySelector:selector=>selector==='label'?null:native};
const context={document:{createElement:()=>new Element(),createTextNode:text=>({nodeValue:text})},getComputedStyle:()=>({getPropertyValue:()=> '20px'}),controlRow:new Element(),apply:()=>{}};
vm.createContext(context);
vm.runInContext('let template,control,checkbox,labelText,enabled=false;'+source.slice(source.indexOf('function makeControl('),source.indexOf('function resultCard('))+';globalThis.make=makeControl;globalThis.state=()=>({checkbox,enabled});',context);
context.make(collection);
const input=context.state().checkbox;
assert.equal(input.className,'native-checkbox');
for(const checked of [true,false,true,false]){input.checked=checked;input.listeners.change();assert.equal(context.state().enabled,checked,'Both check and uncheck must update filter state');}
// Browser handlers must receive neither the checkbox click nor its label activation.
assert(source.includes("['click','input','change']"));
const exportSource=fs.readFileSync(require.resolve('../export.js'),'utf8');
const selection=exportSource.slice(exportSource.indexOf('  const selected=selectedCards();'),exportSource.indexOf('  pageRule.textContent='));
const run=cards=>vm.runInNewContext(selection,{selectedCards:()=>cards,$:()=>({checked:true})});
assert.throws(()=>run([{qty:1e12}]),/1,500/);
assert.throws(()=>run([{qty:Infinity}]),/Invalid card quantity/);
assert.doesNotThrow(()=>run([{qty:2}]));
require('../edhrec-data.js');require('../card-search.js');
const C=global.MoxCardSearch;
const cards=[{id:'new',name:'Card',releasedAt:'2025-01-01',tags:[]},{id:'old',name:'Card',releasedAt:'1993-01-01',tags:[]},{id:'unknown',name:'Card',releasedAt:'',tags:[]}];
assert.deepEqual(C.printings(cards,{sort:'oldest'}).map(c=>c.id),['old','new','unknown']);
console.log('PASS: checkbox on/off state, fresh native-sized input, export bounds before allocation, and oldest-first sorting.');
