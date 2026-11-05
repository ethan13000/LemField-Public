const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Node{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.dataset={};this.style={};this.children=[];this.className='native';this.colSpan=1;this.isConnected=true;}
 get cells(){return this.children;}
 get nextSibling(){const list=this.parent?.children||[];return list[list.indexOf(this)+1]||null;}
 hasAttribute(name){return name==='data-mrd-card-count'?'mrdCardCount' in this.dataset:name==='data-mrd-original-colspan'?'mrdOriginalColspan' in this.dataset:false;}
 insertBefore(node,before){node.parent=this;const at=this.children.indexOf(before);this.children.splice(at<0?this.children.length:at,0,node);}
 querySelector(selector){if(selector==='thead tr')return this.header;return this.children.find(node=>node.hasAttribute(selector.slice(1,-1)))||null;}
 querySelectorAll(selector){if(selector==='thead th')return this.header.cells;if(selector==='tbody tr')return this.rows;if(selector==='a[href]')return this.links||[];return [];}
 closest(){return this.table;}
 getBoundingClientRect(){return {top:this.offscreen?2000:50,bottom:this.offscreen?2050:100};}
}
(async()=>{
 const table=new Node('table');table.header=new Node('tr');for(const label of ['Name','Colors','Format','Updated',''])table.header.insertBefore(new Node('th',label),null);
 const row=(id,offscreen=false)=>{const result=new Node('tr');result.table=table;result.offscreen=offscreen;result.links=id?[{href:'https://moxfield.com/decks/'+id}]:[{href:'https://moxfield.com/folders/folder'}];for(let i=0;i<5;i++)result.insertBefore(new Node('td'),null);return result;};
 const first=row('one'),second=row('two'),third=row('three'),folder=row(null),later=row('later',true);table.rows=[first,second,third,folder,later];
 const events={},requests=[];let scheduled;
 const window={innerHeight:800,addEventListener:(name,fn)=>events[name]=fn};
 const context={window,location:{href:'https://moxfield.com/decks',origin:'https://moxfield.com'},URL,document:{documentElement:{},querySelectorAll:selector=>selector==='h1,h2'?[new Node('h1','Your Decks')]:[table],createElement:tag=>new Node(tag)},MutationObserver:class{observe(){}},setTimeout:fn=>(scheduled=fn,1),clearTimeout(){},MoxDecks:{cardCount:id=>new Promise((resolve,reject)=>requests.push({id,resolve,reject}))}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../deck-list-counts.js'),'utf8'),context);await tick();
 const countCell=node=>node.querySelector('[data-mrd-card-count]');
 assert.equal(table.header.cells[1].textContent,'Cards');assert.equal(table.header.cells.length,6);assert.equal(folder.cells.length,6);assert.equal(countCell(folder).textContent,'');
 assert.equal(requests.length,2,'At most two simultaneous reads');assert.equal(countCell(first).textContent,'�');
 requests[0].resolve(100);await tick();assert.equal(requests.length,3,'Next row starts as a slot opens');requests[1].reject(Error('Not accessible'));requests[2].resolve(0);await tick();scheduled();await tick();
 assert.equal(countCell(first).textContent,'100');assert.equal(countCell(second).textContent,'�');assert.match(countCell(second).title,/Not accessible/);assert.equal(countCell(third).textContent,'0','An empty deck is a valid zero');assert.match(countCell(first).title,/Main deck \+ commanders/);
 assert(!requests.some(request=>request.id==='later'),'Offscreen rows wait until visible');scheduled();await tick();assert.equal(requests.length,3,'Cached rows and failures do not repeatedly fetch');assert.equal(table.header.cells.length,6);assert.equal(first.cells.length,6,'Repeated rendering never duplicates cells');
 later.offscreen=false;events.scroll();scheduled();await tick();assert.equal(requests.at(-1).id,'later');requests.at(-1).resolve(60);await tick();scheduled();assert.equal(countCell(later).textContent,'60');
 const spanning=row(null);spanning.children=[new Node('td')];spanning.children[0].colSpan=5;table.rows.push(spanning);scheduled();assert.equal(spanning.cells[0].colSpan,6);scheduled();assert.equal(spanning.cells[0].colSpan,6,'Folder spans are adjusted once');
 first.links=[];scheduled();assert.equal(countCell(first).textContent,'','Reused folder rows lose stale totals');
 console.log('PASS: deck-list column placement, folders, quantities/zero display, lazy bounded reads, failure states, cache and redraw idempotence.');
})().catch(error=>{console.error(error);process.exitCode=1;});
