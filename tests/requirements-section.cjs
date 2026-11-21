'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(tag,attrs={}){this.tag=tag;this.attrs={...attrs};this.children=[];this.hidden=false;this.namespaceURI='http://www.w3.org/2000/svg';}
 append(...children){this.children.push(...children.flat());}
 replaceChildren(...children){this.children=[];this.append(...children);}
 setAttribute(name,value){this.attrs[name]=value;}
 getAttribute(name){return this.attrs[name];}
 descendants(){return this.children.filter(n=>n instanceof Element).flatMap(n=>[n,...n.descendants()]);}
 querySelector(selector){return this.descendants().find(n=>selector[0]==='#'?n.attrs.id===selector.slice(1):String(n.attrs.class||'').split(' ').includes(selector.slice(1)))||null;}
}
(async()=>{
 const source=fs.readFileSync(require.resolve('../content.js'),'utf8'),saved=[];let opens=0,scrolls=0;
 const make=(tag,attrs={},...children)=>{const n=new Element(tag,attrs);n.append(...children);return n;};
 const btn=(text,onclick,cls='')=>Object.assign(make('button',{text,class:cls}),{onclick});
 const context={make,btn,picker:()=>make('select'),content:new Element('div'),host:{scrollIntoView(){scrolls++;}},sideHost:{},sideContent:new Element('div'),cards:[],state:{countSections:[],profiles:[{id:'commander',name:'Commander'}]},source:'page',status:'Up to date',mode:'metrics',expandedRule:null,settingsChangeApplied:false,requirementsCollapsed:false,featurePrefs:{mrd_features:{}},onDeckOverview:()=>true,getResults:()=>[],renderSidebar(){},currentProfile:()=>({id:'commander'}),refresh(){},renderSettings(){},save(){},placeAnchor:{isConnected:true},schedulePlacement(){},requestAnimationFrame:fn=>fn(),document:{createElementNS:(_,tag)=>new Element(tag)},browser:{storage:{local:{set:async value=>saved.push(value)}}},MoxExplorer:{open:async()=>{opens++;}}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function setRequirementsCollapsed('),source.indexOf('function getResults(')),context);
 vm.runInContext(source.slice(source.indexOf('function render(){'),source.indexOf('function renderSettings(')),context);
 vm.runInContext(source.slice(source.indexOf('function scrollToDetails('),source.indexOf('function requirementSearchButton(')),context);
 context.queueRender=()=>context.render();
 context.render();let toggle=context.content.querySelector('.requirements-toggle'),body=context.content.querySelector('#mrd-requirements-body');
 assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(toggle.getAttribute('aria-controls'),body.attrs.id);assert.equal(body.hidden,false);
 toggle.onclick();assert.equal(body.hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(context.content.querySelector('.requirements-toggle'),toggle,'Collapsing retains the focused button');assert.equal(saved.at(-1).mrd_requirements_collapsed,true);
 context.render();assert.equal(context.content.querySelector('#mrd-requirements-body').hidden,true,'Live count rerenders preserve the collapsed state');
 await context.content.querySelector('.requirements-explorer').onclick();assert.equal(opens,1,'Header Explorer opens independently of a native launcher');assert.equal(context.requirementsCollapsed,true,'Explorer action does not toggle the section');
 context.scrollToDetails('ramp');assert.equal(context.requirementsCollapsed,false,'Sidebar links reopen the section');assert.equal(context.content.querySelector('#mrd-requirements-body').hidden,false);assert.equal(context.expandedRule,'ramp');assert.equal(scrolls,1);assert.equal(saved.at(-1).mrd_requirements_collapsed,false);
 context.setRequirementsCollapsed(true);context.render();const settings=context.content.descendants().find(n=>n.getAttribute('aria-label')==='Settings');settings.onclick();assert.equal(context.requirementsCollapsed,false,'Header Settings opens the section before editing');
 context.featurePrefs.mrd_features.explorer=false;context.render();assert.equal(context.content.querySelector('.requirements-explorer'),null,'Disabled feature has no launch control');
 // The shared opener remains available when there is no native EDHREC/search toolbar.
 const explorerSource=fs.readFileSync(require.resolve('../edhrec.js'),'utf8');let focused=0;
 const existing={focus(){focused++;}},explorer={featurePrefs:{mrd_features:{}},dialogHost:()=>({shadowRoot:{querySelector:()=>existing}})};
 vm.createContext(explorer);vm.runInContext(explorerSource.slice(explorerSource.indexOf('async function openExplorer('),explorerSource.indexOf('function createExplorerLauncher(')),explorer);
 await explorer.MoxExplorer.open();assert.equal(focused,1,'Direct button focuses an already-open dialog instead of duplicating it');explorer.featurePrefs.mrd_features.explorer=false;assert.equal(await explorer.MoxExplorer.open(),false);assert.equal(focused,1);
 console.log('PASS: accessible/persisted section collapse, count rerenders, independent Explorer action, sidebar/settings reopen, feature disable and shared dialog focus.');
})().catch(error=>{console.error(error);process.exitCode=1;});
