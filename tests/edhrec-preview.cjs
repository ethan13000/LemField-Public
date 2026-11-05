const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Node{
 constructor(tag,text='',cls=''){this.tag=tag;this.textContent=text;this.className=cls;this.children=[];this.isConnected=true;this.hidden=false;}
 append(...children){this.children.push(...children);}setAttribute(){}
 replaceChildren(...children){this.children=children;}
 querySelector(selector){return selector==='.edh-card-details'?new Node('div'):null;}
}
(async()=>{
 const requests=[];let fail=true;const body=new Node('div');
 const context={el:(...args)=>new Node(...args),link:(text,url)=>Object.assign(new Node('a',text),{href:url}),button:(text,onclick)=>Object.assign(new Node('button',text),{onclick}),tile:(_view,card)=>new Node('li',card.name),hideHover:()=>{},cleanArt:()=>{},E:{slug:name=>name.toLowerCase()},browser:{runtime:{sendMessage:async message=>{requests.push(message);if(fail)throw Error('blocked');return {ok:true,cards:[{name:'Similar Card'}]};}}}};
 const source=fs.readFileSync(require.resolve('../edhrec.js'),'utf8');vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function similarSection(view){'),source.indexOf('\nfunction identify(scope,isPage){')),context);
 context.similarSection({name:'Example',body});await new Promise(resolve=>setImmediate(resolve));
 const section=body.children[0],direct=section.children.find(node=>node.tag==='a'),retry=section.children.find(node=>node.textContent==='Retry similar cards');
 assert.equal(direct.href,'https://edhrec.com/cards/example/similar-cards');assert.equal(retry.hidden,false);assert.equal(requests[0].retry,false);
 fail=false;retry.onclick();await new Promise(resolve=>setImmediate(resolve));assert.equal(requests[1].retry,true);assert.equal(retry.hidden,true);assert.equal(section.children.find(node=>node.tag==='ul').children[0].textContent,'Similar Card');
 console.log('PASS: similar-card failure keeps a direct link and retry; retry requests fresh data and replaces the error with cards.');
})().catch(error=>{console.error(error);process.exitCode=1});
