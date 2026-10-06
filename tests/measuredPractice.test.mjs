import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMeasuredPractice } from '../convex/lib/evaluation.js';
import { measureWords } from '../convex/lib/confidence.js';
import { formatScore } from '../convex/lib/rules.js';
const measurement=measureWords([{word:'um',start:0,end:.3},{word:'uh',start:2.5,end:2.8},{word:'maybe',start:2.8,end:3}],4);
const output={u:false,p:'12%',g:'Resolve 30 tickets',d:'Resolved 40 tickets',e:'Exceeded the target',v:{c:80,k:75,w:85},r:'I request a 12% raise after exceeding our ticket target.'};
test('local Confidence wins over model scores and builds the exact seven-line scorecard',async()=>{
 const calls=[];
 const result=await evaluateMeasuredPractice({transcribe:async()=>{calls.push('transcribe');return measurement;},reserveFeedback:async()=>{calls.push('reserve');return true;},evaluate:async()=>{calls.push('feedback');return JSON.stringify({...output,confidence:100,heard:'invented'});},reserveRetry:async()=>assert.fail('retry not needed')});
 assert.deepEqual(calls,['transcribe','reserve','feedback']);
 assert.equal(result.score.confidence,80);
 assert.equal(result.score.overall,80);
 const [card,rewrite]=formatScore(result.score,'audio',result.heard);
 assert.equal(card,'*Overall 80/100*\n💬 Clarity 80/100\n🔥 Confidence 80/100\n✨ Charisma 75/100\n❤️ Warmth 85/100\nHeard: 2 fillers, 1 long pause, 1 hedge\nscored from: audio');
 assert.equal(rewrite,'*Better version*\n'+output.r);
});
test('a failed transcription or quota reservation prevents feedback, never substitutes perfect Confidence',async()=>{
 let feedback=0;
 const options={evaluate:async()=>{feedback++;return JSON.stringify(output);},reserveRetry:async()=>false};
 await assert.rejects(evaluateMeasuredPractice({...options,transcribe:async()=>{throw new Error('invalid_transcription');},reserveFeedback:async()=>assert.fail('no reservation')}),/invalid_transcription/);
 await assert.rejects(evaluateMeasuredPractice({...options,transcribe:async()=>measurement,reserveFeedback:async()=>false}),/call_limit_reached/);
 assert.equal(feedback,0);
});
test('feedback retry reuses the same transcription and measurements',async()=>{
 let transcriptions=0,feedback=0,retries=0;
 const result=await evaluateMeasuredPractice({transcribe:async()=>{transcriptions++;return measurement;},reserveFeedback:async()=>true,evaluate:async()=>{feedback++;return feedback===1?'incomplete JSON':JSON.stringify(output);},reserveRetry:async()=>{retries++;return true;},report:()=>{}});
 assert.equal(transcriptions,1);assert.equal(feedback,2);assert.equal(retries,1);assert.equal(result.score.confidence,80);
});

test('missing or invalid AI feedback scores still reject despite successful Confidence measurement',async()=>{
 for (const v of [{c:null,k:75,w:85},{c:101,k:75,w:85},{c:'80',k:75,w:85}]) {
 await assert.rejects(evaluateMeasuredPractice({transcribe:async()=>measurement,reserveFeedback:async()=>true,evaluate:async()=>JSON.stringify({...output,v}),reserveRetry:async()=>true,report:()=>{}}),/invalid_scores/);
 }
});
