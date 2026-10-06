import test from 'node:test';
import assert from 'node:assert/strict';
import { transcribeAudio } from '../convex/lib/transcription.js';
import { reportRejectedTranscription, transcriptionRejection } from '../convex/lib/transcriptionDiagnostics.js';
const request=words=>async()=>({ok:true,json:async()=>({words,text:'excluded transcript',audio:'excluded audio',key:'synthetic-secret'})});
test('rejected transcription logs the exact word projection and failing rule',async()=>{
 const words=[{word:'Hello',start:3,end:4.2}];
 const logs=[];
 await assert.rejects(transcribeAudio('synthetic-secret',new Uint8Array(48000*4),request(words),line=>logs.push(line)),error=>error.message==='invalid_transcription'&&error.transcriptionRule==='end_within_duration');
 assert.deepEqual(logs,['practice_transcription_rejected {"rule":"end_within_duration","condition":"end must be at most decoded duration + 0.05 seconds","wordIndex":0,"duration":4,"words":[{"word":"Hello","start":3,"end":4.2}]}']);
});
test('timestamp diagnostics distinguish missing fields, order and punctuation without changing acceptance',async()=>{
 for (const [words,rule] of [[undefined,'words_array'],[[{word:'a',start:'3',end:4}],'start_finite'],[[{word:'a',start:2,end:3},{word:'b',start:1,end:2}],'start_order'],[[{word:'.',start:0,end:.1}],'word_tokens']]) {
 const logs=[];
 await assert.rejects(transcribeAudio('synthetic',new Uint8Array(48000*5),request(words),line=>logs.push(line)),error=>error.transcriptionRule===rule);
 assert.equal(logs.length,1);assert.equal(JSON.parse(logs[0].slice('practice_transcription_rejected '.length)).rule,rule);
 }
 const logs=[];
 await assert.rejects(transcribeAudio('synthetic',new Uint8Array(48000),request([]),line=>logs.push(line)),/unreadable/);
 assert.equal(JSON.parse(logs[0].slice('practice_transcription_rejected '.length)).rule,'words_nonempty');
});
test('valid three-second leading silence and trailing silence remain accepted with no logs',async()=>{
 const logs=[];
 const result=await transcribeAudio('synthetic',new Uint8Array(48000*8),request([{word:'Hello',start:3,end:4}]),line=>logs.push(line));
 assert.equal(result.confidence,100);assert.equal(result.longPauses,0);assert.deepEqual(logs,[]);
});
test('diagnostics exclude non-word fields and redact credentials and binary strings even in malformed entries',()=>{
 const logs=[];
 reportRejectedTranscription([{word:'synthetic-secret',start:'sk-synthetic-key',end:{audio:'private-audio'},audio:'private-audio',key:'synthetic-secret'}],transcriptionRejection('start_finite',0),4,['synthetic-secret'],line=>logs.push(line));
 assert.ok(!logs[0].includes('synthetic-secret'));assert.ok(!logs[0].includes('sk-synthetic-key'));assert.ok(!logs[0].includes('private-audio'));
 assert.equal(JSON.parse(logs[0].slice('practice_transcription_rejected '.length)).words[0].end,'[INVALID TYPE]');
});

test('blank-only transcription keeps rejection diagnostics with original words',async()=>{
 const words=[{word:'',start:0,end:.1},{word:' \t',start:.1,end:.2}];
 const logs=[];
 await assert.rejects(transcribeAudio('synthetic',new Uint8Array(48000),request(words),line=>logs.push(line)),error=>error.transcriptionRule==='words_nonempty');
 const diagnostic=JSON.parse(logs[0].slice('practice_transcription_rejected '.length));
 assert.equal(diagnostic.condition,'words must contain at least one non-empty word');
 assert.deepEqual(diagnostic.words,words);
});
test('an empty middle word reaches measurement without rejection logs',async()=>{
 const logs=[];
 const result=await transcribeAudio('synthetic',new Uint8Array(48000*8),request([{word:'Hello',start:3,end:3.2},{word:'',start:3.2,end:3.4},{word:'there',start:3.4,end:3.8}]),line=>logs.push(line));
 assert.equal(result.confidence,100);assert.equal(result.longPauses,0);assert.deepEqual(logs,[]);
});
