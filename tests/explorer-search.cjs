const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../edhrec.js'),'utf8');
function node(tag,text=''){
 return {tag,textContent:text,value:'',hidden:false,disabled:false,options:[],children:[],events:{},setAttribute(name,value){this[name]=value;},append(...nodes){this.children.push(...nodes);if(this.tag==='select')this.options.push(...nodes);},replaceChildren(){this.children=[];this.options=[];},addEventListener(name,fn){this.events[name]=fn;},focus(){this.focused=true;},get selectedOptions(){return this.options.filter(row=>row.value===this.value);}};
}
const options=(select,rows)=>{for(const [value,label] of rows){const option=node('option',label);option.value=value;select.append(option);}};
const context={el:node,options,role:node('select'),roleSearch:node('input'),tag:node('select'),tagSearch:node('input'),deckRequirementRules:new Map(),roleChoices:[['','Card role'],['draw','Card draw'],['token-makers','Token generation'],['treasure','Treasure generation']],availableTags:['Flying','Secret Lair','Treasure'],tokenKind:node('input')};
vm.createContext(context);
const start=source.indexOf(' const selectMenu='),end=source.indexOf(' const tokenKinds=',start);
vm.runInContext(source.slice(start,end)+';globalThis.rolePicker=rolePicker;globalThis.tagPicker=tagPicker;',context);
const roleStart=source.indexOf(' const updateRoleOptions='),roleEnd=source.indexOf(' const selectMenu=',roleStart);
vm.runInContext(source.slice(roleStart,roleEnd)+';globalThis.updateRoles=updateRoleOptions;',context);
const tagStart=source.indexOf(' const updateTagOptions='),tagEnd=source.indexOf(' const render=',tagStart);
vm.runInContext(source.slice(tagStart,tagEnd)+';globalThis.updateTags=updateTagOptions;',context);
context.roleSearch.value='token';context.updateRoles();assert.deepEqual(context.role.options.map(row=>row.value),['','token-makers']);
context.role.value='token-makers';context.roleSearch.value='draw';context.updateRoles();assert(context.role.options.some(row=>row.value==='token-makers'),'Searching does not silently clear selected role');
context.deckRequirementRules.set('deck:custom',{name:'Custom role',presetId:'token-makers'});context.roleSearch.value='custom';context.updateRoles();assert(context.role.options.some(row=>row.value==='deck:custom'));
context.roleSearch.value='';context.updateRoles();assert.equal(context.role.options.length,5);
context.tagSearch.value='secret';context.updateTags();assert.deepEqual(context.tag.options.map(row=>row.value),['','Secret Lair']);
context.tag.value='Secret Lair';context.tagSearch.value='flying';context.updateTags();assert.equal(context.tag.value,'Secret Lair');assert(context.tag.options.some(row=>row.value==='Flying'));
context.tagSearch.value='';context.updateTags();assert.equal(context.tag.options.length,4);
for(const [picker,search,select] of [[context.rolePicker,context.roleSearch,context.role],[context.tagPicker,context.tagSearch,context.tag]]){
 assert(picker.menu.children[1].children.includes(search),'Search is inside its own menu');
 picker.menu.open=true;picker.menu.events.toggle();assert(search.focused);
 select.events.change();assert.equal(picker.menu.open,false);assert(picker.menu.children[0].focused);
 picker.menu.open=true;let stopped=false;picker.menu.events.keydown({key:'Escape',preventDefault(){},stopPropagation(){stopped=true;}});assert(!picker.menu.open&&stopped);
}
const tokenStart=source.indexOf(' const tokenRoleSelected='),tokenEnd=source.indexOf(' const triggerMenu=',tokenStart);
vm.runInContext(source.slice(tokenStart,tokenEnd)+';globalThis.syncToken=syncTokenKind;globalThis.tokenValue=selectedTokenKind;',context);
for(const role of ['', 'draw', 'deck:missing']){context.role.value=role;context.tokenKind.value='Treasure';context.syncToken();assert(context.tokenKind.hidden&&context.tokenKind.disabled);assert.equal(context.tokenKind.value,'');assert.equal(context.tokenValue(),'');}
for(const role of ['token-makers','deck:custom']){context.role.value=role;context.syncToken();assert(!context.tokenKind.hidden&&!context.tokenKind.disabled);assert.equal(context.tokenKind.value,'');context.tokenKind.value='Treasure';assert.equal(context.tokenValue(),'Treasure');context.role.value='draw';context.syncToken();context.role.value=role;context.syncToken();assert.equal(context.tokenKind.value,'','Re-selecting Token generation starts empty');}
console.log('PASS: searchable role/tag menus, preserved selections, deck roles, clearable token state, menu focus and Escape behavior.');

const menuA={open:true,setAttribute(name,value){this[name]=value;}},menuB={open:false,setAttribute(name,value){this[name]=value;}},events={};
const exclusive={crypto:{randomUUID:()=> 'test'},controls:{querySelectorAll:()=>[menuA,menuB],addEventListener:(name,fn)=>events[name]=fn}};vm.createContext(exclusive);
vm.runInContext(source.slice(source.indexOf('function exclusiveExplorerMenus('),source.indexOf('function advanced('))+'exclusiveExplorerMenus(controls);',exclusive);
assert.equal(menuA.name,menuB.name,'Native details accordion shares a unique group');
events.pointerdown({target:{closest:()=>menuB}});assert.equal(menuA.open,false,'Opening a different menu closes the old one');
menuB.open=true;events.focusin({target:{closest:()=>menuB}});assert(menuB.open,'Searching or selecting inside a menu keeps it open');
events.pointerdown({target:{closest:()=>null}});assert.equal(menuB.open,false,'Opening a native select closes the custom menu');
menuA.open=true;events.click({target:{closest:()=>menuB}});assert.equal(menuA.open,false,'Keyboard activation closes the previous menu too');
