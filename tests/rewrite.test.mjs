import {checkedFeedback} from './fixtures/feedback.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseScore,formatScore,providerMessage} from '../convex/lib/rules.js';
import {evaluateMeasuredPractice} from '../convex/lib/evaluation.js';
import {INSTRUCTIONS} from '../convex/lib/realtime.js';
import {formatScoringDiagnostic} from '../convex/lib/scoringDiagnostic.js';
const spoken="I'm asking for a 20% raise. We agreed on 30 tickets, and I resolved 40, exceeding that goal.";
const score={clarity:75,confidence:100,persuasion:80,warmth:90,rewrite:spoken};
const output={u:false,p:'20%',g:'Resolve 30 tickets',d:'Resolved 40 tickets',e:'Exceeded target',v:{c:Array.from({length:4},()=>({p:true,e:'synthetic evidence'})),...checkedFeedback(80,90)},r:spoken};
const measurement={confidence:100,heard:'Heard: 0 fillers, 0 long pauses, 0 hedges'};
const raw='payRequest=20% raise; agreedGoals=30 tickets; deliveredOutcome=40 tickets; expectations=exceeded';
const options={transcribe:async()=>measurement,reserveFeedback:async()=>true,report:()=>{}};
test('Better version never contains equals signs or internal field names',()=>{
 for(const rewrite of [raw,'I request x=y.','payRequest: 20%', 'agreedGoals','deliveredOutcome','expectations']) {
 assert.throws(()=>parseScore(JSON.stringify({...score,rewrite})),/invalid_rewrite/);
 assert.throws(()=>formatScore({...score,rewrite},'audio'),/invalid_rewrite/);
 }
 const message=formatScore(parseScore(JSON.stringify(score)),'audio')[1];
 assert.doesNotMatch(message,/=|payRequest|agreedGoals|deliveredOutcome|expectations/i);
 assert.equal(message,'*Better version*\n'+spoken);
});
test('rejected rewrite retries once and returns the spoken rewrite with a local rejection reason',async()=>{
 let calls=0,reservations=0;const reasons=[];
 const result=await evaluateMeasuredPractice({...options,evaluate:async()=>JSON.stringify({...output,r:++calls===1?raw:spoken}),reserveRetry:async()=>{reservations++;return true;},onRewriteRejected:reason=>reasons.push(reason)});
 assert.equal(calls,2);assert.equal(reservations,1);assert.equal(result.score.rewrite,spoken);
 assert.deepEqual(reasons,['invalid_rewrite_fields']);
 const block=formatScoringDiagnostic({words:[],rewriteRejections:reasons});
 assert.deepEqual(JSON.parse(block.split('\n').slice(1,-1).join('\n')).rewriteRejections,reasons);
});
test('missing, empty or invalid rewrites retry at most once and return the exact error',async()=>{
 for(const r of [undefined,'',raw,'*bad*',Array(60).fill('word').join(' '),'I leverage our results.']) {
 let calls=0;const reasons=[];
 await assert.rejects(evaluateMeasuredPractice({...options,evaluate:async()=>{calls++;return JSON.stringify({...output,r});},reserveRetry:async()=>true,onRewriteRejected:reason=>reasons.push(reason)}),error=>{
 assert.equal(providerMessage(error.message),"Couldn't write a better version this time, please send it again.");return true;
 });
 assert.equal(calls,2);assert.equal(reasons.length,2);
 }
});
test('rewrite retry cannot bypass the shared call cap',async()=>{
 let calls=0;
 await assert.rejects(evaluateMeasuredPractice({...options,evaluate:async()=>{calls++;return JSON.stringify({...output,r:raw});},reserveRetry:async()=>false}),error=>{
 assert.equal(providerMessage(error.message),"Couldn't write a better version this time, please send it again.");return true;
 });
 assert.equal(calls,1);
});

