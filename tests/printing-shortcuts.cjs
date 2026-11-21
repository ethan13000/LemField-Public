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
fire('contextmenu',elf);assert(fire('click',menuItem).prevented);assert.equal(opened.length,nativeCount+2,'Token context action opens Moxfield Plus instead of disappearing into native pass-through');
const tokenScope={dataset:{},getAttribute:()=>null,querySelector:()=>null};
const tokenImage={alt:'Elf Warrior',src:'https://assets.moxfield.net/cards/card-token-two-normal.jpg',dataset:{},matches:selector=>selector==='img'||selector==='img[alt]',closest:selector=>selector.includes('.deckview-image-wrapper')||selector.startsWith('[data-card-id]')?tokenScope:null};
const identified=context.MoxPrintingShortcuts.cardAt(tokenImage);assert.equal(identified.name,'Elf Warrior');assert.equal(identified.cardId,'token-two','Token image preserves exact native identity');
assert(fire('click',tokenImage,{ctrlKey:true,shiftKey:true}).prevented);assert.equal(opened.at(-1).cardId,'token-two','Duplicate-name token tile opens the exact token');
context.document={body:{},querySelectorAll:()=>[]};
// Minimal markup fixtures distilled from the current editor's stable attributes.
function element(tag,attributes={},textContent=''){
 const node={tagName:tag.toUpperCase(),attributes,textContent,dataset:{},children:[],isConnected:true,getAttribute:name=>attributes[name]??null,dispatchEvent(){},append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}};
 node.matches=selector=>selector.split(',').some(part=>{
  part=part.trim();const match=part.match(/^([a-z]+)?(?:\[([a-z-]+)(?:(\*?=)"([^"]*)")?\])?$/i);if(!match)return false;
  if(match[1]&&match[1].toUpperCase()!==node.tagName)return false;if(!match[2])return !!match[1];
  const actual=node.getAttribute(match[2]);return match[3]==='*='?actual?.includes(match[4]):match[3]==='='?actual===match[4]:actual!==null;
 });
 node.closest=selector=>{for(let target=node;target;target=target.parentElement)if(target.matches(selector))return target;return null;};
 node.querySelectorAll=selector=>node.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);
 node.querySelector=selector=>node.querySelectorAll(selector)[0]||null;return node;
}
function editorRow(name,id,rowKey){
 const row=element('li',{'data-testid':'deck-view-table-row','data-hash':id,'data-row-key':rowKey});
 const nameLink=element('a',{'data-testid':'deck-view-table-row-name',href:'https://moxfield.com/cards/'+id+'-name'},name);
 const trigger=element('a',{'data-testid':'deck-view-table-row-options-trigger','aria-label':'Options for '+name,role:'button','aria-expanded':'false'}),icon=element('span',{'aria-hidden':'true'});trigger.append(icon);row.append(nameLink,trigger);return {row,nameLink,trigger,icon};
}
const modern=editorRow('Archfiend of Despair','K55bP','mainboard-main-3|K55bP');
assert.equal(context.MoxPrintingShortcuts.cardAt(modern.icon).cardId,'K55bP','Options icon resolves the exact printing from its nearest row');
assert.equal(context.MoxPrintingShortcuts.cardAt(modern.nameLink).section,'mainboard');
assert(fire('click',modern.nameLink,{ctrlKey:true,shiftKey:true}).prevented);assert.equal(opened.at(-1).cardId,'K55bP');assert.equal(opened.at(-1).section,'mainboard');
const editMenu=element('div',{role:'menu'}),editItem=element('button',{role:'menuitem'},'Edit'),printingItem=element('button',{role:'menuitem','data-tooltip':'Switch printing'},' ');editMenu.append(editItem,printingItem);
assert(!fire('click',modern.icon).prevented,'Opening native options retains its native action');assert(!fire('click',editItem).prevented,'Edit submenu retains its native action');assert(fire('click',printingItem).prevented,'Nested Edit to Switch printing preserves row context');assert.equal(opened.at(-1).cardId,'K55bP');assert.equal(opened.at(-1).nativeTarget,modern.nameLink,'Original selector replay targets the card link, not its options button');
const duplicate=editorRow('Archfiend of Despair','otherPrinting','maybeboard-main-3|otherPrinting');fire('click',duplicate.trigger);fire('click',editItem);assert(fire('click',printingItem).prevented);assert.equal(opened.at(-1).cardId,'otherPrinting');assert.equal(opened.at(-1).section,'maybeboard','Same-name rows retain exact printing and observed board');
for(const [key,section] of [['mainboard-commander-0','commanders'],['tokens','tokens'],['curve-3',undefined]]){const row=editorRow('Variant','variant',key+'|variant');assert.equal(context.MoxPrintingShortcuts.cardAt(row.row).section,section,'Only observed board markers are interpreted: '+key);}
const inconsistent=editorRow('Variant','wrong','mainboard-main-3|different');assert.equal(context.MoxPrintingShortcuts.cardAt(inconsistent.nameLink),null,'Conflicting row identity fails safely');assert(!fire('click',inconsistent.nameLink,{ctrlKey:true,shiftKey:true}).prevented);
fire('click',modern.trigger);fire('click',element('button',{},'Edit'));assert(!fire('click',printingItem).prevented,'An Edit action outside a native menu clears context');
const unrelatedMenuAction=element('button',{role:'menuitem'},'Remove');editMenu.append(unrelatedMenuAction);fire('click',modern.trigger);fire('click',unrelatedMenuAction);assert(!fire('click',printingItem).prevented,'Other native actions consume the pending printing context');
fire('click',modern.trigger);fire('keydown',modern.trigger,{key:'Escape'});assert(!fire('click',printingItem).prevented,'Escape clears options context');
fire('click',modern.trigger);fire('message',null,{source:window,origin:location.origin,data:{source:'mrd-route-v3'}});assert(!fire('click',printingItem).prevented,'Route events clear options context');
const iconAction=element('button',{role:'menuitem'},' '),accessibleIcon=element('span',{'aria-label':'Switch printing'});iconAction.append(accessibleIcon);editMenu.append(iconAction);fire('click',modern.trigger);assert(fire('click',accessibleIcon).prevented,'Icon-only printing actions use their accessible label');assert.equal(opened.at(-1).cardId,'K55bP');
fire('click',modern.trigger);assert(!fire('click',printingItem,{altKey:true}).prevented,'Alt bypasses nested native printing action');fire('click',element('button',{},'Outside'));
context.document={querySelectorAll:()=>[]};context.MouseEvent=class{constructor(type,values){this.type=type;Object.assign(this,values);}};
let closed=false;const replayed=[];sol.isConnected=true;sol.dispatchEvent=event=>{assert(closed,'Close extension dialog before native events');const result=fire(event.type,sol,event);replayed.push(result);};
const beforeNative=opened.length;await context.MoxPrintingShortcuts.openOriginal({name:'Sol Ring',nativeTarget:sol},()=>{closed=true;});
assert.equal(opened.length,beforeNative,'Native replay must not reopen Moxfield Plus');assert.equal(replayed.length,3);assert(replayed.every(event=>!event.prevented));
const exactReplays=[];context.document.querySelectorAll=()=>[modern.nameLink,duplicate.nameLink];duplicate.nameLink.dispatchEvent=event=>{exactReplays.push(event);assert(!fire(event.type,duplicate.nameLink,event).prevented);};const beforeExact=opened.length;await context.MoxPrintingShortcuts.openOriginal({name:'Archfiend of Despair',cardId:'otherPrinting',section:'maybeboard'});assert.equal(exactReplays.length,3,'Original replay resolves the exact same-name row and board');assert.equal(opened.length,beforeExact,'Modern native replay does not reenter LemField');
let request;context.browser.runtime={sendMessage:async message=>(request=message,{ok:true})};closed=false;
await context.MoxPrintingShortcuts.openOriginal({name:'Absent card'},()=>{closed=true;});assert(closed);assert.equal(request.originalPrintings,true);assert.equal(request.name,'Absent card');
context.browser.runtime.sendMessage=async()=>({ok:false,error:'Lookup failed'});closed=false;
await assert.rejects(context.MoxPrintingShortcuts.openOriginal({name:'Missing'},()=>{closed=true;}),/Lookup failed/);assert(!closed,'Failed lookup retains extension dialog');
console.log('PASS: printing gesture capture, single open, native click preservation, context-menu card selection, modern row identity/boards, nested Edit menus, icon actions, context cleanup, and extension exclusion.');
})().catch(error=>{console.error(error);process.exitCode=1;});
