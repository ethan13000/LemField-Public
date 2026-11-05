const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../edhrec.js'),'utf8'),context={};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function legacyPrintingScope('),source.indexOf('function target(')),context);
function modal(title,attrs={},alts=[]){const scope={className:attrs.className||'modal-content',parentElement:null,closest:selector=>selector.startsWith('[role="dialog"]')?scope:null,getAttribute:name=>attrs[name]||null,querySelectorAll:selector=>selector==='img[alt]'?alts.map(alt=>({alt,closest:()=>null})):[{textContent:title,closest:()=>null}]};return scope;}
for(const scope of [modal('Switch Printing'),modal('Choose an edition'),modal('Elf Warrior',{'aria-label':'Printing selector'}),modal('Elf Warrior',{},['Elf Warrior','Elf Warrior','Elf Warrior'])])assert.equal(context.legacyPrintingScope(scope),scope);
const ordinary=modal('Elf Warrior',{},['Elf Warrior']);assert.equal(context.legacyPrintingScope(ordinary),null,'Ordinary card preview keeps EDHREC');
assert.equal(context.legacyPrintingScope({closest:()=>null}),null,'Normal page controls are unaffected');
console.log('PASS: legacy printing dialogs excluded; ordinary card previews and page controls preserved.');
