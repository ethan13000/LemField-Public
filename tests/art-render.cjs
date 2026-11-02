const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
require('../edhrec-data.js');
require('../rules.js');
class Node{
 constructor(tag,text='',cls=''){this.tag=tag;this.textContent=text;this.className=cls;this.children=[];}
 append(node){node.parent=this;this.children.push(node);}
 querySelector(selector){return this.children.find(node=>selector==='img'?node.tag==='img':node.className==='hint')||null;}
 remove(){this.parent.children=this.parent.children.filter(node=>node!==this);}
}
(async()=>{
 const calls=[],id='12345678-1234-1234-1234-123456789abc';
 const ctx={el:(...args)=>new Node(...args),E:global.MoxEDHREC,artObserver:null,requestCardDetails:async(name,printingId)=>{calls.push({name,printingId});return {ok:true,url:'https://cards.scryfall.io/normal/recovered.jpg'};}};
 const source=fs.readFileSync(require.resolve('../edhrec.js'),'utf8');vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function art(card,large=false){'),source.indexOf('\nlet hover=null')),ctx);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const deckCard=global.MoxRules.normalizeDeck({boards:{mainboard:{cards:[{quantity:1,card:{id:'moxfield-id',name:'Added card',set:'sld',cn:'123',scryfall_id:id,imageUrl:'https://cards.scryfall.io/normal/added.jpg'}}]}}})[0];
 assert.equal(deckCard.scryfallId,id);assert.equal(deckCard.collectorNumber,'123');assert.equal(ctx.art(deckCard).querySelector('img').src,'https://cards.scryfall.io/normal/added.jpg','Refreshed deck keeps its artwork');
 const recovered=ctx.art({name:'Example',id,set:'sld',collectorNumber:'1',detailsLoaded:true});await flush();assert(recovered.querySelector('img'),'Loaded metadata no longer blocks missing art recovery');assert.equal(calls[0].printingId,id);
 const fallback=ctx.art({name:'Example',image:'https://cards.scryfall.io/normal/broken.jpg',images:['https://cards.scryfall.io/large/good.jpg']});fallback.querySelector('img').onerror();assert.match(fallback.querySelector('img').src,/large\/good/,'Image errors try alternate sizes');
 fallback.querySelector('img').onerror();await flush();assert.match(fallback.querySelector('img').src,/recovered/);fallback.querySelector('img').onerror();await flush();assert.equal(fallback.querySelector('.hint').textContent,'Art unavailable','Recovery terminates without infinite requests');
 console.log('PASS: loaded-metadata art recovery, exact edition preservation, alternate image sizes and bounded failed-image fallback.');
})().catch(error=>{console.error(error);process.exitCode=1});
