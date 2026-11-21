/* Reproducible LemField 1.1 Firefox/Chromium packages; no network dependencies. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {zipPackage}=require('./release-archive.cjs');
const root=path.resolve(__dirname,'..'),alpha2=process.argv.includes('--alpha2'),storeBuild=process.argv.includes('--store'),out=path.resolve(root,'..',alpha2?(storeBuild?'store 1.1 alpha 2':'1.1 alpha 2'):'release 1.1');
const version=alpha2?'1.1.0.2':'1.1.0',label=alpha2?'1.1 Alpha 2':'1.1',slug=alpha2?'1.1-Alpha-2':'1.1',notes=alpha2?'PATCH_NOTES_1.1_ALPHA2.md':'PATCH_NOTES_1.1.md';
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version,'1.1.0');
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'1.1.0');
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'))).version,'1.1.0');
const runtime='art-background.js background.js basic-lands.js browser-compat.js card-search.js content.js cut-guides.js dashboard-style.js dashboard.css deck-bridge.js deck-bulk.js deck-client.js deck-selection-model.js deck-selection.js deck-duplicates.js deck-list-counts.js deck-print.js deck-search-filter.js duplicates.js edhrec-data.js edhrec.js export.css export.html export.js feature-ui.js image-loader.js offscreen-client.js offscreen-parser.js offscreen.html page-hook.js pdf-export.js popup.css popup.html popup.js print-art-store.js print-faces.js print-preferences.js print-sync.js printing-shortcuts.js privacy.html role-search.js rules.js safe-response.js scryfall-add.js search-add.js service-worker.js similar-background.js'.split(' ');
const chromeOnly=new Set(['service-worker.js','offscreen-client.js','offscreen-parser.js','offscreen.html']);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sums=[];
for(const target of ['Firefox','Chromium']){
 const dir=path.join(out,target);fs.mkdirSync(dir,{recursive:true});
 const names=[...runtime.filter(name=>target==='Chromium'||!chromeOnly.has(name)),...[48,96,128].map(size=>'icons/icon-'+size+'.png'),'manifest.json'].sort();
 const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));m.version=version;m.name='LemField';m.action.default_title=m.name;
 m.content_security_policy={extension_pages:"script-src 'self'; object-src 'self'"};
 if(target==='Firefox'&&(!alpha2||storeBuild))m.browser_specific_settings.gecko.id='moxfield-plus@ethan13000';
 if(target==='Chromium'){
  delete m.browser_specific_settings;m.version_name=label;m.minimum_chrome_version='120';m.background={service_worker:'service-worker.js'};
  m.permissions=[...new Set([...m.permissions,'offscreen'])];m.content_security_policy={extension_pages:"script-src 'self'; object-src 'self'"};
 }
 for(const name of names){
  const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});
  if(name==='manifest.json')fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');
  else{
   let bytes=fs.readFileSync(path.join(root,name));
   if(target==='Chromium'&&name==='popup.html')bytes=Buffer.from(bytes.toString().replace('your Firefox account','your Chrome account'));
   if(target==='Chromium'&&name==='privacy.html'){
    const policy=fs.readFileSync(path.join(root,'chrome-store/PRIVACY.md'),'utf8').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    bytes=Buffer.from(bytes.toString().replace(/<pre>[\s\S]*?<\/pre>/,'<pre>'+policy+'</pre>'));
   }
   fs.writeFileSync(file,bytes);
  }
 }
 const refs=[...m.content_scripts.flatMap(c=>[...(c.js||[]),...(c.css||[])]),...(m.background.scripts||[]),m.background.service_worker,m.action.default_popup,...Object.values(m.icons),...m.web_accessible_resources.flatMap(r=>r.resources)].filter(Boolean);
 for(const ref of refs)assert(names.includes(ref),'Missing manifest resource '+ref);
 for(const name of names){
  const source=fs.readFileSync(path.join(dir,name),'utf8');
  if(name.endsWith('.html'))for(const match of source.matchAll(/(?:src|href)=["']([^"']+)["']/g))if(!/^(?:https?:|#|data:)/.test(match[1]))assert(names.includes(match[1]),'Missing HTML resource '+match[1]);
  if(name==='service-worker.js')for(const match of source.matchAll(/'([^']+\.js)'/g))assert(names.includes(match[1]),'Missing worker import '+match[1]);
  if(name.endsWith('.js')){const result=cp.spawnSync(process.execPath,['--check',path.join(dir,name)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
 }
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):path.join(dir,e.name));
 for(const file of walk(dir))assert(names.includes(path.relative(dir,file).split(path.sep).join('/')),'Unexpected package file '+file);
 const zip=path.join(out,'LemField-'+slug+'-'+target+'.zip');
 zipPackage({target,zip,entries:names.map(name=>({name,file:path.join(dir,name),sha256:hash(path.join(dir,name))}))});
 sums.push(hash(zip)+'  '+path.basename(zip));
 assert.equal(hash(path.join(dir,'rules.js')),hash(path.join(root,'rules.js')),'Packaged ramp rules match active source');
}

// A common reviewer source archive can reproduce both platform packages.
const sourceNames=[...runtime,...[48,96,128].map(size=>'icons/icon-'+size+'.png'),'manifest.json','package.json','package-lock.json','README.md','INSTALL.md','PATCH_NOTES_1.1.md',...(alpha2?[notes]:[]),'PRIVACY.md','REVIEWER_NOTES.md','STORE_LISTING.md','STORE_SUBMISSION.md','scripts/build-release.cjs','scripts/release-archive.cjs','scripts/verify-release.cjs',...fs.readdirSync(path.join(root,'tests')).filter(name=>name.endsWith('.cjs')).map(name=>'tests/'+name),...fs.readdirSync(path.join(root,'chrome-store')).filter(name=>name.endsWith('.md')).map(name=>'chrome-store/'+name)].sort();
const sourceZip=path.join(out,'LemField-'+slug+'-source.zip');
zipPackage({target:'Reviewer source',zip:sourceZip,entries:sourceNames.map(name=>({name,file:path.join(root,name),sha256:hash(path.join(root,name))}))});
sums.push(hash(sourceZip)+'  '+path.basename(sourceZip));
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),sums.join('\n')+'\n');
for(const name of [notes,'INSTALL.md','REVIEWER_NOTES.md'])fs.copyFileSync(path.join(root,name),path.join(out,name));
fs.writeFileSync(path.join(out,'README.txt'),'LemField '+label+' (manifest '+version+')\n\nFirefox: LemField-'+slug+'-Firefox.zip, '+(storeBuild?'Mozilla store-upload candidate.':'unsigned temporary-install build.')+'\nChromium: LemField-'+slug+'-Chromium.zip, '+(storeBuild?'Chrome Web Store upload candidate.':'unpacked-install build.')+'\nReviewer source: LemField-'+slug+'-source.zip.\nRead INSTALL.md, REVIEWER_NOTES.md and '+notes+'.\n'+(storeBuild?'Store build preserves the Firefox store ID recorded in this project (moxfield-plus@ethan13000). Verify it matches the existing AMO listing before upload. Rebuild: node scripts/build-release.cjs --alpha2 --store.':alpha2?'Alpha builds preserve the development Firefox ID used by the working directory. Rebuild: node scripts/build-release.cjs --alpha2.':'The store Firefox ID is preserved. Development ID is separate; export settings before switching installations.')+'\nNo store upload, signing or approval is performed by this build.\n');
console.log(sums.join('\n'));
