const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
const css=fs.readFileSync(require.resolve('../dashboard.css'),'utf8');
const routeHelpers=source.slice(source.indexOf('const deckId='),source.indexOf('const initial='));
const routeHandler=source.slice(source.indexOf('function routeChanged(){'),source.indexOf("window.addEventListener('message'"));
const calls=[];
const context={
 location:{pathname:'/decks/abc123'},
 activePageId:'abc123',activeOverview:true,routeGeneration:0,cards:[{name:'Sol Ring'}],capturedDeck:{},fingerprint:'saved',source:'page',status:'ready',readAttempted:true,fetching:false,expandedRule:null,placeAnchor:null,
 host:{hidden:false},sideHost:{hidden:false},
 queueRender:()=>calls.push('render'),schedulePlacement:()=>calls.push('place'),refresh:()=>calls.push('refresh'),setTimeout:fn=>fn()
};
vm.createContext(context);
vm.runInContext(routeHelpers+routeHandler,context);
for(const path of ['/decks/abc123/','/decks/abc123/goldfish','/decks/abc123/playtest','/decks/abc123/primer','/decks/abc123/printings','/decks/abc123/edit','/cards/abc123']){
 context.location.pathname=path;
 assert.equal(vm.runInContext('onDeckOverview()',context),path==='/decks/abc123/');
}
context.location.pathname='/decks/abc123/goldfish';context.routeChanged();
assert.equal(context.host.hidden,true);assert.equal(context.sideHost.hidden,true);
assert.equal(context.routeGeneration,0);assert.equal(context.cards.length,1);
context.location.pathname='/decks/abc123';context.routeChanged();
assert.equal(context.host.hidden,false);assert.equal(context.sideHost.hidden,false);
assert(calls.includes('place'));
assert.match(css,/:host\(\[hidden\]\)\s*\{display:none!important\}/);
console.log('PASS: requirements hide on deck subroutes and return on the overview.');
