const assert=require('node:assert/strict');require('../rules.js');require('../edhrec-data.js');require('../card-search.js');
const R=global.MoxRules,C=global.MoxCardSearch;
// Independent interpreter for the native phrase/boolean subset, not local regex.
function matchesQuery(query,card){
 const tokens=query.match(/-?(?:o|t|name):"(?:\\.|[^"\\])*"|\(|\)|\bor\b|-|[^\s()]+/g)||[];let index=0;
 function atom(){
  const token=tokens[index++];
  if(token==='-')return !atom();
  if(token==='('){const value=or();assert.equal(tokens[index++],')');return value;}
  const field=token?.match(/^(-?)(o|t|name):(".*")$/);
  if(field){const text={o:card.oracle,t:card.type,name:card.name}[field[2]]||'',match=text.toLowerCase().includes(JSON.parse(field[3]).toLowerCase());return field[1]?!match:match;}
  assert(/^(?:f:|id<=|sort:|dir:)/.test(token),'Unexpected native token: '+token);return true;
 }
 function and(){let value=true;while(index<tokens.length&&!['or',')'].includes(tokens[index])){const next=atom();value=next&&value;}return value;}
 function or(){let value=and();while(tokens[index]==='or'){index++;const next=and();value=next||value;}return value;}
 const result=or();assert.equal(index,tokens.length);return result;
}
const wipe=R.requirementSearch(R.asRule('wipes'));
assert(wipe.approximate);assert(!wipe.query.includes('o:/'));
for(const oracle of ['Destroy all creatures.','Exile all nonland permanents.','Blasphemous Act deals 13 damage to each creature.','All creatures get -X/-X until end of turn.'])assert(matchesQuery(wipe.query,{oracle}),oracle);
for(const oracle of ['{T}: Add {C}{C}.','{T}: Add one mana of any color in your commander\'s color identity.','Destroy target creature.'])assert(!matchesQuery(wipe.query,{oracle}),oracle);
const ramp=R.requirementSearch(R.asRule('ramp'));
assert(matchesQuery(ramp.query,{oracle:'{T}: Add {C}{C}.',type:'Artifact'}));
assert(!matchesQuery(ramp.query,{oracle:'{T}: Add {G}.',type:'Basic Land — Forest'}));
const custom={id:'custom-wipe',name:'Small sweepers',logic:'all',criteria:[{field:'oracle',op:'contains',value:'destroy all'},{field:'manaValue',op:'lte',value:'3'}]};
const rows=[{name:'Small wipe',oracle:'Destroy all creatures.',manaValue:3,detailsLoaded:true},{name:'Large wipe',oracle:'Destroy all creatures.',manaValue:6,detailsLoaded:true},{name:'Sol Ring',oracle:'{T}: Add {C}{C}.',manaValue:1,detailsLoaded:true}];
assert.deepEqual(C.filter(rows,{role:'deck:custom-wipe',rule:custom}).map(card=>card.name),['Small wipe']);
assert.equal(C.filter([{...rows[0],detailsLoaded:false}],{rule:custom}).length,0);
assert(R.requirementSearch({criteria:[{field:'oracle',op:'regex',value:'destroy.*creature'}]}).error);
const fs=require('node:fs'),vm=require('node:vm'),explorerSource=fs.readFileSync(require.resolve('../edhrec.js'),'utf8');
const toggle={deck:{},role:{value:'deck:wipes'},pageSize:20,limit:80,requirementRun:7,searchExhausted:true,searchTimer:null,clearTimeout(){},detailStatus:{textContent:''},render(){},loadRequirementResults(){throw Error('Clearing a role must not start another search');}};
vm.createContext(toggle);vm.runInContext(explorerSource.slice(explorerSource.indexOf(' deck._onRequirementSearch='),explorerSource.indexOf(' for(const control of [categories,exclude,type,role,tag,color,minMana,maxMana,maxPrice]')),toggle);
toggle.deck._onRequirementSearch({id:'wipes'});assert.equal(toggle.role.value,'');assert.equal(toggle.pageSize,48);assert.equal(toggle.limit,48);assert.equal(toggle.requirementRun,8,'Cancel pending role results on deselection');assert.equal(toggle.searchExhausted,false);assert.equal(toggle.detailStatus.textContent,'Requirement filter cleared.');
console.log('PASS: native wipe clauses exclude mana rocks and targeted removal, ramp keeps land exclusion, and custom deck requirements filter Explorer candidates.');
