'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../deck-duplicates.js'),'utf8');
(async()=>{
 let resolvePreview,confirms=0,submitted=[],alerts=[];
 const context={working:false,location:{pathname:'/decks/deckA'},MoxDecks:{preview:()=>new Promise(resolve=>resolvePreview=resolve),removeDuplicates:async(plan,id)=>{submitted.push({plan,id});return {removed:1};}},MoxfieldPlusDuplicates:{plan:()=>[{id:'a',name:'Card',from:2,to:1}]},alert:value=>alerts.push(value),confirm:()=>{confirms++;return true;}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('const currentDeckID='),source.indexOf('function scan(){')),context);
 const button={disabled:false};let action=context.cleanup(button);context.location.pathname='/decks/deckB';resolvePreview({id:'deckA',cards:[]});await action;assert.equal(confirms,0,'Navigation while preview is pending must not open a review for the wrong deck');assert.equal(submitted.length,0);assert.match(alerts.at(-1),/deck changed/);assert.equal(button.disabled,false);
 context.location.pathname='/decks/deckA';action=context.cleanup(button);resolvePreview({id:'deckB',cards:[]});await action;assert.equal(submitted.length,0,'Mismatched preview identity is rejected');
 context.confirm=()=>{confirms++;context.location.pathname='/decks/deckB';return true;};action=context.cleanup(button);resolvePreview({id:'deckA',cards:[]});await action;assert.equal(submitted.length,0,'The route is checked again after confirmation');
 context.location.pathname='/decks/deckA';context.confirm=()=>true;action=context.cleanup(button);resolvePreview({id:'deckA',cards:[]});await action;assert.equal(submitted.length,1);assert.equal(submitted[0].id,'deckA','Write remains pinned to the reviewed deck');assert.equal(button.disabled,false);
 context.location.pathname='/cards/card';await context.cleanup(button);assert.equal(submitted.length,1,'Cleanup cannot start outside a deck');
 console.log('PASS: duplicate cleanup pins the reviewed deck and rejects navigation, mismatched previews and off-deck invocation before writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
