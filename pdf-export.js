/* Local PDF download: one bounded 300 DPI raster per physical sheet. */
(()=>{'use strict';
const enc=new TextEncoder(),bytes=text=>enc.encode(text);
globalThis.LemFieldPDF={async save(sheets,name,progress){
 if(!sheets.length)throw Error('Prepare sheets first.');
 let jpegBytes=0;const maxJPEGBytes=128*1024*1024;
 const objects=[],add=data=>(objects.push(data),objects.length),pages=[];
 const catalog=add(null),root=add(null);
 for(let index=0;index<sheets.length;index++){
  const sheet=sheets[index],w=parseFloat(sheet.style.width),h=parseFloat(sheet.style.height),scale=300/25.4;
  if(!(w>0&&w<=300&&h>0&&h<=420))throw Error('Invalid sheet dimensions.');
  const canvas=document.createElement('canvas');canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
  try{
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(scale,scale);
  for(const original of sheet.querySelectorAll('img')){
   const image=new Image();image.crossOrigin='anonymous';image.src=original.src;let timer;try{await Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>{image.src='';reject(Error('A PDF image timed out. Retry or reduce the export size.'));},20000);})]);}finally{clearTimeout(timer);}
   const x=parseFloat(original.style.left),y=parseFloat(original.style.top),rounded=sheet.classList.contains('rounded-cards');
   ctx.save();ctx.beginPath();ctx.roundRect(x,y,63,88,rounded?3:0);ctx.clip();ctx.drawImage(image,x,y,63,88);ctx.restore();
   if(sheet.classList.contains('guides')){ctx.strokeStyle='#888';ctx.lineWidth=.15;ctx.setLineDash([1,1]);ctx.beginPath();ctx.roundRect(x,y,63,88,rounded?3:0);ctx.stroke();}
  }
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));if(!blob)throw Error('Could not encode sheet.');
  const jpeg=new Uint8Array(await blob.arrayBuffer());jpegBytes+=jpeg.length;if(jpegBytes>maxJPEGBytes){canvas.width=canvas.height=0;throw Error('PDF exceeds the 128 MB image limit. Export fewer cards or copies.');}const imageId=add([bytes(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,bytes('\nendstream')]);
  canvas.width=canvas.height=0;
  const pw=w*72/25.4,ph=h*72/25.4,commands=bytes(`q ${pw} 0 0 ${ph} 0 0 cm /Im Do Q`),content=add([bytes(`<< /Length ${commands.length} >>\nstream\n`),commands,bytes('\nendstream')]);
  pages.push(add(bytes(`<< /Type /Page /Parent ${root} 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im ${imageId} 0 R >> >> /Contents ${content} 0 R >>`)));
  progress(index+1,sheets.length);await new Promise(resolve=>setTimeout(resolve,0));
  }finally{canvas.width=canvas.height=0;}
 }
 objects[catalog-1]=bytes(`<< /Type /Catalog /Pages ${root} 0 R >>`);objects[root-1]=bytes(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(id=>id+' 0 R').join(' ')}] >>`);
 const parts=[bytes('%PDF-1.4\n')],offsets=[0];let length=parts[0].length;
 for(let i=0;i<objects.length;i++){offsets.push(length);const chunks=[bytes((i+1)+' 0 obj\n'),...[objects[i]].flat(),bytes('\nendobj\n')];for(const chunk of chunks){parts.push(chunk);length+=chunk.length;}}
 const xref=length;parts.push(bytes(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`));
 const url=URL.createObjectURL(new Blob(parts,{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download=String(name||'LemField').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}};
})();
