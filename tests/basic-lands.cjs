const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let observer,scheduled;const location={pathname:'/decks/test'},nodes=[];
class Element{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.style={};this.isConnected=true;this.children=[];}
 setAttribute(){}
 closest(selector){if(selector.startsWith('[data-mrd-owned]'))return null;return ['button','a'].includes(this.tag)?this:this.parent?.closest(selector)||null;}
 contains(other){return this.children.includes(other);}
 after(node){this.nextElementSibling=node;node.isConnected=true;}
 remove(){this.isConnected=false;}
}
const div=new Element('div','Lands (2)'),span=new Element('span','Lands (2)');div.children=[span];span.parent=div;nodes.push(div,span,new Element('div','Lands (2) Command Tower Jungle Shrine'));
const context={location,document:{body:{},querySelectorAll:()=>nodes,createElement:tag=>new Element(tag)},window:{addEventListener(){}},MutationObserver:class{constructor(fn){observer=fn;}observe(){}},setTimeout:fn=>{scheduled=fn;return 1;}};
vm.runInNewContext(fs.readFileSync(require.resolve('../basic-lands.js'),'utf8'),context);
const first=span.nextElementSibling;assert.equal(first.textContent,'Add basic lands');assert.equal(div.nextElementSibling,undefined,'Do not add duplicates to wrapper labels');
function scan(){observer([{target:{}}]);scheduled();}
scan();assert.equal(span.nextElementSibling,first,'Keep one launcher on rescans');
first.isConnected=false;scan();assert.equal(first.isConnected,true,'Restore removed launcher');
span.isConnected=false;div.isConnected=false;nodes.length=0;
const button=new Element('button','Lands (3)');nodes.push(button);scan();assert.equal(button.nextElementSibling.textContent,'Add basic lands');assert.equal(first.isConnected,false,'Remove stale launcher');
location.pathname='/decks/personal';// This route has no matching native land label in practice.
location.pathname='/cards/test';scan();assert.equal(button.nextElementSibling.isConnected,false,'Remove launcher off deck pages');
console.log('PASS: non-heading Lands labels, nested wrapper deduplication, native button siblings, rerenders and route cleanup.');
