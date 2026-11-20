/* Card-edge alignment guides in the unused margins of a physical sheet. */
(()=>{
 'use strict';
 function segments(width,height,cards){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!cards.length)return [];
  const left=Math.min(...cards.map(c=>c.x)),top=Math.min(...cards.map(c=>c.y));
  const right=Math.max(...cards.map(c=>c.x+63)),bottom=Math.max(...cards.map(c=>c.y+88)),gap=.5,lines=[];
  const add=(x1,y1,x2,y2)=>{if(x2>x1||y2>y1)lines.push([x1,y1,x2,y2]);};
  for(const x of new Set(cards.flatMap(c=>[c.x,c.x+63])))if(x>=0&&x<=width){add(x,0,x,Math.max(0,top-gap));add(x,Math.min(height,bottom+gap),x,height);}
  for(const y of new Set(cards.flatMap(c=>[c.y,c.y+88])))if(y>=0&&y<=height){add(0,y,Math.max(0,left-gap),y);add(Math.min(width,right+gap),y,width,y);}
  return lines;
 }
 const layout=sheet=>segments(parseFloat(sheet.style.width),parseFloat(sheet.style.height),[...sheet.querySelectorAll('img')].map(img=>({x:parseFloat(img.style.left),y:parseFloat(img.style.top)})));
 function append(sheet){
  if(!sheet.classList.contains('guides'))return;
  const lines=layout(sheet);if(!lines.length)return;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('class','sheet-cut-guides');svg.setAttribute('viewBox','0 0 '+parseFloat(sheet.style.width)+' '+parseFloat(sheet.style.height));svg.setAttribute('aria-hidden','true');
  path.setAttribute('d',lines.map(([x1,y1,x2,y2])=>`M${x1} ${y1}L${x2} ${y2}`).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#888');path.setAttribute('stroke-width','.15');path.setAttribute('stroke-dasharray','1 1');svg.append(path);sheet.append(svg);
 }
 globalThis.MoxfieldPlusCutGuides={segments,layout,append};
})();
