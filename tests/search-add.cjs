const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../search-add.js'),'utf8');
class Element{
 constructor(){this.children=[];this.style={cssText:'',setProperty(){}};this.handlers={};this.attributes={};this.textContent='';}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(type,handler){this.handlers[type]=handler;}
 append(...children){this.children.push(...children);}
 after(node){this.afterNode=node;}
}
(async()=>{
 const body={},context={document:{body,createElement:()=>new Element()},getComputedStyle:()=>({getPropertyValue:()=> '16px'}),entries:new Map(),globalThis:null};context.globalThis=context;
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf(' const clean='),source.indexOf(' let remembered=')),context);
 const anchor=text=>({textContent:text,closest:()=>null,getAttribute:()=>null,querySelector:()=>null});
 const row={parentElement:body,querySelectorAll:()=>[anchor('Swords to Plowshares'),anchor('Details')]};
 assert.equal(context.cardFor({parentElement:row}).name,'Swords to Plowshares');
 assert.equal(context.cardFor({parentElement:{parentElement:body,querySelectorAll:()=>[anchor('Sol Ring'),anchor('Swamp')]}}),null,'Never guess a card from multiple results');
 let calls=0,resolve;
 context.MoxDecks={add:(card,id,board)=>{calls++;assert.equal(card.name,'Swords to Plowshares');assert.equal(id,'deckA');assert.equal(board,'mainboard');return new Promise(r=>{resolve=r;});}};
 vm.runInContext(source.slice(source.indexOf(' function install('),source.indexOf(' function scan(')),context);
 const entry=context.install(new Element(),{name:'Swords to Plowshares'});entry.target={id:'deckA',name:'My deck'};
 const event={preventDefault(){},stopPropagation(){}};
 const first=entry.button.handlers.click(event);await entry.button.handlers.click(event);assert.equal(calls,1,'Double click cannot duplicate an in-flight write');
 resolve({deck:{name:'My deck'}});await first;assert.match(entry.button.textContent,/Added to My deck/);assert.equal(entry.button.disabled,true);
 context.MoxDecks.add=async()=>{throw Error('Add result unknown. Check the deck.');};
 const failed=context.install(new Element(),{name:'Swords to Plowshares'});failed.target={id:'deckA',name:'My deck'};await failed.button.handlers.click(event);assert.equal(failed.locked,true,'Uncertain writes cannot be retried by repeated clicks');
 console.log('PASS: search result identity, multi-result rejection, explicit remembered target/mainboard, in-flight double-click protection and uncertain-write lockout.');
})().catch(error=>{console.error(error);process.exitCode=1;});
