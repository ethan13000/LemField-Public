const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const source=fs.readFileSync(require.resolve('../art-background.js'),'utf8'),timers=[],order=[],context={setTimeout:fn=>{timers.push(fn);return 1;}};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('const cache='),source.indexOf('function cardResult(')),context);
 let release;const first=context.enqueue(async()=>{order.push('active');await new Promise(resolve=>release=resolve);});const normal=context.enqueue(async()=>order.push('background'),false,'normal'),promoted=context.enqueue(async()=>order.push('promoted'),false,'promoted'),hover=context.enqueue(async()=>order.push('hover'),2,'hover');context.promote('promoted');release();
 for(let i=0;i<5;i++){await new Promise(resolve=>setImmediate(resolve));if(timers.length)timers.shift()();}await Promise.all([first,normal,promoted,hover]);assert.deepEqual(order,['active','promoted','hover','background']);
 console.log('PASS: hovered metadata and promoted cached requests precede background jobs while preserving in-flight work.');
})().catch(error=>{console.error(error);process.exitCode=1;});
