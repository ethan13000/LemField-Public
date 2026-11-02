/* Moxfield Requirements v1.9: minimal Moxfield-native layout and read-only rule presets. */
(async()=>{
'use strict';
if(document.getElementById('mrd-root'))return;
const R=globalThis.MoxRules;
const clone=value=>JSON.parse(JSON.stringify(value));
const deckId=()=>location.pathname.match(/^\/decks\/([A-Za-z0-9_-]+)/)?.[1]||null;
const onDeckOverview=()=>/^\/decks\/[A-Za-z0-9_-]+\/?$/.test(location.pathname);
const initial=await browser.storage.local.get(['mrd_settings','mrd_sidebar_position']);
const featurePrefs=await browser.storage.local.get('mrd_features');
if(featurePrefs?.mrd_features?.requirements===false)return;
let state=R.sanitizeSettings(initial?.mrd_settings);
let sidebarPosition=R.sidebarPosition(initial?.mrd_sidebar_position),sidebarDrag=null;
let cards=[],capturedDeck=null,source='none',lastReadError='',status='Waiting for deck data…';
let routeGeneration=0, evaluationCache=null,settingsChangeApplied=false,settingsSaveGeneration=0;
let activePageId=deckId(),activeOverview=onDeckOverview(),fingerprint='',fetching=false,mode='metrics',expandedRule=null,placeAnchor=null,placeTimer=null,renderQueued=false,readAttempted=false,lastRead=0,sidebarCollapsed=false,editingRule=null;
// Two separate shadow roots prevent Moxfield styles from leaking into either view.
const host=document.createElement('div');host.id='mrd-root';host.className='mrd-detail';host.hidden=!activeOverview;document.body.append(host);
const shadow=host.attachShadow({mode:'open'});
const style=document.createElement('link');style.rel='stylesheet';style.href=globalThis.MoxDashboardStyleURL;shadow.append(style);
const content=document.createElement('div');shadow.append(content);
const sideHost=document.createElement('div');sideHost.id='mrd-sidebar';sideHost.hidden=!activeOverview;document.body.append(sideHost);
const sideShadow=sideHost.attachShadow({mode:'open'});
const sideStyle=document.createElement('link');sideStyle.rel='stylesheet';sideStyle.href=globalThis.MoxDashboardStyleURL;sideShadow.append(sideStyle);
const sideContent=document.createElement('div');sideShadow.append(sideContent);
function applySidebarPosition(){
 const position=R.sidebarPosition(sidebarPosition,innerHeight);
 sideHost.style.setProperty('--sidebar-top',position.top+'px');
 sideHost.style.setProperty('--sidebar-left',position.side==='left'?'8px':'auto');
 sideHost.style.setProperty('--sidebar-right',position.side==='right'?'8px':'auto');
 sideHost.style.setProperty('--sidebar-height',Math.max(48,innerHeight-position.top-8)+'px');
 sideHost.dataset.side=position.side;
}
function saveSidebarPosition(){browser.storage.local.set({mrd_sidebar_position:sidebarPosition}).catch(err=>{status='Sidebar position save failed: '+err.message;queueRender();});}
function endSidebarDrag(event){
 if(!sidebarDrag||event.pointerId!==sidebarDrag.pointerId)return;
 if(event.type==='pointercancel')sidebarPosition=sidebarDrag.previous;
 else saveSidebarPosition();
 sidebarDrag=null;sideHost.classList.remove('dragging');applySidebarPosition();
}
sideContent.addEventListener('pointerdown',event=>{
 const handle=event.target.closest('.side-drag-handle');if(!handle||event.button!==0)return;
 const rect=sideHost.getBoundingClientRect();
 sidebarDrag={pointerId:event.pointerId,offsetY:event.clientY-rect.top,offsetX:event.clientX-rect.left,width:rect.width,previous:{...sidebarPosition}};
 handle.setPointerCapture(event.pointerId);sideHost.classList.add('dragging');event.preventDefault();
});
sideContent.addEventListener('pointermove',event=>{
 if(!sidebarDrag||event.pointerId!==sidebarDrag.pointerId)return;
 const center=event.clientX-sidebarDrag.offsetX+sidebarDrag.width/2;
 sidebarPosition=R.sidebarPosition({side:center<innerWidth/2?'left':'right',top:event.clientY-sidebarDrag.offsetY},innerHeight);
 applySidebarPosition();
});
sideContent.addEventListener('pointerup',endSidebarDrag);
sideContent.addEventListener('pointercancel',endSidebarDrag);
sideContent.addEventListener('lostpointercapture',event=>{if(sidebarDrag)endSidebarDrag({...sidebarDrag,type:'pointercancel'});});
sideContent.addEventListener('keydown',event=>{
 if(!event.target.closest('.side-drag-handle')||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home'].includes(event.key))return;
 event.preventDefault();const step=event.shiftKey?40:10;
 sidebarPosition=R.sidebarPosition({side:event.key==='ArrowLeft'?'left':event.key==='ArrowRight'?'right':sidebarPosition.side,top:event.key==='Home'?92:sidebarPosition.top+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)},innerHeight);
 applySidebarPosition();saveSidebarPosition();
});
window.addEventListener('resize',applySidebarPosition);
applySidebarPosition();
const make=(tag,attrs={},...children)=>{
 const el=document.createElement(tag);
 for(const [name,val] of Object.entries(attrs)){
  if(name==='class')el.className=val;
  else if(name==='text')el.textContent=String(val);
  else if(name==='value')el.value=String(val);
  else if(name==='checked')el.checked=!!val;
  else if(name.startsWith('on')&&typeof val==='function')el.addEventListener(name.slice(2).toLowerCase(),val);
  else if(val!==null&&val!==undefined)el.setAttribute(name,String(val));
 }
 for(const child of children.flat())if(child!==null&&child!==undefined)el.append(child instanceof Node?child:document.createTextNode(String(child)));
 return el;
};
const btn=(label,callback,cls='')=>make('button',{type:'button',class:cls,text:label,onclick:callback});
const field=(value,cb,type='text')=>make('input',{type,value:value??'',onchange:ev=>cb(ev.target.value)});
const picker=(options,selected,callback)=>{const el=make('select',{onchange:ev=>callback(ev.target.value)});for(const [id,label] of options)el.append(make('option',{value:id,text:label,...(id===selected?{selected:'selected'}:{})}));return el;};
const save=()=>{evaluationCache=null;settingsChangeApplied=true;const generation=++settingsSaveGeneration;queueRender();return browser.storage.local.set({mrd_settings:state}).catch(err=>{if(generation===settingsSaveGeneration){status='Settings save failed: '+err.message;queueRender();}});};
function currentProfile(){const id=state.perDeck[deckId()]||state.selectedProfile;const base=state.profiles.find(p=>p.id===id)||state.profiles[0];return state.deckProfiles?.[deckId()]?.[base.id]||base;}
function editableProfile(){const profile=currentProfile();state.deckProfiles??=Object.create(null);state.deckProfiles[deckId()]??=Object.create(null);return state.deckProfiles[deckId()][profile.id]??=clone(profile);}
function deckOverrides(){state.deckManualOverrides??=Object.create(null);return state.deckManualOverrides[deckId()]??=Object.assign(Object.create(null),clone(state.manualOverrides));}
// Graph location uses a bounded search of interactive elements, never Patreon banners.
// Once placed, nothing scans the page until Moxfield replaces its graph container.
function findGraphBlock(){
 const marker=[...document.querySelectorAll('button,a')].find(el=>
  el.getClientRects().length && /hypergeometric calculator/i.test(el.textContent||''));
 if(!marker)return null;
 // Start at the chart, then promote through column wrappers to the analytics row.
 // Never insert into a flex/grid row: that turns our panel into an extra column.
 let chart=null;
 for(let el=marker.parentElement,depth=0;el&&el!==document.body&&depth<12;el=el.parentElement,depth++){
  if(el.querySelector('svg,canvas,[role="img"]')){chart=el;break;}
 }
 if(!chart)return null;
 let block=chart;
 for(let depth=0;depth<8&&block.parentElement&&block.parentElement!==document.body;depth++){
  const parent=block.parentElement, css=getComputedStyle(parent);
  if(parent.matches('main,#root,#__next') || parent.querySelector('h1'))break;
  const isLayout=/flex|grid/.test(css.display)||parent.classList.contains('row');
  if(isLayout){block=parent;continue;}
  // Look through a narrow column wrapper for its owning analytics row.
  const grand=parent.parentElement;
  if(grand && !grand.querySelector('h1') && (/flex|grid/.test(getComputedStyle(grand).display)||grand.classList.contains('row'))){block=grand;continue;}
  break;
 }
 return block;
}
function tryPlace(){
 if(!onDeckOverview()){host.hidden=true;sideHost.hidden=true;return;}
 host.hidden=false;sideHost.hidden=false;
 const graph=findGraphBlock();
 if(graph?.parentNode){
  graph.before(host);
  placeAnchor=graph;
  host.className='mrd-detail';
 }else{
  placeAnchor=null;
  if(host.parentNode!==document.body)document.body.append(host);
  host.className='mrd-detail mrd-fallback';
 }
}
function schedulePlacement(delay=0){
 if(placeTimer!==null)return;
 placeTimer=setTimeout(()=>{placeTimer=null;
  if(placeAnchor?.isConnected&&host.nextElementSibling===placeAnchor)return;
  tryPlace();
 },delay);
}
function scrollToDetails(ruleId=null){
 if(!onDeckOverview())return;
 if(ruleId){expandedRule=ruleId;mode='metrics';queueRender();}
 if(!placeAnchor?.isConnected)schedulePlacement(0);
 requestAnimationFrame(()=>host.scrollIntoView({behavior:'smooth',block:'start'}));
}
function requirementSearchButton(rule){
 const search=R.requirementSearch(rule,cards);
 const icon=()=>{
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:15,height:15,fill:'none',stroke:'#cba8dd','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,String(value));
  svg.style.cssText='display:block;width:15px;height:15px;min-width:15px;max-width:15px;min-height:15px;max-height:15px;flex:none;pointer-events:none';
  for(const [tag,attrs] of [['circle',{cx:10.5,cy:10.5,r:6.5}],['path',{d:'m16 16 4.5 4.5'}]]){
   const shape=document.createElementNS(svg.namespaceURI,tag);
   for(const [key,value] of Object.entries({...attrs,fill:'none',stroke:'#cba8dd','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round'}))shape.setAttribute(key,String(value));
   svg.append(shape);
  }
  return svg;
 };
 if(search.error){const button=btn('',()=>{},'requirement-search');button.style.cssText='display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;width:24px;height:24px;padding:4px;box-sizing:border-box';button.append(icon());button.disabled=true;button.title=search.error;button.setAttribute('aria-label',`Search ${rule.name}: ${search.error}`);return button;}
 return make('a',{class:'requirement-search',style:'display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;width:24px;height:24px;padding:4px;box-sizing:border-box',href:search.url,target:'_blank',rel:'noopener noreferrer',title:`Search Moxfield for ${rule.name}`,'aria-label':`Search Moxfield for ${rule.name}`},icon());
}
function requirementSearchActions(rule){
 return make('div',{class:'requirement-search-actions'},requirementSearchButton(rule));
}
function renderSidebar(results){
 sideContent.replaceChildren();

 const wrapper=make('section',{class:'side-panel'});
 sideContent.append(wrapper);
 const title=make('div',{class:'side-heading'});
 wrapper.append(title);
 const handle=btn('',()=>{},'side-title side-drag-handle');handle.title='Drag up or down; drag across the page to snap left or right. Arrow keys move or snap; Home resets height.';handle.setAttribute('aria-label','Move requirements sidebar. Up and Down move; Left and Right snap to an edge.');
 handle.append(make('span',{class:'drag-grip','aria-hidden':'true',text:'\u283f'}),make('strong',{text:'Requirements'}));title.append(handle);
 title.append(btn(sidebarCollapsed?'◀':'▶',()=>{sidebarCollapsed=!sidebarCollapsed;sideHost.classList.toggle('collapsed',sidebarCollapsed);queueRender();},'side-toggle'));
 if(sidebarCollapsed)return;
 const list=make('div',{class:'side-list'});wrapper.append(list);
 if(!results.length)list.append(make('p',{class:'side-empty',text:'Add requirements in Settings.'}));
 for(const r of results){
  const low=Number(r.min)||0;
  const high=r.max!==null&&r.max!==''&&r.max!==undefined?Number(r.max):null;
  const over=high!==null&&r.count>high;
  const ok=resultStatus(r)==='Target met';
  const entry=btn('',()=>scrollToDetails(r.id),'side-metric '+(ok?'good':over?'over':'low'));
  entry.title=`${r.name}: ${r.count} cards, target ${low}${high===null?'':'–'+high}. Open matching cards.`;
  entry.append(make('span',{class:'status-dot '+(ok?'good':over?'over':'low'),'aria-hidden':'true'}),make('span',{class:'side-metric-name',text:r.name}),make('span',{class:'requirement-help',text:'?','data-tooltip':requirementHelp(r),'aria-label':`${r.name}: ${requirementHelp(r)}`}),make('b',{class:'side-metric-count',text:`${r.count} / ${low}${high===null?'':'–'+high}`}));
  list.append(make('div',{class:'side-requirement-row'},entry,requirementSearchActions(r)));
 }
 const foot=make('div',{class:'side-footer'});
 foot.append(btn('Requirements ↓',()=>scrollToDetails(),'side-more'));
 wrapper.append(foot);
}
function queueRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;render();});}
function getResults(){const profile=currentProfile();if(!evaluationCache||evaluationCache.cards!==cards||evaluationCache.profile!==profile){evaluationCache={cards,profile,results:R.evaluate(cards,profile.rules,state.countSections,deckOverrides(),state.tagOverrides)};}return evaluationCache.results;}
function resultStatus(r){if(r.count<(Number(r.min)||0))return 'Below target';if(r.max!==null&&r.max!==''&&r.max!==undefined&&r.count>Number(r.max))return 'Above maximum';return 'Target met';}
function requirementHelp(r){const help={spot:'Counts targeted answers such as removal or bounce. These help you deal with dangerous creatures and permanents before they take over.',wipes:'Counts sweepers that can clear multiple creatures or other threats. Keep some for boards that outgrow your spot removal.',counter:'Counts spells that counter opposing spells or abilities. They protect your plan from key plays that removal cannot stop.', 'artifact-removal':'Counts cards that can destroy or exile artifacts. This answers mana rocks and artifact-based engines.', 'enchantment-removal':'Counts answers to enchantments. These can remove persistent effects that creature removal cannot touch.', 'grave-hate':'Counts cards that exile or disrupt graveyards. Include them when opponents may rely on recursion or graveyard combos.',protection:'Counts effects that shield your commander or other important cards. Protection helps preserve your board and key investments.', 'combat-tricks':'Counts temporary combat boosts and surprise defenses. These support combat-focused plans and can help win creature exchanges.',draw:'Counts cards that draw cards. Draw helps refill your hand so you continue making plays after your opening resources are spent.',selection:'Counts effects that sift, scry, surveil, or inspect cards. Selection improves draw quality and helps find the right card for the moment.',tutors:'Counts cards that search your library for specific cards. Tutors make key pieces easier to find, though the default target stays modest.',recursion:'Counts effects that return or recast cards from your graveyard. Recursion gives important cards another use after they are spent or removed.',discard:'Counts cards that let you discard cards. Outlets enable graveyard strategies and can turn otherwise stranded cards into resources.',wheel:'Counts effects that make players discard and draw new hands. Wheels refill your hand and can disrupt opponents’ plans.',ramp:'Counts cards that produce extra mana or put lands onto the battlefield. Ramp helps you cast spells earlier than normal land drops allow.','mana-rocks':'Counts artifacts that produce mana. Rocks add ramp that is less dependent on creature survival.', 'mana-dorks':'Counts creatures that produce mana. Dorks provide early acceleration and can support creature synergies.',lands:'Counts lands in the selected deck sections. Lands let you make land drops and provide the mana needed to cast spells.','basic-lands':'Counts basic lands. Basics are reliable, searchable mana sources and are less exposed to nonbasic-land hate.','nonbasic-lands':'Counts lands that are not basic. Nonbasics add color fixing and utility beyond basic land types.',fixing:'Counts cards that help produce or find the colors you need. Fixing reduces the chance of being unable to cast colored spells.',mv0:'Counts cards with mana value zero. These affect the low end of your curve and include free spells and other zero-cost cards.',mv1:'Counts one-mana cards. One-drops provide early plays and help keep the deck active in the first turns.',mv2:'Counts two-mana cards. Two-drops help fill early turns and smooth the curve.',mv3:'Counts three-mana cards. This tracks the middle of your curve, where many utility and value plays sit.',mv4:'Counts four-mana cards. This helps monitor how many mid-to-high-cost plays compete for your mana.',mv5:'Counts cards with mana value five or greater. These are powerful top-end plays, but too many can clog your opening hand.','mv1-2':'Counts cards costing one or two mana. Cheap plays keep your early turns productive and give you options while developing.', 'mv1-3':'Counts cards costing one to three mana. This tracks the early curve and helps ensure you have plays before the later turns.',creatures:'Counts creature cards. Creatures provide attackers, blockers, and bodies for creature-based strategies.',instants:'Counts instants. Instants can be used at flexible times and support interaction during opponents’ turns.',sorceries:'Counts sorceries. Sorceries provide one-time effects during your own main phases and may support spells-matter plans.',artifacts:'Counts artifact cards. Artifacts can provide mana, utility, or synergy, depending on your deck.',enchantments:'Counts enchantment cards. Enchantments offer persistent effects and can support enchantment-focused strategies.',planeswalkers:'Counts planeswalkers. They provide repeatable abilities and can draw attacks away from you.','token-makers':'Counts cards that create tokens. Token makers build a board and support go-wide, sacrifice, and token synergies.',sacrifice:'Counts sacrifice outlets. Outlets let you control when creatures or other permanents die, enabling death triggers and sacrifice payoffs.',reanimation:'Counts effects that return creatures from graveyards to the battlefield. Reanimation provides a way to deploy large threats efficiently.',mill:'Counts effects that put cards from a library into a graveyard. Mill can pressure opponents or support graveyard strategies.', 'self-mill':'Counts effects that put your own library cards into your graveyard. Self-mill stocks the graveyard for recursion and reanimation.', 'life-gain':'Counts cards that gain life. These support lifegain payoffs and can help stabilize against aggressive decks.', 'life-loss':'Counts cards that make opponents lose life. These provide reach and support drain or life-loss strategies.', '+1-counters':'Counts cards that create or multiply +1/+1 counters. Counter support grows creatures and enables counter synergies.',evasion:'Counts cards that make attackers harder to block. Evasion helps creatures connect and deal combat damage.',haste:'Counts cards that grant haste. Haste lets creatures attack or use tap abilities sooner.', 'extra-combat':'Counts effects that create additional combat phases. These multiply attack opportunities for combat-focused decks.',stax:'Counts effects that tax or restrict opponents. These can slow opposing strategies and buy time for your plan.', 'grave-payoffs':'Counts cards rewarded by graveyard size, deaths, or cards leaving the graveyard. Payoffs turn graveyard activity into value.'};return help[r.presetId||r.id]||`Counts cards that match the conditions for “${r.name}.” This target helps you check that the deck includes enough of this role to support its plan.`;}
function render(){
 host.hidden=!onDeckOverview();sideHost.hidden=!onDeckOverview();
 content.replaceChildren();if(!onDeckOverview()){sideContent.replaceChildren();return;}
 const results=getResults();
 const total=cards.filter(c=>state.countSections.includes(c.section)).reduce((sum,c)=>sum+c.qty,0);
 renderSidebar(results);
 const panel=make('section',{class:'panel'}),head=make('header',{class:'header'});
 content.append(panel);panel.append(head);
 head.append(make('div',{class:'header-title'},make('h2',{text:'Deck requirements'})));
 const actions=make('div',{class:'actions'});head.append(actions);
 const refreshAction=btn('↻',()=>refresh(true),'icon-button');refreshAction.title='Refresh deck';refreshAction.setAttribute('aria-label','Refresh deck');
 const settingsAction=btn(mode==='settings'?'✓':'⚙',()=>{mode=mode==='settings'?'metrics':'settings';if(mode==='settings')settingsChangeApplied=false;expandedRule=null;queueRender();},'icon-button'+(mode==='settings'&&settingsChangeApplied?' saved':''));settingsAction.title=mode==='settings'?(settingsChangeApplied?'Change applied. Select to return to deck requirements.':'Return to deck requirements'):'Settings';settingsAction.setAttribute('aria-label',mode==='settings'?(settingsChangeApplied?'Change applied. Return to deck requirements':'Return to deck requirements'):'Settings');
 actions.append(refreshAction,settingsAction);
 const body=make('div',{class:'body'});panel.append(body);
 const toolbar=make('div',{class:'toolbar'}),tools=make('div',{class:'tools'});body.append(toolbar);toolbar.append(tools);
 tools.append(make('label',{text:'Profile'}),picker(state.profiles.map(p=>[p.id,p.name]),currentProfile().id,id=>{state.perDeck[deckId()]=id;save();queueRender();}),btn('Settings',()=>{settingsChangeApplied=false;mode='settings';queueRender();},'compact'));
 body.append(make('p',{class:'hint preset-guidance',text:'Presets are general guidelines and may not be optimal for every deck.'}));
 const sourceLabel=source==='page'?'Moxfield':source==='api'?'Moxfield API':source==='paste'?'Pasted list':'Waiting for Moxfield';
 body.append(make('div',{class:'sync'},make('span',{class:'sync-dot '+(cards.length?'':'warn')}),make('span',{text:`${sourceLabel} · ${total} cards · ${status}`})));
 if(mode==='settings'){
  renderSettings(body);return;
 }
 body.append(make('div',{class:'section-label'},make('span',{text:'Requirements'}),make('span',{class:'muted',text:`${results.length} tracked`})));
 const grid=make('div',{class:'grid'});body.append(grid);
 if(!results.length)grid.append(make('p',{text:'No requirements yet. Open Settings to add some.'}));
 for(const r of results){
  const low=Number(r.min)||0,high=r.max!==null&&r.max!==''&&r.max!==undefined?Number(r.max):null;
  const ok=r.count>=low&&(high===null||r.count<=high),over=high!==null&&r.count>high;
  const metric=btn('',()=>{expandedRule=expandedRule===r.id?null:r.id;queueRender();},`metric ${ok?'good':over?'over':'low'}`);
  metric.setAttribute('aria-expanded',String(expandedRule===r.id));
  metric.append(make('span',{class:'status-dot '+(ok?'good':over?'over':'low'),'aria-hidden':'true'}),make('span',{class:'metric-name',text:r.name}),make('span',{class:'requirement-help',text:'?','data-tooltip':requirementHelp(r),'aria-label':`${r.name}: ${requirementHelp(r)}`}),make('span',{class:'metric-target',text:`${r.count} / ${low}${high!==null?'–'+high:''}`}),make('span',{class:'metric-status',text:resultStatus(r)}),make('span',{class:'metric-chevron',text:expandedRule===r.id?'⌃':'⌄'}));
  grid.append(make('div',{class:'requirement-row'},metric,requirementSearchActions(r)));
  if(expandedRule===r.id){
   const list=make('div',{class:'matches'},make('h3',{text:`Matching cards: ${r.name}`}));
   if(!r.cards.length)list.append(make('p',{class:'hint',text:'No matching cards. Adjust the rule criteria or manual tags.'}));
   for(const c of r.cards){
    const details=make('details',{class:'match-explanation'}),summary=make('summary',{text:'Why it counts'});details.append(summary);
    const explanation=R.explainMatch(c,r,deckOverrides(),state.tagOverrides);
    for(const reason of explanation.reasons){
     details.append(make('p',{class:'hint',text:reason.text}));
     if(reason.actual){const text=make('p',{class:'match-source'}),index=reason.highlight?reason.actual.indexOf(reason.highlight):-1;
      if(index>=0)text.append(document.createTextNode(reason.actual.slice(0,index)),make('mark',{text:reason.highlight}),document.createTextNode(reason.actual.slice(index+reason.highlight.length)));else text.textContent=reason.actual;
      details.append(text);
     }
    }
    list.append(make('div',{class:'match-row'},make('div',{class:'left'},make('span',{text:c.qty+'\u00d7 '+c.name+' ('+c.section+')'}),details),btn('Exclude',()=>{const key=c.name.toLowerCase(),overrides=deckOverrides();overrides[key]??={};overrides[key][r.id]=false;save();queueRender();},'compact')));
   }
   grid.append(list);
  }
 }
 const footer=make('div',{class:'footer'});body.append(footer);
 footer.append(make('span',{class:'hint',text:'Counts are estimates. A card can match more than one requirement.'}),make('div',{class:'tools'},btn('Refresh',()=>refresh(true),'compact'),btn('Paste list',()=>{const str=prompt('Paste a decklist (one card per line):','');if(str?.trim())parseText(str);},'compact')));
}
function renderSettings(body){
 const config=make('div',{class:'settings'});body.append(config);
 const profile=editableProfile();
 const h=make('div',{class:'settings-section-title'},make('h3',{text:'Profiles'}),make('p',{text:'Profile selection, target edits, and exclusions are saved for this deck. Choose a starting template or customize your own.'}),make('p',{class:'preset-guidance',text:'Presets are general guidelines and may not be optimal for every deck.'}));config.append(h);
 const create=make('div',{class:'profile-create'});config.append(create);
 const profileName=make('input',{placeholder:'New profile name','aria-label':'New profile name'});
 const base=picker([['blank','Empty profile'],['current','Copy current profile'],...R.templates.map(t=>[t.id,t.name])],'commander',()=>{});
 const createButton=btn('Create profile',()=>{
  const name=profileName.value.trim();if(!name){profileName.focus();return;}
  const from=base.value;
  const template=R.templates.find(t=>t.id===from);
  const selectedRules=from==='current'?clone(currentProfile().rules):template?clone(template.rules):[];
  const id='custom_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
  state.profiles.push({id,name:name.slice(0,80),rules:selectedRules});
  state.perDeck[deckId()]=id;mode='settings';save();queueRender();
 },'primary');
 create.append(profileName,base,createButton);
 const editProfile=make('div',{class:'profile-edit'});config.append(editProfile);
 editProfile.append(make('label',{text:'Profile name'}),field(profile.name,v=>{profile.name=v.trim()||'Untitled';save();}));
 editProfile.append(btn('Duplicate',()=>{const copy=clone(currentProfile());copy.id='custom_'+Date.now();copy.name+=' copy';state.profiles.push(copy);state.perDeck[deckId()]=copy.id;save();queueRender();},'compact'));
 editProfile.append(btn('Delete',()=>{
  if(state.profiles.length<=1){alert('Keep at least one profile.');return;}
  if(!confirm('Delete this profile?'))return;
  const id=currentProfile().id;state.profiles=state.profiles.filter(p=>p.id!==id);
  Object.keys(state.perDeck).forEach(k=>{if(state.perDeck[k]===id)delete state.perDeck[k];});
  if(state.selectedProfile===id)state.selectedProfile=state.profiles[0].id;
  save();queueRender();
 },'compact danger'));
 config.append(make('div',{class:'section-divider'}));
 config.append(make('div',{class:'settings-section-title'},make('h3',{text:'Requirements'}),make('p',{text:'Select a category to add it. Targets and conditions can be edited afterward.'})));
 const addRow=make('div',{class:'preset-add'});config.append(addRow);
 const grouped=make('select',{'aria-label':'Requirement preset'});
 let group='';for(const preset of R.presetLibrary){if(group!==preset.group){group=preset.group;grouped.append(make('optgroup',{label:group}));}grouped.lastElementChild.append(make('option',{value:preset.id,text:preset.name}));}
 const min=make('input',{type:'number',min:0,value:'',placeholder:'Target','aria-label':'Target minimum'});
 function updateTarget(){const p=R.presetLibrary.find(p=>p.id===grouped.value);min.value=String(p?.min??1);}
 grouped.addEventListener('change',updateTarget);updateTarget();
 addRow.append(grouped,min,btn('Add requirement',()=>{
  const rule=R.asRule(grouped.value);if(!rule)return;
  rule.id='rule_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  rule.presetId=grouped.value;rule.min=Math.max(0,Number(min.value)||0);
  editableProfile().rules.push(rule);save();queueRender();
 },'primary'));
 const ruleList=make('div',{class:'rule-list'});config.append(ruleList);
 if(!profile.rules.length)ruleList.append(make('p',{class:'hint',text:'No requirements added.'}));
 for(const rule of profile.rules){
  const row=make('div',{class:'rule-box'});ruleList.append(row);
  const heading=make('div',{class:'rule-heading'});row.append(heading);
  heading.append(make('div',{class:'rule-heading-name'},make('strong',{text:rule.name}),make('small',{text:`Target ${rule.min}${rule.max!==null&&rule.max!==undefined&&rule.max!==''?'–'+rule.max:'+'}`})));
  heading.append(btn('Edit',()=>{editingRule=editingRule===rule.id?null:rule.id;queueRender();},'compact'),btn('Remove',()=>{profile.rules=profile.rules.filter(x=>x!==rule);save();queueRender();},'compact danger'));
  if(editingRule!==rule.id)continue;
  const editor=make('div',{class:'rule-editor'});row.append(editor);
  editor.append(make('div',{class:'field'},make('label',{text:'Name'}),field(rule.name,v=>{rule.name=v;save();})),make('div',{class:'field'},make('label',{text:'Minimum'}),field(rule.min,v=>{rule.min=Math.max(0,Number(v)||0);save();},'number'),make('label',{text:'Maximum'}),field(rule.max??'',v=>{rule.max=v===''?null:Math.max(0,Number(v)||0);save();},'number')));
  editor.append(make('div',{class:'field'},make('label',{text:'Match'}),picker([['any','Any condition'],['all','Every condition']],rule.logic,v=>{rule.logic=v;save();})));
  for(const c of rule.criteria){
   if(c.op==='regex'&&!R.isSafePattern(c.value))editor.append(make('p',{class:'hint',text:'This pattern is invalid or too complex to run safely. Simplify it or use Contains conditions.'}));
   const group=make('div',{class:'criterion'});editor.append(group);
   group.append(picker([['oracle','Card text'],['name','Card name'],['type','Card type'],['tag','Tags'],['manaValue','Mana value'],['color','Color identity']],c.field,v=>{c.field=v;save();}),picker([['contains','Contains'],['notContains','Does not contain'],['equals','Equals'],['regex','Pattern (advanced)'],['gte','At least'],['lte','At most']],c.op,v=>{c.op=v;save();}),field(c.value,v=>{c.value=v;save();}),btn('Remove',()=>{rule.criteria=rule.criteria.filter(x=>x!==c);save();queueRender();},'compact'));
  }
  editor.append(btn('Add condition',()=>{rule.criteria.push({field:'oracle',op:'contains',value:''});save();queueRender();},'compact'));
 }
 config.append(make('div',{class:'section-divider'}));
 config.append(make('div',{class:'settings-section-title'},make('h3',{text:'Card zones'})));
 const zones=make('div',{class:'field'});config.append(zones);
 for(const [key,label] of [['mainboard','Mainboard'],['commanders','Commanders'],['sideboard','Sideboard'],['companions','Companions'],['maybeboard','Maybeboard']]){
  const cb=make('input',{type:'checkbox',checked:state.countSections.includes(key),onchange:ev=>{state.countSections=ev.target.checked?[...new Set([...state.countSections,key])]:state.countSections.filter(x=>x!==key);save();queueRender();}});
  zones.append(make('label',{class:'checkrow'},cb,label));
 }
 config.append(make('div',{class:'section-divider'}));
 config.append(make('div',{class:'settings-section-title'},make('h3',{text:'Manual tags'}),make('p',{text:'Optional labels for cards not categorized automatically.'})));
 const tagName=make('input',{placeholder:'Card name'}),tagList=make('input',{placeholder:'ramp, removal, draw'});
 config.append(make('div',{class:'field'},tagName,tagList,btn('Save tags',()=>{if(!tagName.value.trim())return;state.tagOverrides[tagName.value.trim().toLowerCase()]=tagList.value.split(',').map(s=>s.trim()).filter(Boolean);save();queueRender();},'compact')));
 config.append(btn('Clear manual exclusions',()=>{state.deckManualOverrides??=Object.create(null);state.deckManualOverrides[deckId()]=Object.create(null);save();queueRender();},'compact'));
 config.append(make('div',{class:'section-divider'}));
 config.append(make('div',{class:'settings-section-title'},make('h3',{text:'Settings'})));
 config.append(make('div',{class:'field'},btn('Export',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const link=make('a',{href:URL.createObjectURL(blob),download:'lemfield-settings.json'});link.click();setTimeout(()=>URL.revokeObjectURL(link.href),3000);},'compact'),btn('Reset',()=>{if(!confirm('Reset profiles and settings?'))return;state=R.sanitizeSettings(R.defaults);save();mode='metrics';queueRender();},'compact danger')));
 config.append(make('input',{type:'file',accept:'.json,application/json',onchange:async ev=>{const file=ev.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw Error('Settings files must be smaller than 5 MB.');const val=JSON.parse(await file.text());state=R.sanitizeSettings(val,true);await save();mode='metrics';queueRender();}catch(err){alert('Unable to import settings: '+err.message);}}}));
 config.append(btn('Back to requirements',()=>{mode='metrics';queueRender();},'compact'));
}
function deckSignature(items,data){
 return JSON.stringify([data?.updatedAt??data?.lastUpdated??'',items.map(c=>[c.name,c.id,c.qty,c.section,c.oracle,c.type,c.manaValue,c.tags,c.colors,c.colorIdentityKnown])]);
}
function acceptDeck(data,kind){
 if(!data||typeof data!=='object')return false;
 const incoming=R.normalizeDeck(data);
 if(!incoming.length&&!data.boards&&!data.mainboard&&!data.mainBoard)return false;
 const next=deckSignature(incoming,data);
 if(kind==='page')capturedDeck=data;
 if(next===fingerprint&&cards.length){status='Deck is up to date';queueRender();return true;}
 fingerprint=next;cards=incoming;source=kind;
 status=`Deck synced from Moxfield (${kind==='page'?'page':'API'})`;
 queueRender();return true;
}
async function refresh(force=false){
 const id=deckId();if(!id||fetching)return;
 const requestPage=activePageId, generation=routeGeneration, revision=fingerprint;
 if(!force&&capturedDeck){acceptDeck(capturedDeck,'page');return;}
 if(!force&&readAttempted)return;
 readAttempted=true;fetching=true;lastRead=Date.now();
 if(force){status='Checking Moxfield for updates…';queueRender();}
 try{
  const reply=await browser.runtime.sendMessage({type:'mrd-read-deck',id});
  if((deckId()!==requestPage||generation!==routeGeneration) || fingerprint!==revision)return;
  if(reply?.ok){if(!acceptDeck(reply.data,'api'))throw Error('Unexpected deck format');}
  else{lastReadError=reply?.error||'no API response';if(capturedDeck)acceptDeck(capturedDeck,'page');else status=`Page capture pending (background request: ${lastReadError})`;queueRender();}
 }catch(e){if((deckId()!==requestPage||generation!==routeGeneration))return;lastReadError=e.message;if(capturedDeck)acceptDeck(capturedDeck,'page');else{status='Waiting for Moxfield page capture; '+lastReadError;queueRender();}}
 finally{if(deckId()===requestPage&&generation===routeGeneration)fetching=false;}
}
function parseText(str){const parsed=[];let section='mainboard';for(const raw of str.split(/\r?\n/)){
 const line=raw.trim();if(!line)continue;
 if(/^(sideboard|maybeboard|commander|companion):?$/i.test(line)){section=/side/i.test(line)?'sideboard':/maybe/i.test(line)?'maybeboard':/companion/i.test(line)?'companions':'commanders';continue;}
 const m=line.match(/^(?:SB:\s*)?(\d+)\s+(.+?)(?:\s+\([A-Z0-9]+\)\s+\S+)?(?:\s+\*[^*]+\*)?$/i);
 if(m)parsed.push({name:m[2],qty:+m[1],section:/^SB:/i.test(line)?'sideboard':section,oracle:'',type:'',manaValue:null,tags:[],colors:'',colorIdentityKnown:false});
 }if(parsed.length){cards=parsed;source='paste';fingerprint='';status='Pasted card names (full card data unavailable)';queueRender();}
}
function routeChanged(){
 const id=deckId(),overview=onDeckOverview();
 if(id===activePageId&&overview===activeOverview)return;
 activeOverview=overview;
 host.hidden=!overview;sideHost.hidden=!overview;
 if(id===activePageId){queueRender();if(overview){schedulePlacement(0);if(!readAttempted)setTimeout(()=>refresh(false),1700);}return;}
 activePageId=id;routeGeneration++;cards=[];capturedDeck=null;fingerprint='';source='none';status='Waiting for new deck…';readAttempted=false;fetching=false;expandedRule=null;placeAnchor=null;
 queueRender();if(overview){schedulePlacement(0);setTimeout(()=>refresh(false),1700);}
}
window.addEventListener('message',event=>{
 if(event.source!==window||event.origin!==location.origin)return;
 const msg=event.data;
 if(msg?.source==='mrd-route-v3'){routeChanged();return;}
 if(msg?.source!=='mrd-deck-response-v2'||msg.id!==deckId())return;
 acceptDeck(msg.deck,'page');
});
// A low-frequency check only repositions the details if its graph anchor is replaced.
// No subtree MutationObserver and no Patreon or full-text scanning.
setInterval(()=>{
 if(!onDeckOverview()||document.hidden)return;
 if(placeAnchor?.isConnected&&host.nextElementSibling===placeAnchor)return;
 schedulePlacement(0);
},5000);
window.addEventListener('popstate',routeChanged);
window.addEventListener('focus',()=>{if(!capturedDeck&&Date.now()-lastRead>90000)refresh(true);});
browser.runtime.onMessage.addListener(msg=>{
 if(msg?.type==='snapshot')return Promise.resolve({deckUrl:location.href,status,cards,results:getResults().map(r=>({name:r.name,count:r.count,min:r.min,max:r.max})),readable:source==='api'||source==='page'});
 if(msg?.type==='refresh'){refresh(true);return Promise.resolve({ok:true});}
 if(msg?.type==='open-panel'){scrollToDetails();return Promise.resolve({ok:true});}
});
window.addEventListener('resize',()=>{placeAnchor=null;schedulePlacement(200);});
setInterval(routeChanged,3000); // URL comparison only; does not fetch or traverse DOM.
window.postMessage({source:'mrd-ready-v1'},location.origin);
tryPlace();queueRender();
if(onDeckOverview())setTimeout(()=>refresh(false),1300); // One fallback request if Moxfield's own response was missed.
})();
