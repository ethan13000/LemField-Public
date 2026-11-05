const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let pdf,download,decoded=0,drawn=0,timedOut=false;
 const context2d={fillRect(){},scale(){},save(){},beginPath(){},roundRect(){},clip(){},drawImage(){drawn++;},restore(){},setLineDash(){},stroke(){}};
 const context={TextEncoder,Uint8Array,Blob,URL:{createObjectURL:blob=>(pdf=blob,'blob:test'),revokeObjectURL(){}},Image:class{set src(value){this.url=value;}decode(){decoded++;return timedOut?new Promise(()=>{}):Promise.resolve();}},document:{body:{append(){}},createElement:tag=>tag==='canvas'?{getContext:()=>context2d,toBlob:fn=>fn(new Blob([new Uint8Array([255,216,255,217])]))}:{click(){download=this.download;},remove(){}}},setTimeout:(fn,ms)=>{if(ms===20000&&timedOut)queueMicrotask(fn);else if(ms===0)queueMicrotask(fn);return 1;},clearTimeout(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../pdf-export.js'),'utf8'),context);
 const sheet={style:{width:'215.9mm',height:'279.4mm'},classList:{contains:()=>true},querySelectorAll:()=>[{src:'blob:art',style:{left:'10mm',top:'10mm'}}]};
 await context.LemFieldPDF.save([sheet],'Deck: test',()=>{});assert.equal(decoded,1);assert.equal(drawn,1);assert.equal(download,'Deck_ test.pdf');const text=Buffer.from(await pdf.arrayBuffer()).toString('latin1');assert(text.startsWith('%PDF-1.4'));const box=text.match(/\/MediaBox \[0 0 ([0-9.]+) ([0-9.]+)\]/);assert(box);assert(Math.abs(Number(box[1])-612)<.0001&&Math.abs(Number(box[2])-792)<.0001);
 const pointer=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(pointer,pointer+4),'xref');const rows=text.slice(pointer).split('\n'),count=Number(rows[1].split(' ')[1]);for(let i=1;i<count;i++){const offset=Number(rows[2+i].slice(0,10));assert(text.slice(offset).startsWith(i+' 0 obj'),'xref object '+i);}
 timedOut=true;await assert.rejects(context.LemFieldPDF.save([sheet],'Timeout',()=>{}),/timed out/);
 timedOut=false;context.Uint8Array=class{constructor(){this.length=128*1024*1024+1;}};await assert.rejects(context.LemFieldPDF.save([sheet],'Too large',()=>{}),/128 MB/);
 console.log('PASS: PDF physical dimensions, byte offsets, filename sanitation, image timeout and encoded-memory ceiling.');
})().catch(error=>{console.error(error);process.exitCode=1;});
