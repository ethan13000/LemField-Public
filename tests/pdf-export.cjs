const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let pdf,download,decoded=0,drawn=0,timedOut=false;const marginLines=[];let start;
 const context2d={fillRect(){},scale(){},save(){},beginPath(){},roundRect(){},clip(){},drawImage(){drawn++;},restore(){},setLineDash(){},moveTo(x,y){start=[x,y];},lineTo(x,y){marginLines.push([...start,x,y]);},stroke(){}};
 const context={TextEncoder,Uint8Array,Blob,URL:{createObjectURL:blob=>(pdf=blob,'blob:test'),revokeObjectURL(){}},Image:class{set src(value){this.url=value;}decode(){decoded++;return timedOut?new Promise(()=>{}):Promise.resolve();}},document:{body:{append(){}},createElement:tag=>tag==='canvas'?{getContext:()=>context2d,toBlob:fn=>fn(new Blob([new Uint8Array([255,216,255,217])]))}:{click(){download=this.download;},remove(){}}},setTimeout:(fn,ms)=>{if(ms===20000&&timedOut)queueMicrotask(fn);else if(ms===0)queueMicrotask(fn);return 1;},clearTimeout(){}};
 vm.createContext(context);for(const file of ['cut-guides.js','pdf-export.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),context);
 const sheet={style:{width:'215.9mm',height:'279.4mm'},classList:{contains:()=>true},querySelectorAll:()=>[{src:'blob:art',style:{left:'10mm',top:'10mm'}}]};
 await context.MoxfieldPlusPDF.save([sheet],'Deck: test',()=>{});assert.equal(decoded,1);assert.equal(drawn,1);assert.equal(download,'Deck_ test.pdf');const text=Buffer.from(await pdf.arrayBuffer()).toString('latin1');assert(text.startsWith('%PDF-1.4'));const box=text.match(/\/MediaBox \[0 0 ([0-9.]+) ([0-9.]+)\]/);assert(box);assert(Math.abs(Number(box[1])-612)<.0001&&Math.abs(Number(box[2])-792)<.0001);
 const pointer=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(pointer,pointer+4),'xref');const rows=text.slice(pointer).split('\n'),count=Number(rows[1].split(' ')[1]);for(let i=1;i<count;i++){const offset=Number(rows[2+i].slice(0,10));assert(text.slice(offset).startsWith(i+' 0 obj'),'xref object '+i);}
 assert.equal(marginLines.length,8,'PDF extends both card edges into all four margins');assert.deepEqual(marginLines[0],[10,0,10,9.5]);assert(marginLines.some(line=>line[1]===98.5&&line[3]===279.4));
 const G=context.MoxfieldPlusCutGuides;
 for(const [width,height] of [[210,297],[215.9,279.4]]){
  const cards=[{x:7,y:5},{x:72,y:5},{x:7,y:95}],lines=G.segments(width,height,cards);
  for(const [x1,y1,x2,y2] of lines){assert(x1>=0&&x2<=width&&y1>=0&&y2<=height,'Guides remain on the paper');for(const c of cards)assert(!(x1===x2&&x1>c.x&&x1<c.x+63&&y2>c.y&&y1<c.y+88)&&!(y1===y2&&y1>c.y&&y1<c.y+88&&x2>c.x&&x1<c.x+63),'Margin guides never cross artwork');}
 }
 assert.equal(G.segments(63,88,[{x:0,y:0}]).length,0,'No guide is drawn beyond a flush paper edge');assert.equal(G.segments(210,297,[]).length,0);
 const svgNode=tag=>({tag,attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v;},append(n){this.children.push(n);}});context.document.createElementNS=(_ns,tag)=>svgNode(tag);sheet.append=node=>{sheet.overlay=node;};G.append(sheet);assert.equal(sheet.overlay.attrs.viewBox,'0 0 215.9 279.4');assert(sheet.overlay.children[0].attrs.d.includes('M10 0L10 9.5'),'Preview uses the same margin geometry');
 marginLines.length=0;const noGuides={...sheet,classList:{contains:()=>false},append(){throw Error('Disabled guides must not add an overlay');}};G.append(noGuides);await context.MoxfieldPlusPDF.save([noGuides],'No guides',()=>{});assert.equal(marginLines.length,0,'Guide toggle also disables PDF margin lines');
 timedOut=true;await assert.rejects(context.MoxfieldPlusPDF.save([sheet],'Timeout',()=>{}),/timed out/);
 timedOut=false;context.Uint8Array=class{constructor(){this.length=128*1024*1024+1;}};await assert.rejects(context.MoxfieldPlusPDF.save([sheet],'Too large',()=>{}),/128 MB/);
 console.log('PASS: PDF dimensions/xref, preview/PDF margin guides on Letter/A4, artwork clearance, guide toggle, image timeout and memory ceiling.');
})().catch(error=>{console.error(error);process.exitCode=1;});
