const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync(require.resolve('../edhrec.js'),'utf8'),context={};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function edhrecFilterScore('),source.indexOf('const edhrecBurst=')),context);
let time=100000,saved;const options={now:()=>time,save:value=>saved=structuredClone(value)},broad={fromEdhrec:true,filterScore:0,board:'mainboard'},card=name=>({name});
let monitor=context.createEdhrecBurstMonitor(options);for(let i=0;i<2;i++)monitor.record(card('Recommendation '+i),'deckA',broad);assert(!monitor.active());monitor.record(card('Recommendation 2'),'deckA',broad);assert(monitor.active(),'Three broad EDHREC additions show the reminder');
assert(context.createEdhrecBurstMonitor({...options,load:()=>saved}).active(),'Short burst survives the extension reloading the tab');monitor.dismiss();assert(!monitor.active());for(let i=0;i<6;i++)monitor.record(card('After dismiss '+i),'deckA',broad);assert(!monitor.active(),'Dismissal is respected');
monitor=context.createEdhrecBurstMonitor(options);for(const name of ['Sol Ring','Arcane Signet','Azorius Signet','Swords to Plowshares','Talisman of Curiosity','Forest']){assert(context.isEdhrecStaple(card(name)));monitor.record(card(name),'deckA',broad);}assert(!monitor.active(),'Staples do not count');
for(let i=0;i<6;i++){monitor.record(card('Scryfall '+i),'deckA',{...broad,fromEdhrec:false});monitor.record(card('Focused '+i),'deckA',{...broad,filterScore:2});monitor.record(card('Considering '+i),'deckA',{...broad,board:'maybeboard'});}assert(!monitor.active());
for(let i=0;i<2;i++)monitor.record(card('A '+i),'deckA',broad);for(let i=0;i<2;i++)monitor.record(card('B '+i),'deckB',broad);assert(!monitor.active(),'Deck bursts remain separate');time+=60001;monitor.record(card('After timeout'),'deckA',broad);assert(!monitor.active(),'Old additions expire');
monitor=context.createEdhrecBurstMonitor(options);for(let i=0;i<8;i++)monitor.record(card('Same card'),'deckA',broad);assert(!monitor.active(),'Multiple copies are not three different recommendations');
assert(context.edhrecFilterScore({role:'draw'})>=2);assert(context.edhrecFilterScore({query:'sacrifice'})>=2);assert(context.edhrecFilterScore({typeLine:'Elf'})>=2);assert(context.edhrecFilterScore({type:'Creature',maxMana:'3'})<2);
(async()=>{
 const calls=[];context.edhrecBurst={record:(...args)=>calls.push(args)};context.refreshEdhrecBanners=()=>{};context.cardForExplorerAdd=async(_view,card)=>({name:card.name});context.MoxDecks={add:async()=>({deck:{name:'Deck'}})};
 vm.runInContext(source.slice(source.indexOf('async function addExplorerCard('),source.indexOf('function edhrecFilterScore(')),context);
 const view={edhrecAddContext:{edhrecNames:new Set(['edhrec card','discovered card']),filterScore:0,searchMode:'text'}};
 await context.addExplorerCard(view,{name:'EDHREC card'},'deckA');assert(calls.at(-1)[2].fromEdhrec);
 await context.addExplorerCard(view,{name:'Discovered card',source:'scryfall'},'deckA');assert.equal(calls.at(-1)[2].fromEdhrec,false);
 const count=calls.length;context.MoxDecks.add=async()=>{throw Error('Add failed');};await assert.rejects(context.addExplorerCard(view,{name:'EDHREC card'},'deckA'));assert.equal(calls.length,count,'Failed writes never enter the burst');
 console.log('PASS: broad EDHREC-only successful additions, meaningful filter exemptions, staple exclusions, distinct per-deck bursts, expiry and dismissal.');
})().catch(error=>{console.error(error);process.exitCode=1;});
