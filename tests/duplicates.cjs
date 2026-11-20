const assert=require('node:assert/strict');require('../duplicates.js');const D=globalThis.MoxfieldPlusDuplicates;
const card=(name,id,qty,type='Creature',oracle='')=>({name,id,qty,type,oracle,section:'mainboard'});
assert.deepEqual(D.plan([card('Elf','a',3)]),[{name:'Elf',id:'a',from:3,to:1}]);
assert.equal(D.plan([card('Elf','a',1),card('Elf','b',1)])[0].to,0);
assert.equal(D.plan([card('Forest','f',30,'Basic Land — Forest'),card('Rats','r',20,'Creature','A deck can have any number of cards named Rats.')]).length,0);
assert.equal(D.plan([card('Elf','a',2),{...card('Other','o',2),section:'sideboard'}]).length,1);
assert.equal(D.plan([card('Elf','a',1),card('Elf','a',2)]).length,0);
const raw={boards:{mainboard:{cards:[{quantity:3,card:{id:'a',name:'Elf',type_line:'Creature'}}]}}};assert.deepEqual(D.rawPlan(raw),D.plan([card('Elf','a',3)]));
console.log('PASS: singleton quantities, cross-printing copies, basic/exception preservation, board scope and ambiguous-ID rejection.');
