const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
const handlers={},opened=[];
const window={addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn)};
const location={pathname:'/decks/test',origin:'https://moxfield.com'};
const context={window,location,browser:{storage:{local:{get:async()=>({})}}},KeyboardEvent:class{},MoxPrintings:{open:card=>opened.push(card)}};
await vm.runInNewContext(fs.readFileSync(require.resolve('../printing-shortcuts.js'),'utf8'),context);
function card(name){return {closest:selector=>selector==='[data-card-name]'?{getAttribute:()=>name}:null};}
function fire(type,target,values={}){const event={type,target,button:0,ctrlKey:false,shiftKey:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...values};for(const fn of handlers[type]||[]){fn(event);if(event.stopped)break;}return event;}
const sol=card('Sol Ring');
assert(!fire('click',sol).prevented,'Ordinary clicks keep native behavior');
assert(!fire('click',sol,{ctrlKey:true}).prevented,'Ctrl alone keeps native behavior');
assert(fire('pointerdown',sol,{ctrlKey:true,shiftKey:true}).prevented);assert.equal(opened.length,0,'Pointerdown suppresses native picker without opening twice');
assert(fire('click',sol,{ctrlKey:true,shiftKey:true}).prevented);assert.equal(opened[0].name,'Sol Ring');
assert(!fire('click',{closest:()=>null},{ctrlKey:true,shiftKey:true}).prevented,'Unknown card does not suppress native behavior');
const menu={},action={textContent:'Printings',getAttribute:()=>null,closest:()=>menu,dispatchEvent:()=>{}},menuItem={closest:selector=>selector.includes('[role="menuitem"]')?action:null};
fire('contextmenu',card('Counterspell'));assert(fire('click',menuItem).prevented);assert.equal(opened.at(-1).name,'Counterspell','Context action uses right-clicked card, not a stale preview');
const previous=opened.length;assert(!fire('click',menuItem).prevented);assert.equal(opened.length,previous,'Context consumed after selection');
for(const label of ['Switch printing','Switch Printing','Switching printing']){
 action.textContent=label;fire('contextmenu',sol);const before=opened.length;
 assert(fire('click',menuItem).prevented,label+' replaces the native picker');
 assert.equal(opened.length,before+1);assert.equal(opened.at(-1).name,'Sol Ring');
}
action.textContent='Printings';
fire('contextmenu',sol);fire('popstate');assert(!fire('click',menuItem).prevented,'Navigation clears context');
fire('contextmenu',sol);fire('click',card('Other card'));assert(!fire('click',menuItem).prevented,'Unrelated click clears context');
const owned={closest:selector=>selector.includes('[data-mrd-owned]')?{}:null};assert(!fire('click',owned,{ctrlKey:true,shiftKey:true}).prevented,'Extension controls are excluded');
location.pathname='/account';assert(!fire('click',sol,{ctrlKey:true,shiftKey:true}).prevented);
console.log('PASS: printing gesture capture, single open, native click preservation, context-menu card selection, context cleanup, and extension exclusion.');
})().catch(error=>{console.error(error);process.exitCode=1;});
