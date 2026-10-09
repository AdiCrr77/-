import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreObservations } from '../convex/lib/rubric.js';
import { parsePracticeResult } from '../convex/lib/facts.js';
import { formatScore } from '../convex/lib/rules.js';
const observations = {fillers:3,longPauses:1,hedges:2,askEnding:'dropped',earlyAsk:true,unclearPhrases:0,restarts:1,supportingFacts:3,linkedAsk:true,emphasizedPoints:2,respectfulPhrases:1,collaborativePhrases:1,hostilePhrases:0};
test('fixed audio observations give repeatable scores and exact deductions', () => {
 const expected = {confidence:84,clarity:95,persuasion:98,warmth:90};
 for(let i=0;i<3;i++) assert.deepEqual(scoreObservations(observations).scores,expected);
 assert.equal(scoreObservations({...observations,askEnding:'rose'}).scores.confidence,79);
 assert.equal(scoreObservations({...observations,fillers:200}).scores.confidence,0);
 assert.equal(scoreObservations({...observations,hostilePhrases:200}).scores.warmth,0);
});
test('invalid or missing observations reject instead of accepting model scores', () => {
 for(const o of [null,{}, {...observations,fillers:1.5},{...observations,hedges:-1},{...observations,earlyAsk:'yes'},{...observations,askEnding:'guessed'}]) assert.throws(()=>scoreObservations(o),/invalid_scores/);
 const payload={payRequest:'10%',agreedGoals:'sales goal',deliveredOutcome:'met goal',expectations:'met',rewrite:'I am asking for a 10% raise.',confidence:99,clarity:99,persuasion:99,warmth:99};
 assert.throws(()=>parsePracticeResult(JSON.stringify(payload),undefined,true),/invalid_scores/);
 const result=parsePracticeResult(JSON.stringify({...payload,observations}),undefined,true);
 assert.equal(result.score.confidence,84);
 assert.equal(result.score.overall,92);
 const [card,rewrite]=formatScore(result.score,'audio',result.heard);
 assert.equal(card.split('\n').length,7);
 assert.ok(card.split('\n')[5].startsWith('Heard: 3 fillers, 1 long pauses, 2 hedges, ask ending dropped'));
 assert.equal(card.split('\n')[6],'scored from: audio');
 assert.equal(rewrite,'*Better version*\nI am asking for a 10% raise.');
});

test('compact provider output preserves scores, facts, Heard line and rewrite exactly', () => {
 const facts={payRequest:'10%',agreedGoals:'sales goal',deliveredOutcome:'met goal',expectations:'met'};
 const rewrite='I am asking for a 10% raise because I met our agreed sales goal.';
 const full=parsePracticeResult(JSON.stringify({...facts,observations,rewrite}),undefined,true);
 const compact={u:false,p:facts.payRequest,g:facts.agreedGoals,d:facts.deliveredOutcome,e:facts.expectations,o:{f:3,p:1,h:2,e:'dropped',a:true,u:0,r:1,s:3,l:true,m:2,t:1,c:1,x:0},r:rewrite};
 assert.deepEqual(parsePracticeResult(JSON.stringify(compact),undefined,true),full);
 assert.ok(JSON.stringify(compact).length < JSON.stringify({...facts,observations,rewrite}).length);
 assert.throws(()=>parsePracticeResult(JSON.stringify({...compact,o:{...compact.o,f:undefined}}),undefined,true),/invalid_scores/);
 const missing=parsePracticeResult(JSON.stringify({...compact,g:''}),undefined,true);
 assert.equal(missing.question,'What specific goal had we agreed on?');
 assert.deepEqual(parsePracticeResult(JSON.stringify({...compact,p:'',g:'',d:'',e:''}),facts,true),full);
 assert.throws(()=>parsePracticeResult(JSON.stringify({u:true}),undefined,true),/unreadable/);
});