test('Could we revisit the 20% raise? is rejected',()=>{
 assert.throws(()=>parseScore(JSON.stringify({...score,rewrite:'Could we revisit the 20% raise?'})),/invalid_rewrite/);
});
test("I'd like a 20% raise. passes",()=>{
 const rewrite="I'd like a 20% raise.";
 assert.equal(parseScore(JSON.stringify({...score,rewrite})).rewrite,rewrite);
});
test('first-sentence questions and every listed phrase are rejected case-insensitively',()=>{
 for(const rewrite of ['Will you approve a 20% raise?','A 20% raise?',...['could we','can we','would it be possible','I was wondering','revisit','maybe','just','I think','hoping'].map(phrase=>`I'd like a 20% raise ${phrase.toUpperCase()}.`)]) {
 assert.throws(()=>parseScore(JSON.stringify({...score,rewrite})),/invalid_rewrite/);
 }
 // A decimal in the amount must not hide the rest of the first sentence.
 assert.throws(()=>parseScore(JSON.stringify({...score,rewrite:"I'd like a 20.5% raise, maybe."})),/invalid_rewrite/);
 assert.equal(parseScore(JSON.stringify({...score,rewrite:"I'd like a 20.5% raise."})).rewrite,"I'd like a 20.5% raise.");
 assert.equal(parseScore(JSON.stringify({...score,rewrite:"I'd like a 20% raise. We adjusted the target."})).rewrite,"I'd like a 20% raise. We adjusted the target.");
});
test('the same sentence or clause cannot repeat with different punctuation or casing',()=>{
 for(const rewrite of ["I'd like a 20% raise. I delivered 40 tickets. I delivered 40 tickets!","I'd like a 20% raise; i'd LIKE a 20% raise."]) {
 assert.throws(()=>parseScore(JSON.stringify({...score,rewrite})),/invalid_rewrite/);
 }
});
test('question rejection uses the existing single retry and error message',async()=>{
 let calls=0,reservations=0;const reasons=[];
 await assert.rejects(evaluateMeasuredPractice({...options,evaluate:async()=>{calls++;return JSON.stringify({...output,r:'Could we revisit the 20% raise?'});},reserveRetry:async()=>{reservations++;return true;},onRewriteRejected:reason=>reasons.push(reason)}),error=>{
 assert.equal(providerMessage(error.message),"Couldn't write a better version this time, please send it again.");return true;
 });
 assert.equal(calls,2);assert.equal(reservations,1);
 assert.equal(reasons.length,2);
});

test('better-version prompt requires a direct opening and no repeated meaning',()=>{
 assert.ok(INSTRUCTIONS.includes("The first sentence must state the user's ask directly as a statement"));
 assert.ok(INSTRUCTIONS.includes('Do not repeat the same point twice, even using different words'));
 for(const phrase of ['could we','can we','would it be possible','I was wondering','revisit','maybe','just','I think','hoping']) assert.ok(INSTRUCTIONS.includes(`"${phrase}"`));
});

test('rewrite rejects entitlement while retaining a plain shortfall and direct ask',()=>{
 for(const phrase of ['I deserve this.','The raise is owed to me.','I expect the raise.']) assert.throws(()=>parseScore(JSON.stringify({...score,rewrite:"I'd like a 12% raise. "+phrase})),/invalid_rewrite/);
 const rewrite="I'd like a 12% raise based on delivering 6,000 subscribers. Our shared goal was 9,000, so I fell short of the target. Thank you for considering it. I know the decision is yours. What's your view?";
 assert.equal(parseScore(JSON.stringify({...score,rewrite})).rewrite,rewrite);
});

test('rewrite rejects because or thats why immediately after a shortfall sentence',()=>{
 for(const aside of ['I fell short of the target.','We missed our target.','We are falling short.','I am missing the target.']) {
  for(const link of ["That's why I'm asking for the raise.","I am asking because of that."]) {
   assert.throws(()=>parseScore(JSON.stringify({...score,rewrite:"I'd like a 12% raise. "+aside+' '+link})),error=>error.message==='invalid_rewrite'&&error.diagnosticCode==='invalid_rewrite_shortfall_link');
  }
 }
 const rewrite="I'd like a 12% raise based on delivering 6,000 subscribers. Our goal was 9,000. I fell short of the target, but we're still on the right track. Thank you for considering it. I know the decision is yours. What's your view?";
 assert.equal(parseScore(JSON.stringify({...score,rewrite})).rewrite,rewrite);
});

test('a rejected shortfall link uses the existing single rewrite retry',async()=>{
 let calls=0;const reasons=[];
 const result=await evaluateMeasuredPractice({...options,evaluate:async()=>JSON.stringify({...output,r:++calls===1?"I'd like a 12% raise. I fell short of the target. That's why I'm asking.":spoken}),reserveRetry:async()=>true,onRewriteRejected:reason=>reasons.push(reason)});
 assert.equal(calls,2);assert.deepEqual(reasons,['invalid_rewrite_shortfall_link']);assert.equal(result.score.rewrite,spoken);
});

test('bracketed fill-ins do not count toward the spoken rewrite word limit',()=>{
 const spoken="I'd like a 12% raise based on my delivery. "+Array(45).fill('evidence').join(' ')+'.';
 const brackets=' [Say what the delivered outcome meant for the business.] [Name a fair benchmark, such as your pay band or new responsibilities.]';
 assert.ok((spoken+brackets).split(/\s+/).length>=60);
 assert.doesNotThrow(()=>parseScore(JSON.stringify({...score,rewrite:spoken+brackets})));
 assert.throws(()=>parseScore(JSON.stringify({...score,rewrite:spoken+' '+Array(10).fill('evidence').join(' ')+brackets})),/invalid_rewrite/);
});
