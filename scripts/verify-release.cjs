'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');process.chdir(root);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8')),manifest=JSON.parse(fs.readFileSync('manifest.json','utf8')),lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
assert.equal(manifest.name,'LemField');assert.equal(manifest.action.default_title,'LemField');assert.equal(manifest.version,'1.1.0');assert.equal(pkg.name,'lemfield');assert.equal(pkg.version,manifest.version);assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
assert.equal(manifest.browser_specific_settings.gecko.id,'moxfield-requirements@local.extension');
const tests=[...new Set(pkg.scripts['test:data'].split(' && ').map(s=>s.replace(/^node /,'')))],failures=[];
for(const file of tests){const r=cp.spawnSync(process.execPath,[file],{encoding:'utf8',timeout:45000});if(r.status!==0)failures.push({file,error:r.stdout+r.stderr});}
const runtime=fs.readdirSync(root).filter(name=>name.endsWith('.js'));
for(const file of [...runtime,'scripts/build-release.cjs']){const r=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)failures.push({file,error:r.stderr});}
for(const file of fs.readdirSync(root).filter(name=>/\.(?:js|html|css)$/.test(name)))assert(!fs.readFileSync(file,'utf8').includes('Moxfield Plus'),'Old visible branding in '+file);
const blocked=[];let domAvailable=false;
try{require.resolve('jsdom');domAvailable=true;}catch{blocked.push('jsdom-dependent DOM/network suites: dependency unavailable');}
if(domAvailable)for(const file of ['tests/dom.cjs','tests/network.cjs','tests/edhrec-dom.cjs']){const r=cp.spawnSync(process.execPath,[file],{encoding:'utf8',timeout:45000});if(r.status!==0)failures.push({file,error:r.stdout+r.stderr});}
let browserDependencyAvailable=false;try{require.resolve('playwright');browserDependencyAvailable=true;}catch{blocked.push('Playwright browser suites: dependency unavailable');}
const result={dataSuites:tests.length,syntaxChecks:runtime.length+1,failures,blocked,browserDependencyAvailable,liveBrowserVerified:false,onlineDependencyAudit:false};fs.mkdirSync('.tmp/release-1.1',{recursive:true});fs.writeFileSync('.tmp/release-1.1/validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
