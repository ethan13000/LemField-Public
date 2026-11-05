const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.children=[];this.dataset={};this.handlers={};const values={};this.style={cssText:'',setProperty:(k,v)=>values[k]=v,removeProperty:k=>delete values[k],getPropertyValue:k=>values[k]||''};}
 get isConnected(){return this.tag==='body'||!!this.parentElement?.isConnected;}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 after(node){node.remove();const parent=this.parentElement;node.parentElement=parent;parent.children.splice(parent.children.indexOf(this)+1,0,node);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
 addEventListener(type,fn){this.handlers[type]=fn;}
 matches(selector){return selector==='article,li,[role="listitem"]'?this.tag==='article':false;}
 closest(){return null;}
 querySelector(selector){return selector.includes('/cards/')?this.children.find(n=>n.tag==='a')||null:null;}
 querySelectorAll(selector){return selector.includes('/cards/')?this.children.filter(n=>n.tag==='a'):[];}
 getAttribute(name){return name==='data-card-name'&&this.tag==='a'&&this.textContent==='Sol Ring'?this.textContent:null;}
}
async function setup(hasDeck){
 const body=new Element('body'),tips=new Element('div','Advanced Search · Tips'),advanced=new Element('a','Advanced Search'),result=new Element('article'),card=new Element('a','Sol Ring');tips.append(advanced);result.append(card);body.append(tips,result);
 const context={location:{pathname:'/search/cards',origin:'https://moxfield.com'},window:{addEventListener(){}},document:{body,createElement:tag=>new Element(tag),createTextNode:text=>({nodeValue:text}),querySelector:()=>null,querySelectorAll:selector=>selector==='a,button'?[advanced]:selector==='a[href*="/cards/"]'?[card]:selector==='[data-mrd-search-original-display]'?[result]:[]},getComputedStyle:()=>({getPropertyValue:()=> '16px'}),MutationObserver:class{observe(){}},setTimeout,clearTimeout,MoxDecks:{current:async()=>null},MoxRules:{normalizeDeck:data=>data.cards},browser:{storage:{local:{get:async key=>key==='mrd_last_deck'?{mrd_last_deck:hasDeck?{id:'remembered',name:'My previous deck'}:null}:{}},onChanged:{addListener(){}}},runtime:{sendMessage:async message=>{assert.equal(message.id,'remembered');return {ok:true,data:{cards:[{name:'Sol Ring',qty:1,section:'mainboard'}]}};}}}};
 vm.createContext(context);await vm.runInContext(fs.readFileSync(require.resolve('../deck-search-filter.js'),'utf8'),context);await new Promise(setImmediate);
 const row=body.children.find(node=>node.id==='mrd-deck-search-filter-row');assert(row,'Global search places a checkbox beneath Advanced Search/Tips without native collection controls');
 return {row,checkbox:row.children[0].children[0],label:row.children[0].children[1],result};
}
(async()=>{
 const found=await setup(true);assert.equal(found.checkbox.disabled,false);assert.match(found.label.nodeValue,/My previous deck/);
 found.checkbox.checked=true;found.checkbox.handlers.change();assert.equal(found.result.style.getPropertyValue('display'),'none');assert.match(found.label.nodeValue,/1 excluded/);
 found.checkbox.checked=false;found.checkbox.handlers.change();assert.equal(found.result.style.getPropertyValue('display'),'');
 const absent=await setup(false);assert.equal(absent.checkbox.disabled,true);assert.match(absent.label.nodeValue,/open a deck first/);
 console.log('PASS: requirement/global search gets an exclusion checkbox without collection controls, loads the remembered deck, filters/restores results and handles missing deck context.');
})().catch(error=>{console.error(error);process.exitCode=1;});
