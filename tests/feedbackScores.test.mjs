import {checkedFeedback} from './fixtures/feedback.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMeasuredPractice} from '../convex/lib/evaluation.js';
import {formatScore,providerMessage} from '../convex/lib/rules.js';
import {parsePracticeResult} from '../convex/lib/facts.js';
const transcript="I'd like a 12% raise. Our goal was 30 tickets. I resolved 40 tickets, exceeding the goal.";
const output={u:false,p:'12%',g:'30 tickets',d:'40 tickets',e:'Exceeded goal',v:{c:Array.from({length:4},()=>({p:true,e:"I'd like a 12% raise"})),...checkedFeedback(80,90)},n:'Clear articulation.',r:transcript};
const measurement={transcript,confidence:100,heard:'Heard: 0 fillers, 0 long pauses, 0 hedges'};
const options={transcribe:async()=>measurement,reserveFeedback:async()=>true,report:()=>{}};
test('missing Persuasion and Warmth fail validation even before missing-fact questions',()=>{
 const {k,w,...v}=output.v;
 assert.throws(()=>parsePracticeResult(JSON.stringify({...output,g:'',v}),undefined,false,measurement),/invalid_scores/);
});
test('missing Persuasion and Warmth retry once then send the existing error without any zero scorecard',async()=>{
 const {k,w,...v}=output.v;let calls=0,retries=0;const messages=[];
 try {
 const result=await evaluateMeasuredPractice({...options,evaluate:async()=>{calls++;return JSON.stringify({...output,v});},reserveRetry:async()=>{retries++;return true;}});
 messages.push(...formatScore(result.score,'audio',result.heard));
 }catch(error){messages.push(providerMessage(error.message));}
 assert.equal(calls,2);assert.equal(retries,1);
 assert.deepEqual(messages,["Couldn't score that one. Please send it again."]);
 assert.ok(messages.every(message=>!message.includes('Persuasion 0/100')&&!message.includes('Warmth 0/100')));
});
test('a valid retry displays actual Persuasion and Warmth rather than default zeroes',async()=>{
 const {k,w,...v}=output.v;let calls=0;
 const result=await evaluateMeasuredPractice({...options,evaluate:async()=>JSON.stringify(++calls===1?{...output,v}:output),reserveRetry:async()=>true});
 const [card]=formatScore(result.score,'audio',result.heard);
 assert.equal(calls,2);assert.match(card,/Persuasion 75\/100/);assert.match(card,/Warmth 100\/100/);
 assert.doesNotMatch(card,/(?:Persuasion|Warmth) 0\/100/);
});
test('invalid Persuasion or Warmth rejects before facts and at the scorecard boundary',()=>{
 for(const field of ['k','w'])for(const value of [undefined,null,'80',-1,101,NaN,Infinity]){
 const v={...output.v,[field]:value};
 assert.throws(()=>parsePracticeResult(JSON.stringify({...output,g:'',v}),undefined,false,measurement),/invalid_scores/);
 assert.throws(()=>formatScore({clarity:100,confidence:100,persuasion:80,warmth:90,overall:93,rewrite:transcript,[field==='k'?'persuasion':'warmth']:value},'audio'),/invalid_scores/);
 }
});

test('compact-response score rejections report both raw AI values locally on each attempt',async()=>{
 const rejected=[];
 const {formatScoringDiagnostic}=await import('../convex/lib/scoringDiagnostic.js');
 await assert.rejects(evaluateMeasuredPractice({...options,evaluate:async()=>JSON.stringify({...output,g:'',v:{...output.v,k:'80',w:null}}),reserveRetry:async()=>true,onFeedbackScoresRejected:scores=>rejected.push(scores)}),/invalid_scores/);
 assert.deepEqual(rejected,[{persuasion:'80',warmth:null},{persuasion:'80',warmth:null}]);
 const block=formatScoringDiagnostic({words:[],feedbackScoreRejections:rejected});
 assert.deepEqual(JSON.parse(block.split('\n').slice(1,-1).join('\n')).feedbackScoreRejections,rejected);
});
test('missing score diagnostics mark both omissions instead of inventing zeroes',async()=>{
 const {formatScoringDiagnostic}=await import('../convex/lib/scoringDiagnostic.js');
 const {k,w,...v}=output.v;const rejected=[];
 await assert.rejects(evaluateMeasuredPractice({...options,evaluate:async()=>JSON.stringify({...output,v}),reserveRetry:async()=>true,onFeedbackScoresRejected:scores=>rejected.push(scores)}),/invalid_scores/);
 const block=formatScoringDiagnostic({words:[],feedbackScoreRejections:rejected});
 assert.deepEqual(JSON.parse(block.split('\n').slice(1,-1).join('\n')).feedbackScoreRejections,[{persuasion:'[MISSING]',warmth:'[MISSING]'},{persuasion:'[MISSING]',warmth:'[MISSING]'}]);
});
test('rejected score diagnostics never print URLs, keys, tokens or nested data',async()=>{
 const {formatScoringDiagnostic}=await import('../convex/lib/scoringDiagnostic.js');
 const block=formatScoringDiagnostic({words:[],feedbackScoreRejections:[{persuasion:'https://media.invalid/?token=synthetic-private-token',warmth:{key:'sk-synthetic-key',url:'https://private.invalid'}}]});
 for(const forbidden of ['https://','synthetic-private-token','sk-synthetic-key','private.invalid'])assert.ok(!block.includes(forbidden));
 assert.deepEqual(JSON.parse(block.split('\n').slice(1,-1).join('\n')).feedbackScoreRejections,[{persuasion:'[REDACTED NON-SCORE]',warmth:'[INVALID TYPE]'}]);
});
