'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const source=fs.readFileSync(require.resolve('../deck-print.js'),'utf8');let observer,timer;const state={menu:[],actions:[]};
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.style={setProperty(k,v){this[k]=v;}};this.attrs={};this.events={};this.visible=true;}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k]??null;}
  addEventListener(name,fn){this.events[name]=fn;}
  append(...nodes){for(const node of nodes){node.remove();this.children.push(node);node.parentElement=this;}}
  replaceChildren(...nodes){for(const c of [...this.children])c.remove();this.append(...nodes);}
  remove(){if(this.parentElement){const items=this.parentElement.children;items.splice(items.indexOf(this),1);this.parentElement=null;}}
  after(node){const parent=this.parentElement;assert(parent);node.remove();parent.children.splice(parent.children.indexOf(this)+1,0,node);node.parentElement=parent;}
  get previousElementSibling(){if(!this.parentElement)return null;const items=this.parentElement.children;return items[items.indexOf(this)-1]||null;}
  get nextElementSibling(){if(!this.parentElement)return null;const items=this.parentElement.children;return items[items.indexOf(this)+1]||null;}
  closest(selector){if(selector==='li')return this.tagName==='LI'?this:this.parentElement?.closest(selector)||null;if(selector.includes('[data-mrd-owned]'))return Object.hasOwn(this.attrs,'data-mrd-owned')?this:this.parentElement?.closest(selector)||null;return null;}
  matches(selector){return selector==='ul,ol'&&['UL','OL'].includes(this.tagName);}
  getClientRects(){return this.visible?[{}]:[];}
  querySelectorAll(selector){return selector.includes('data-testid=')?state.menu:state.actions;}
 }
 const main=new Element('main'),location={pathname:'/decks/test',origin:'https://moxfield.com'};
 const native=(tag,label,testid)=>{const n=new Element(tag);n.textContent=label;n.className='native-link';if(testid)n.setAttribute('data-testid',testid);return n;};
 const menu=(testid='deck-menu-playtest')=>{const ul=new Element('ul'),li=new Element('li'),action=native('a',testid==='deck-menu-playtest'?'Playtest':'More',testid);li.append(action);ul.append(li);main.append(ul);return {ul,li,action};};
 let top=menu();const prices=new Element('section'),buy=native('button','Buy Deck');prices.append(buy);main.append(prices);state.menu=[top.action];state.actions=[top.action,buy];
 const nodes=[];const context={location,document:{body:main,querySelector:()=>main,createElement:tag=>{const n=new Element(tag);nodes.push(n);return n;},createElementNS:(_ns,tag)=>new Element(tag)},getComputedStyle:()=>({getPropertyValue:()=>''}),browser:{storage:{local:{get:async()=>({})}},runtime:{sendMessage:async()=>({ok:true})}},window:{addEventListener(){}},MutationObserver:class{constructor(fn){observer=fn;}observe(){}},setTimeout:fn=>{timer=fn;return 1;}};
 await vm.runInNewContext(source,context);const button=nodes.find(n=>n.id==='mrd-deck-print');assert(button);
 const item=button.parentElement;assert.equal(item.tagName,'LI','Print has a valid list item wrapper');assert.equal(item.parentElement,top.ul);assert.equal(item.previousElementSibling,top.li);assert.equal(buy.nextElementSibling,null,'Prices Buy Deck does not receive Print');
 const scan=()=>{observer([{target:main}]);timer();};scan();assert.equal(top.ul.children.length,2,'Rescan does not duplicate the action');
 const replacement=menu('deck-menu-more-toggle');top.ul.remove();state.menu=[replacement.action];state.actions=[replacement.action,buy];scan();assert.equal(button.parentElement,item);assert.equal(item.parentElement,replacement.ul,'Move Print to remounted top menu');assert.equal(item.previousElementSibling,replacement.li,'More is a stable fallback when Playtest is absent');
 replacement.ul.remove();state.menu=[];const oldActions=new Element('div'),oldPlay=native('button','Playtest'),oldBuy=native('button','Buy Deck');oldActions.append(oldPlay,oldBuy);main.append(oldActions);state.actions=[oldPlay,oldBuy];scan();assert.equal(button.parentElement,oldActions,'Legacy editor placement remains supported');assert.equal(button.previousElementSibling,oldBuy);assert.equal(item.parentElement,null,'No empty LI remains after moving to the old editor');
 location.pathname='/cards/test';scan();assert.equal(button.parentElement,null);assert.equal(item.parentElement,null);
 console.log('PASS: new-editor Print action list structure, stable menu anchors, Prices exclusion, rerenders, legacy placement and route cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
