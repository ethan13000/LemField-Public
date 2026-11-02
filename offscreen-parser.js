'use strict';
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(message?.type!=='mrd-offscreen-parse-v1')return;
 if(sender.id!==chrome.runtime.id||sender.tab||typeof message.html!=='string'||message.html.length>8000000){sendResponse({ok:false,error:'Invalid parser request.'});return;}
 try{
  const E=globalThis.MoxEDHREC;
  if(message.operation==='similar'){sendResponse({ok:true,data:E.similarHTML(message.html)});return;}
  if(message.operation!=='supplement'||!message.data||!['cards','commanders'].includes(message.kind)||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(message.slug||''))throw Error('Invalid parser operation.');
  let data=message.data;
  if(data.source==='html'){const embedded=E.pageFromHTML(message.html);if(embedded){try{data=E.normalize(embedded,message.kind,message.slug);data.source='html';}catch{}}}
  E.supplementHTML(data,message.html);
  sendResponse({ok:true,data});
 }catch(error){sendResponse({ok:false,error:error.message||'HTML parsing failed.'});}
});
