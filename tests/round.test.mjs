import test from 'node:test';
import assert from 'node:assert/strict';
import {measureRound} from '../convex/lib/round.js';
import {measureWords} from '../convex/lib/confidence.js';
import {parsePracticeResult,emptyFacts,FACT_QUESTIONS} from '../convex/lib/facts.js';
const measured=()=>measureWords([{word:'Hello',start:3,end:3.5}],10);
const output={u:false,p:'12%',g:'Resolve 30 tickets',d:'',e:'Exceeded the target',v:{c:80,k:75,w:85},n:'Clear articulation; respectful tone.',r:'I am requesting a 12% raise.'};
test('round Confidence sums counts from every note without pauses across note boundaries',()=>{
 const a=measureWords([{word:'Um',start:0,end:.3},{word:'maybe',start:2.5,end:3}],10);
 const b=measureWords([{word:'uh',start:8,end:8.5}],90);
 const total=measureRound([a,b]);
 assert.equal(total.confidence,80);assert.equal(total.longPauses,1);
 assert.equal(total.heard,'Heard: 2 fillers, 1 long pause, 1 hedge');
});
test('a fact is asked only once and missing answered facts get visible gaps',()=>{
 const first=parsePracticeResult(JSON.stringify(output),emptyFacts(),false,measured(),{askedFacts:[]});
 assert.equal(first.askedFact,'deliveredOutcome');assert.equal(first.question,FACT_QUESTIONS.deliveredOutcome);
 const second=parsePracticeResult(JSON.stringify(output),first.facts,false,measured(),{askedFacts:['deliveredOutcome']});
 assert.equal(second.question,null);assert.equal(second.score.confidence,100);
 assert.ok(second.score.rewrite.includes('[add your outcome here]'));
 assert.equal(second.facts.deliveredOutcome,'');
});
test('already supplied facts skip their questions; unresolved facts each receive only one question',()=>{
 let asked=[],facts=emptyFacts();
 for(const name of ['payRequest','agreedGoals','deliveredOutcome','expectations']) {
 const result=parsePracticeResult(JSON.stringify({...output,p:'',g:'',d:'',e:'',r:''}),facts,false,measured(),{askedFacts:asked});
 assert.equal(result.askedFact,name);asked.push(name);facts=result.facts;
 }
 const final=parsePracticeResult(JSON.stringify({...output,p:'',g:'',d:'',e:''}),facts,false,measured(),{askedFacts:asked});
 assert.equal(final.question,null);assert.ok(final.score.rewrite.includes('[add your outcome here]'));
 assert.ok(final.score.rewrite.includes('[add your agreed goal here]'));
});
