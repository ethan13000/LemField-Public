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
location.pathname='/decks/test';
assert(!fire('click',sol,{ctrlKey:true,shiftKey:true,altKey:true}).prevented,'Alt bypasses native shortcut interception');
fire('contextmenu',sol);assert(!fire('click',menuItem,{altKey:true}).prevented,'Alt bypasses native menu interception');
const nativeCount=opened.length,elf=card('Elf Warrior');
for(const type of ['pointerdown','mousedown'])assert(fire(type,elf,{ctrlKey:true,shiftKey:true}).prevented,'Token gestures use the same picker interception as ordinary cards');
assert(fire('click',elf,{ctrlKey:true,shiftKey:true}).prevented);assert.equal(opened.length,nativeCount+1);assert.equal(opened.at(-1).name,'Elf Warrior');
fire('contextmenu',elf);assert(fire('click',menuItem).prevented);assert.equal(opened.length,nativeCount+2,'Token context action opens LemField instead of disappearing into native pass-through');
const tokenScope={dataset:{},getAttribute:()=>null,querySelector:()=>null};
const tokenImage={alt:'Elf Warrior',src:'https://assets.moxfield.net/cards/card-token-two-normal.jpg',dataset:{},matches:selector=>selector==='img'||selector==='img[alt]',closest:selector=>selector.includes('.deckview-image-wrapper')||selector.startsWith('[data-card-id]')?tokenScope:null};
const identified=context.MoxPrintingShortcuts.cardAt(tokenImage);assert.equal(identified.name,'Elf Warrior');assert.equal(identified.cardId,'token-two','Token image preserves exact native identity');
assert(fire('click',tokenImage,{ctrlKey:true,shiftKey:true}).prevented);assert.equal(opened.at(-1).cardId,'token-two','Duplicate-name token tile opens the exact token');
context.document={querySelectorAll:()=>[]};context.MouseEvent=class{constructor(type,values){this.type=type;Object.assign(this,values);}};
let closed=false;const replayed=[];sol.isConnected=true;sol.dispatchEvent=event=>{assert(closed,'Close extension dialog before native events');const result=fire(event.type,sol,event);replayed.push(result);};
const beforeNative=opened.length;await context.MoxPrintingShortcuts.openOriginal({name:'Sol Ring',nativeTarget:sol},()=>{closed=true;});
assert.equal(opened.length,beforeNative,'Native replay must not reopen LemField');assert.equal(replayed.length,3);assert(replayed.every(event=>!event.prevented));
let request;context.browser.runtime={sendMessage:async message=>(request=message,{ok:true})};closed=false;
await context.MoxPrintingShortcuts.openOriginal({name:'Absent card'},()=>{closed=true;});assert(closed);assert.equal(request.originalPrintings,true);assert.equal(request.name,'Absent card');
context.browser.runtime.sendMessage=async()=>({ok:false,error:'Lookup failed'});closed=false;
await assert.rejects(context.MoxPrintingShortcuts.openOriginal({name:'Missing'},()=>{closed=true;}),/Lookup failed/);assert(!closed,'Failed lookup retains extension dialog');
console.log('PASS: printing gesture capture, single open, native click preservation, context-menu card selection, context cleanup, and extension exclusion.');
})().catch(error=>{console.error(error);process.exitCode=1;});
