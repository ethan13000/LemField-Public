/* Prepare separate unpacked releases. ZIP each output folder's contents. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const chromeOnly=new Set(['service-worker.js','offscreen-client.js','offscreen.html','offscreen-parser.js']);
const docs=['README.md','SECURITY_REVIEW.md','ALPHA4_REVIEW.md','ALPHA5_REVIEW.md','INSTALL.md'];
const runtime=fs.readdirSync(root).filter(name=>/\.(js|css|html)$/.test(name));
for(const target of ['Firefox','Chromium']){
 const dir=path.resolve(root,'..','LemField-Alpha-5-'+target);fs.mkdirSync(dir,{recursive:true});
 for(const name of [...runtime,...docs]){
  if(target==='Firefox'&&chromeOnly.has(name))continue;
  fs.copyFileSync(path.join(root,name),path.join(dir,name));
 }
 const m=structuredClone(manifest);
 if(target==='Chromium'){
  delete m.browser_specific_settings;m.minimum_chrome_version='120';
  m.background={service_worker:'service-worker.js'};m.permissions=[...new Set([...m.permissions,'offscreen'])];
 }
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(m,null,2)+'\n');
 const references=[...m.content_scripts.flatMap(item=>item.js||[]),...(m.background.scripts||[]),m.background.service_worker,m.action.default_popup,...m.web_accessible_resources.flatMap(item=>item.resources)].filter(Boolean);
 for(const name of references)assert(fs.existsSync(path.join(dir,name)),target+' missing '+name);
 for(const page of ['popup.html','export.html']){
  const html=fs.readFileSync(path.join(dir,page),'utf8');assert(html.indexOf('browser-compat.js')<html.indexOf(page.replace('.html','.js')),page+' needs adapter before UI');
 }
 console.log(target+': '+dir);
}
