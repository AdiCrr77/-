import {checkedFeedback} from './fixtures/feedback.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {expandResult} from '../convex/lib/resultWire.js';
import {formatScoringDiagnostic} from '../convex/lib/scoringDiagnostic.js';
import {evaluateMeasuredPractice} from '../convex/lib/evaluation.js';
const transcript="I'd like a 12% raise. Our goal was 30 tickets. I resolved 40 tickets, exceeding the goal.";
const c=[{p:true,e:"I'd like a 12% raise"},{p:true,e:'I resolved 40 tickets'},{p:true,e:'12% raise'},{p:true,e:'exceeding the goal'}];
const output={u:false,p:'12%',g:'30 tickets',d:'40 tickets',e:'Exceeded goal',v:{c,...checkedFeedback(80,90,"I'd like a 12% raise")},n:'Clear delivery.',r:"I'd like a 12% raise. Our goal was 30 tickets. I resolved 40 tickets, exceeding the goal."};
test('Clarity passes require an exact transcript quote; invented words fail',()=>{
 const result=expandResult({...output,v:{...output.v,c:c.map((check,i)=>i===1?{p:true,e:'I resolved 400 tickets'}:check)}},[transcript]);
 assert.equal(result.clarity,75);
 assert.equal(result.clarityChecks[1].pass,false);
 assert.equal(result.clarityChecks[1].quoteFound,false);
 assert.equal(result.clarityChecks[1].aiPass,true);
});
test('quote matching cannot use supplied session facts or stitch across notes',()=>{
 for(const quotes of [[],['12% raise']]) assert.ok(expandResult(output,quotes).clarity<100);
 const result=expandResult({...output,v:{...output.v,c:[...c.slice(0,3),{p:true,e:'end start'}]}},[transcript,'end','start']);
 assert.equal(result.clarity,75);
});
test('AI fails remain failures even when their quotes exist; all four checks print locally',()=>{
 const result=expandResult({...output,v:{...output.v,c:c.map((check,i)=>i===3?{...check,p:false}:check)}},[transcript]);
 assert.equal(result.clarity,75);
 const block=formatScoringDiagnostic({words:[],clarityChecks:result.clarityChecks});
 assert.deepEqual(JSON.parse(block.split('\n').slice(1,-1).join('\n')).clarityChecks,result.clarityChecks);
 assert.equal(result.clarityChecks.length,4);
});
test('the measured scoring path validates earlier round quotes against all accepted notes',async()=>{
 const result=await evaluateMeasuredPractice({transcribe:async()=>({transcript:'Latest clarification.',confidence:100,heard:'Heard: 0 fillers, 0 long pauses, 0 hedges'}),recordTranscript:async()=>({accepted:true,notes:[{transcript,fillers:0,longPauses:0,hedges:0},{transcript:'Latest clarification.',fillers:0,longPauses:0,hedges:0}],askedFacts:[]}),reserveFeedback:async()=>true,reserveRetry:async()=>assert.fail('no retry'),evaluate:async()=>JSON.stringify(output)});
 assert.equal(result.score.clarity,100);
 assert.equal(result.clarityChecks.every(check=>check.quoteFound),true);
 assert.ok(!JSON.stringify(result.score).includes('quoteFound'));
});

test('empty evidence cannot prove a pass',()=>{
 const result=expandResult({...output,v:{...output.v,c:c.map((check,i)=>i===0?{p:true,e:''}:check)}},[transcript]);
 assert.equal(result.clarity,75);
 assert.equal(result.clarityChecks[0].quoteFound,false);
});

test('a long quote is checked against the transcript without rejecting the entire result',()=>{
 const quote='A synthetic exact phrase '.repeat(10).trim();
 const c=Array.from({length:4},(_,index)=>({p:true,e:index===3?quote:'a 12% raise'}));
 const matched=expandResult({...output,v:{...output.v,c}},[transcript,quote]);
 assert.equal(matched.clarity,100);
 const missing=expandResult({...output,v:{...output.v,c}},[transcript]);
 assert.equal(missing.clarity,75);
 assert.equal(missing.clarityChecks[3].pass,false);
});

test('missing or invalid quotes fail their own check without rejecting the other checks',()=>{
 for(const e of [undefined,null,123,{},'']) {
 const result=expandResult({...output,v:{...output.v,c:c.map((check,i)=>i===1?{p:true,e}:check)}},[transcript]);
 assert.equal(result.clarity,75);
 assert.equal(result.clarityChecks[1].quoteFound,false);
 assert.equal(result.clarityChecks.filter(check=>check.pass).length,3);
 }
});

test('Clarity quotes ignore punctuation, capitals and extra spaces without changing words',()=>{
 const quote="I'D   LIKE A 12% RAISE!";
 const result=expandResult({...output,v:{...output.v,c:c.map((check,i)=>i===0?{p:true,e:quote}:check)}},[transcript]);
 assert.equal(result.clarity,100);
 assert.equal(result.clarityChecks[0].quoteFound,true);
 assert.equal(result.clarityChecks[0].quote,quote);
});
test('check 3 fails only for a distinct second request quoted in the transcript',()=>{
 const opening="I'd like a 12% raise.";
 for(const [second,quote] of [
  ["I'd also like a bonus.","I'd also like a bonus."],
  ['I also request a promotion.','a promotion'],
  ["I'm also asking for a 15% raise.",'a 15% raise'],
  ['And two extra days off.','two extra days off'],
 ]) {
 const text=opening+' '+second;
 const checks=c.map((check,i)=>i===2?{p:false,e:quote}:{p:true,e:opening});
 const result=expandResult({...output,v:{...output.v,c:checks}},[text]);
 assert.equal(result.clarity,75,second);
 assert.equal(result.clarityChecks[2].pass,false,second);
 }
});
test('check 3 overrides failures quoting no request, the first ask, or a repeat of the same ask',()=>{
 const opening="I'd like a 12% raise.";
 for(const [text,quote] of [
  [transcript,'exceeding the goal'],
  [transcript,"I'd like a 12% raise"],
  [opening+" I am asking for a 12% raise.",'I am asking for a 12% raise'],
  [opening+' Our bonus target was met.','Our bonus target was met.'],
  [opening+" Our bonus target was met. I'd also like a bonus.",'Our bonus target was met.'],
  [opening+' I delivered a promotion campaign.','a promotion'],
  [opening+" I'd also like a bonus.","I'd also like extra time off"],
 ]) {
 const checks=c.map((check,i)=>i===2?{p:false,e:quote}:{p:true,e:opening});
 const result=expandResult({...output,v:{...output.v,c:checks}},[text]);
 assert.equal(result.clarity,100,quote);
 assert.equal(result.clarityChecks[2].pass,true,quote);
 }
});
