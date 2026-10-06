import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyFacts, parsePracticeResult } from '../convex/lib/facts.js';
const observations={f:0,p:0,h:0,e:'level',a:true,u:0,r:0,s:1,l:true,m:0,t:0,c:0,x:0};
const answer={u:false,p:'12%',g:'Several goals',d:'Completed all the required work',e:'Met expectations',o:observations,r:'A synthetic raise request.'};
test('generic goals and outcomes cannot unlock scoring even with valid scores and rewrite',()=>{
 const first=parsePracticeResult(JSON.stringify(answer),undefined,true);
 assert.equal(first.question,'What specific goal had we agreed on?');
 assert.equal(first.score,null);
 assert.equal(first.facts.agreedGoals,'');
 assert.equal(first.facts.deliveredOutcome,'');
 const second=parsePracticeResult(JSON.stringify({...answer,p:'',g:'A number of targets',d:''}),first.facts,true);
 assert.equal(second.question,'What specific goal had we agreed on?');
 assert.equal(second.score,null);
});
test('specific goals lead to the missing outcome before any score',()=>{
 const result=parsePracticeResult(JSON.stringify({...answer,g:'Resolve 30 support tickets weekly'}),undefined,true);
 assert.equal(result.question,'What specific outcome did you deliver?');
 assert.equal(result.score,null);
});
test('vague stored context is rechecked, while concrete prior facts survive vague new values',()=>{
 const prior={payRequest:'12%',agreedGoals:'Several goals',deliveredOutcome:'Completed what was discussed',expectations:'Met expectations'};
 const result=parsePracticeResult(JSON.stringify({...answer,p:'',g:'',d:'',e:''}),prior,true);
 assert.equal(result.score,null);
 assert.equal(result.facts.agreedGoals,'');
 const concrete={...prior,agreedGoals:'Resolve 30 support tickets weekly',deliveredOutcome:'Resolved 40 tickets weekly'};
 const good=parsePracticeResult(JSON.stringify(answer),concrete,true);
 assert.equal(good.question,null);
 assert.equal(good.facts.agreedGoals,concrete.agreedGoals);
 assert.equal(good.facts.deliveredOutcome,concrete.deliveredOutcome);
});
test('explicit uncertainty and never-agreed goals remain valid user facts',()=>{
 for(const g of ['No goals were agreed','I do not know','I don’t know']){
 const result=parsePracticeResult(JSON.stringify({...answer,g,d:'Resolved 40 support tickets',e:'No agreed benchmark'}),undefined,true);
 assert.equal(result.question,null);
 assert.notEqual(result.score,null);
 }
 const result=parsePracticeResult(JSON.stringify({...answer,g:'Resolve 30 tickets',d:'Resolved 40 tickets',e:''}),emptyFacts(),true);
 assert.equal(result.question,'Did that outcome exceed, meet or fall short of what we agreed?');
 assert.equal(result.score,null);
});
