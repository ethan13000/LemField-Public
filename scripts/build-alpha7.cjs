/* Build explicit Firefox/Chromium Alpha 7 payloads and verify every ZIP entry. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const crcTable=Array.from({length:256},(_,index)=>{let value=index;for(let i=0;i<8;i++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
const crc32=buffer=>{let crc=0xffffffff;for(const value of buffer)crc=crcTable[(crc^value)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
function zipPackage(plan){
 const local=[],central=[];let offset=0;
 for(const entry of plan.entries){
  const name=Buffer.from(entry.name),raw=fs.readFileSync(entry.file),compressed=zlib.deflateRawSync(raw),crc=crc32(raw),header=Buffer.alloc(30),directory=Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(name.length,26);
  directory.writeUInt32LE(0x02014b50,0);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x800,8);directory.writeUInt16LE(8,10);directory.writeUInt16LE(33,14);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(raw.length,24);directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);
  local.push(header,name,compressed);central.push(directory,name);offset+=header.length+name.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(plan.entries.length,8);end.writeUInt16LE(plan.entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);fs.writeFileSync(plan.zip,Buffer.concat([...local,directory,end]));
 const bytes=fs.readFileSync(plan.zip);let cursor=0;
 for(const entry of plan.entries){assert.equal(bytes.readUInt32LE(cursor),0x04034b50);const packed=bytes.readUInt32LE(cursor+18),size=bytes.readUInt32LE(cursor+22),length=bytes.readUInt16LE(cursor+26),extra=bytes.readUInt16LE(cursor+28),name=bytes.subarray(cursor+30,cursor+30+length).toString();assert.equal(name,entry.name);const start=cursor+30+length+extra,raw=zlib.inflateRawSync(bytes.subarray(start,start+packed));assert.equal(raw.length,size);assert.equal(crc32(raw),bytes.readUInt32LE(cursor+14));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),entry.sha256);cursor=start+packed;}
 assert.equal(cursor,offset);assert.equal(bytes.readUInt32LE(cursor),0x02014b50);console.log(plan.target+': verified '+plan.entries.length+' ZIP files: '+plan.zip);
}
const root=path.resolve(__dirname,'..'),out=path.dirname(root),readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),manifest=readJSON(path.join(root,'manifest.json'));
assert.equal(manifest.version,'1.10.60');assert.equal(readJSON(path.join(root,'package.json')).version,manifest.version);assert.equal(readJSON(path.join(root,'package-lock.json')).version,manifest.version);
const chromeOnly=new Set(['service-worker.js','offscreen-client.js','offscreen.html','offscreen-parser.js']);
const docs=['README.md','INSTALL.md'];
const runtime=fs.readdirSync(root).filter(name=>/\.(?:js|css|html)$/.test(name)).sort();
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),plan=[];
for(const target of ['Firefox','Chromium']){
 const dir=path.join(out,'LemField-Alpha-7-'+target);fs.mkdirSync(dir,{recursive:true});
 const names=[...runtime.filter(name=>target==='Chromium'||!chromeOnly.has(name)),...docs,'manifest.json'].sort();
 for(const name of names)if(name!=='manifest.json')fs.copyFileSync(path.join(root,name),path.join(dir,name));
 const m=structuredClone(manifest);
 if(target==='Chromium'){delete m.browser_specific_settings;m.minimum_chrome_version='120';m.background={service_worker:'service-worker.js'};m.permissions=[...new Set([...m.permissions,'offscreen'])];}
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(m,null,2)+'\n');
 const references=[...m.content_scripts.flatMap(item=>[...(item.js||[]),...(item.css||[])]),...(m.background.scripts||[]),m.background.service_worker,m.action.default_popup,...(m.web_accessible_resources||[]).flatMap(item=>item.resources)].filter(Boolean);
 for(const name of references)assert(names.includes(name),target+' missing '+name);
 for(const name of names.filter(name=>name.endsWith('.html'))){for(const match of fs.readFileSync(path.join(dir,name),'utf8').matchAll(/(?:src|href)=["']([^"']+)["']/g)){const ref=match[1];if(!/^(?:https?:|#|data:)/.test(ref))assert(names.includes(ref),name+' missing '+ref);}}
 for(const name of names.filter(name=>name.endsWith('.js'))){const result=cp.spawnSync(process.execPath,['--check',path.join(dir,name)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
 if(target==='Firefox')assert.equal(m.browser_specific_settings.gecko.id,'moxfield-requirements@local.extension');else assert(!m.browser_specific_settings&&m.background.service_worker);
 const zip=dir+'.zip';if(fs.existsSync(zip))fs.unlinkSync(zip);
 plan.push({target,zip,entries:names.map(name=>({name,file:path.join(dir,name),sha256:hash(path.join(dir,name))}))});
}
const reviewDir=path.join(root,'.tmp','alpha7-review');fs.mkdirSync(reviewDir,{recursive:true});const planFile=path.join(reviewDir,'package-plan.json');fs.writeFileSync(planFile,JSON.stringify(plan,null,2));
for(const item of plan)zipPackage(item);
const sums=plan.map(item=>hash(item.zip)+'  '+path.basename(item.zip)).join('\n')+'\n';fs.writeFileSync(path.join(out,'ALPHA7_SHA256SUMS.txt'),sums);

console.log(sums.trim());
