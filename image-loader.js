/* Limit artwork downloads across LemField pickers, previews and card lists. */
(()=>{
 'use strict';
 const limit=4,pending=[],active=new Set();let scheduled=false;
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;pump();});}
 function stop(job){if(job.finished)return;job.finished=true;job.generation++;clearTimeout(job.timer);active.delete(job);job.img.onload=job.img.onerror=null;job.img.removeAttribute('src');schedule();}
 function pause(job){if(job.finished||!active.has(job))return;job.generation++;clearTimeout(job.timer);job.timer=null;active.delete(job);job.img.onload=job.img.onerror=null;job.img.removeAttribute('src');pending.unshift(job);}
 const rank=job=>job.priority==='hover'?2:job.priority?1:0;
 function pump(){
  for(let i=pending.length-1;i>=0;i--)if(!pending[i].img.isConnected){pending.splice(i,1);}
  if(active.size>=limit&&pending.some(job=>job.visible()))for(const job of [...active])if(!job.visible())pause(job);
  if(active.size>=limit&&pending.some(job=>job.visible()&&rank(job)===2)){const candidate=[...active].filter(job=>rank(job)<2).sort((a,b)=>rank(a)-rank(b))[0];if(candidate)pause(candidate);}
  while(active.size<limit){
   const eligible=pending.filter(job=>job.visible());if(!eligible.length)break;
   const job=eligible.reduce((best,job)=>rank(job)>rank(best)||rank(job)===2&&rank(best)===2?job:best);pending.splice(pending.indexOf(job),1);active.add(job);const generation=++job.generation;
   const finish=success=>{if(job.finished||job.generation!==generation)return;job.finished=true;clearTimeout(job.timer);active.delete(job);job.img.onload=job.img.onerror=null;if(!success)job.img.removeAttribute('src');schedule();if(job.img.isConnected)(success?job.loaded:job.failed)();};
   job.img.onload=()=>finish(true);job.img.onerror=()=>finish(false);
   job.timer=setTimeout(()=>finish(false),20000);
   job.img.loading='eager';job.img.fetchPriority=rank(job)===2?'high':'auto';job.img.src=job.url;
  }
 }
 globalThis.MoxImageLoader={
  enqueue(img,url,{visible=()=>true,priority=false,loaded=()=>{},failed=()=>{}}={}){const job={img,url,visible,priority,loaded,failed,finished:false,timer:null,generation:0};pending.push(job);schedule();return ()=>{const index=pending.indexOf(job);if(index>=0)pending.splice(index,1);if(active.has(job))stop(job);};},
  pump:schedule,
  clean(){for(let i=pending.length-1;i>=0;i--)if(!pending[i].img.isConnected)pending.splice(i,1);for(const job of active)if(!job.img.isConnected)stop(job);schedule();}
 };
})();
