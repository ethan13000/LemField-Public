const assert=require('node:assert/strict');require('../edhrec-data.js');require('../print-faces.js');const F=globalThis.MoxfieldPlusPrintFaces;
const front='https://cards.scryfall.io/normal/front/a.jpg',back='https://cards.scryfall.io/normal/back/a.jpg';
assert.deepEqual(F.faces({image_uris:{normal:front},card_faces:[{name:'Adventure'},{name:'Creature'}]}),[front],'Single printed surfaces stay single');
assert.deepEqual(F.faces({card_faces:[{image_uris:{normal:front}},{image_uris:{normal:back}}]}),[front,back]);
assert.deepEqual(F.faces({card_faces:[{image_uris:{normal:front}},{}]}),[front,null],'Missing backs stay explicit, never silently reuse the front');
for(const [w,h] of [[215.9,279.4],[210,297]])for(const short of [false,true])for(const [x,y] of [[5,5],[70,95],[135,185]]){const p=F.backPosition(x,y,w,h,short),q=F.backPosition(p.x,p.y,w,h,short);assert(Math.abs(q.x-x)<1e-9&&Math.abs(q.y-y)<1e-9);if(short){assert.equal(p.x,x);assert(Math.abs(y+p.y+88-h)<1e-9);}else{assert.equal(p.y,y);assert(Math.abs(x+p.x+63-w)<1e-9);}}
console.log('PASS: physical versus shared faces, explicit missing backs, Letter/A4 long/short-edge duplex coordinates.');
