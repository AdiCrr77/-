import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreFeedbackChecks} from '../convex/lib/feedbackChecks.js';
import {checkedFeedback} from './fixtures/feedback.mjs';
const transcript="Thanks for your help. We reached our goal. I understand the budget limits. What do you think? I understand. The company reached the target. If possible. Let me know.";
const warm=entries=>Object.fromEntries(entries.map(([level,quote],index)=>['W'+(index+1),{level,quote}]));
const score=w=>scoreFeedbackChecks({...checkedFeedback(0,0),w},[transcript]);
test('Warmth all clear equals 100',()=>{
 assert.equal(score(warm([['clear','Thanks for your help'],['clear','We reached our goal'],['clear','I understand the budget limits'],['clear','What do you think']])).warmth,100);
});
test('Warmth all missing equals 0',()=>{
 assert.equal(score(warm(Array(4).fill(['missing','MISSING']))).warmth,0);
});
test('Warmth two partial plus one clear equals 50',()=>{
 const result=score(warm([['partial','I understand'],['clear','We reached our goal'],['partial','If possible'],['missing','MISSING']]));
 assert.equal(result.warmth,50);assert.deepEqual(result.warmthChecks.map(c=>c.points),[12.5,25,12.5,0]);
});
test('Warmth partial without a verified quote equals 0',()=>{
 for(const quote of ['',undefined,'Invented words','MISSING']){
  const result=score(warm([['partial',quote],...Array(3).fill(['missing','MISSING'])]));
  assert.equal(result.warmth,0);assert.equal(result.warmthChecks[0].level,'missing');
 }
});
test('Warmth rounds a verified partial to 13 and insult cap overrides all points',()=>{
 const w=warm([['partial','I understand'],...Array(3).fill(['missing','MISSING'])]);
 assert.equal(score(w).warmth,13);
 const result=scoreFeedbackChecks({...checkedFeedback(0,0),w,i:"You're an idiot"},[transcript+" You're an idiot."]);
 assert.equal(result.warmth,0);assert.ok(result.warmthChecks.every(c=>c.level==='missing'&&c.points===0));
});
test('Warmth level schema changes preserve the existing rewrite pass projection',async()=>{
 const {scoreText}=await import('../convex/lib/textScoring.js');
 const raw={r:"I'd like a raise. I delivered a guide.",v:{...checkedFeedback(100,100),w:warm([['partial','I understand'],['clear','We reached our goal'],['missing','MISSING'],['missing','MISSING']])}};
 const output=await scoreText('fake-test-key',{}, {fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(raw)}]}]})})});
 const rewrite=JSON.parse(output).r;
 assert.ok(rewrite.includes('I appreciate you hearing me out.'));assert.ok(rewrite.includes('I know the decision is yours.'));assert.ok(rewrite.includes("What's your view?"));
});
