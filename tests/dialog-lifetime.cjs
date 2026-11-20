const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.listeners={};}
 get isConnected(){return this.root===true||!!this.parent?.isConnected;}
 append(...children){for(const child of children){child.remove();child.parent=this;this.children.push(child);}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
 attachShadow(){this.shadowRoot=new Element('shadow');this.shadowRoot.parent=this;return this.shadowRoot;}
 setAttribute(name,value){this.attributes[name]=value;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 showModal(){assert(this.isConnected);this.open=true;}
 close(){this.open=false;this.listeners.close?.();}
 focus(){this.focused=true;}
}
const source=fs.readFileSync(require.resolve('../edhrec.js'),'utf8'),body=new Element('body');body.root=true;
const el=(tag,text)=>Object.assign(new Element(tag),{textContent:text}),openDialogs=new Set();
const ctx={el,button:(text,onclick)=>Object.assign(el('button',text),{onclick}),document:{body,activeElement:body},crypto,openDialogs,hideHover:()=>{},cleanArt:()=>{},addedInEDHRECPlus:false,printingChangedInDialog:false,notifyDeckChanged:()=>{ctx.addedInEDHRECPlus=false;ctx.printingChangedInDialog=false;ctx.refreshNotices=(ctx.refreshNotices||0)+1;},location:{reload:()=>{throw Error('Unexpected reload');}},MoxDashboardStyleURL:'dashboard.css'};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('let windowHost=null;'),source.indexOf('const artwork=new Map()')),ctx);
const pageSection=el('section'),launcher=el('span');launcher.attachShadow();pageSection.append(launcher);body.append(pageSection);
const first=ctx.dialog({host:launcher},'EDHREC Plus'),input=el('input');input.value='Keep my search';first.body.append(input);
pageSection.remove();assert(first.modal.open&&first.modal.isConnected,'Removing the original page section must not remove the open window');assert.equal(input.value,'Keep my search');
const nested=ctx.dialog({host:launcher},'Card details');assert(nested.modal.isConnected);nested.close();assert(first.modal.isConnected&&first.modal.open);assert.equal(openDialogs.size,1);
first.modal.close();assert.equal(first.modal.isConnected,false);assert.equal(openDialogs.size,0);
let reloads=0;ctx.location.reload=()=>{reloads++;};
for(const flag of ['addedInEDHRECPlus','printingChangedInDialog']){
 const explorer=ctx.dialog({host:launcher},'Card Explorer'),picker=ctx.dialog({host:launcher},'Add card to deck');
 ctx[flag]=true;const before=reloads,notices=ctx.refreshNotices||0;picker.close();
 assert.equal(reloads,before,'Closing a nested picker must preserve Explorer without reloading');assert(explorer.modal.open);assert.equal(ctx[flag],true,'Keep pending refresh until the outer window closes');
 explorer.close();assert.equal(reloads,before,'Closing the outer window never forces a reload');assert.equal(ctx.refreshNotices,notices+1,'Offer manual refresh after the outer window closes');explorer.close();assert.equal(ctx.refreshNotices,notices+1,'Closing twice does not repeat refresh notices');
}
const untouched=ctx.dialog({host:launcher},'Add card to deck'),beforeCancel=reloads;untouched.close();assert.equal(reloads,beforeCancel,'Cancelling without writes never reloads');
require('../card-search.js');ctx.C=globalThis.MoxCardSearch;
vm.runInContext(source.slice(source.indexOf('const cardTypeSymbols='),source.indexOf("function tile(view,card,mode='art')")),ctx);
const icons=ctx.typeSymbols({type:'Legendary Artifact Creature — Golem',tags:['Artifacts','Creature','Flying']});
assert.equal(icons.length,2);assert.deepEqual(Array.from(icons,icon=>icon.title),['Creature','Artifact']);
for(const icon of icons){assert.equal(icon.attributes['aria-label'],icon.title);assert.equal(icon.tabIndex,0);}
assert.equal(ctx.typeSymbols({tags:['Instants']})[0].title,'Instant');assert.equal(ctx.typeSymbols({type:'Enchantment — Creaturehood'})[0].title,'Enchantment');
console.log('PASS: windows survive source removal, preserve search state, close independently, and expose accessible card-type symbols.');
