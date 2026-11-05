const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../rules.js');const R=global.MoxRules;
assert.deepEqual(R.sidebarPosition(),{side:'right',top:92});
assert.deepEqual(R.sidebarPosition({side:'left',top:-200},800),{side:'left',top:8});
assert.deepEqual(R.sidebarPosition({side:'invalid',top:10000},800),{side:'right',top:736});
const source=fs.readFileSync(require.resolve('../content.js'),'utf8'),handlers={},windowHandlers={},properties={},saved=[];
const handle={setPointerCapture:()=>{}},context={R,innerHeight:800,innerWidth:1200,sidebarPosition:{side:'right',top:92},sidebarDrag:null,
 sideHost:{style:{setProperty:(name,value)=>properties[name]=value},dataset:{},classList:{add:()=>{},remove:()=>{}},getBoundingClientRect:()=>({top:92,left:924,width:268})},
 sideContent:{addEventListener:(name,callback)=>handlers[name]=callback},window:{addEventListener:(name,callback)=>windowHandlers[name]=callback},browser:{storage:{local:{set:async value=>saved.push(structuredClone(value))}}},queueRender:()=>{}};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function applySidebarPosition()'),source.indexOf('const make=')),context);
const event=(extra={})=>({pointerId:1,button:0,clientX:950,clientY:105,target:{closest:()=>handle},preventDefault:()=>{},...extra});
handlers.pointerdown(event());handlers.pointermove(event({clientX:100,clientY:300}));
assert.equal(context.sidebarPosition.side,'left');assert.equal(properties['--sidebar-top'],'287px');assert.equal(saved.length,0);
handlers.pointerup(event({type:'pointerup'}));assert.equal(saved.length,1);assert.equal(saved[0].mrd_sidebar_position.side,'left');
handlers.keydown(event({key:'ArrowRight'}));assert.equal(context.sidebarPosition.side,'right');
handlers.keydown(event({key:'ArrowUp',shiftKey:true}));assert.equal(context.sidebarPosition.top,247);
handlers.pointerdown(event());handlers.pointermove(event({clientX:50,clientY:-100}));assert.equal(context.sidebarPosition.top,8);
handlers.pointercancel(event({type:'pointercancel'}));assert.equal(context.sidebarPosition.top,247);assert.equal(context.sidebarPosition.side,'right');
context.innerHeight=200;windowHandlers.resize();assert.equal(properties['--sidebar-top'],'136px');
console.log('PASS: drag/snap, vertical bounds, save on release, keyboard movement, cancel restoration, and viewport resize.');
