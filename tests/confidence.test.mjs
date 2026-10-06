import test from 'node:test';
import assert from 'node:assert/strict';
import { measureWords } from '../convex/lib/confidence.js';
import { transcribeAudio } from '../convex/lib/transcription.js';
const word=(word,start,end)=>({word,start,end});
test('firm versus hesitant timed words give a measured 20-point gap and matching Heard lines',()=>{
 const firm=measureWords([word('I',0,.2),word('request',.2,.5),word('a',.5,.6),word('raise',.6,1)],10);
 const hesitant=measureWords([word('Umm,',0,.3),word('uh',.4,.6),word('I',3,.5+3),word('think',3.5,3.8),word('maybe',4,4.4),word('a',4.4,4.5),word('raise',4.5,5)],10);
 assert.equal(firm.confidence,100);
 assert.deepEqual({fillers:hesitant.fillers,longPauses:hesitant.longPauses,hedges:hesitant.hedges},{fillers:2,longPauses:1,hedges:2});
 assert.equal(hesitant.confidence,76);
 assert.ok(firm.confidence-hesitant.confidence>=20);
 assert.equal(hesitant.heard,'Heard: 2 fillers, 1 long pause, 2 hedges');
});
test('pause threshold is strictly over two seconds; leading and trailing silence are excluded',()=>{
 assert.equal(measureWords([word('one',5,6),word('two',8,9)],20).longPauses,0);
 assert.equal(measureWords([word('one',5,6),word('two',8.001,9)],20).longPauses,1);
});
test('fillers normalize spelling and punctuation; hedge phrases count once, across word entries',()=>{
 const values=['Um','ummm','UH!','er','umbrella','think','maybe','I','think','sort','of','kind','of','perhaps','possibly'];
 const result=measureWords(values.map((w,i)=>word(w,i*.2,i*.2+.1)),10);
 assert.equal(result.fillers,4);
 assert.equal(result.hedges,6);
 assert.equal(result.confidence,60);
});
test('invalid or missing timestamp data never becomes perfect Confidence',()=>{
 for(const words of [undefined,[],[word('a',NaN,1)],[word('a',2,1)],[word('a',-1,1)],[word('a',0,11)],[word('a',2,3),word('b',1,2)]]) assert.throws(()=>measureWords(words,10));
 const words=Array.from({length:30},(_,i)=>word('um',i*.2,i*.2+.1));
 assert.equal(measureWords(words,10).confidence,0);
});
test('Whisper request carries word timestamps, disfluent prompt and a WAV without logging or persistence',async()=>{
 let calls=0;
 const pcm=new Uint8Array(48000);
 const result=await transcribeAudio('synthetic-key',pcm,async(url,request)=>{
 calls++;
 assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');
 assert.equal(request.headers.Authorization,'Bearer synthetic-key');
 const body=request.body;
 assert.equal(body.get('model'),'whisper-1');
 assert.equal(body.get('response_format'),'verbose_json');
 assert.equal(body.get('timestamp_granularities[]'),'word');
 assert.equal(body.get('temperature'),'0');
 assert.match(body.get('prompt'),/Um, uh, I think, maybe, umm, sort of/);
 const file=body.get('file');
 const wav=Buffer.from(await file.arrayBuffer());
 assert.equal(wav.subarray(0,4).toString(),'RIFF');
 assert.equal(wav.readUInt32LE(24),24000);
 assert.equal(wav.readUInt16LE(22),1);
 assert.equal(wav.readUInt16LE(34),16);
 assert.equal(wav.length,pcm.length+44);
 return {ok:true,json:async()=>({words:[word('Hello',0,.5)]})};
 });
 assert.equal(calls,1);
 assert.equal(result.confidence,100);
});

test('transcription failures expose fixed error codes, not provider text or invented counts',async()=>{
 const pcm=new Uint8Array(48000);
 const failure=(value,ok=true)=>async()=>({ok,json:async()=>value});
 await assert.rejects(transcribeAudio('synthetic',pcm,failure({text:'synthetic speech'})),/invalid_transcription/);
 await assert.rejects(transcribeAudio('synthetic',pcm,failure({words:[]})),/unreadable/);
 await assert.rejects(transcribeAudio('synthetic',pcm,failure({error:{code:'insufficient_quota',message:'synthetic private provider text'}},false)),/insufficient_quota/);
 await assert.rejects(transcribeAudio('synthetic',pcm,failure({error:{code:'unknown-private-code',message:'synthetic private provider text'}},false)),error=>error.message==='transcription_failed');
 await assert.rejects(transcribeAudio('synthetic',pcm,async()=>{throw new Error('synthetic credentials');}),error=>error.message==='transcription_failed');
});

test('empty words in the middle are skipped without altering counts or Confidence',()=>{
 const kept=[word('Request',3,3.3),word('8',3.3,3.6),word('percent',3.8,4.2)];
 const withEmpty=[kept[0],kept[1],word('',3.6,3.8),word(' \t\n',-100,1000),kept[2]];
 assert.deepEqual(measureWords(withEmpty,8),measureWords(kept,8));
 assert.equal(measureWords(withEmpty,8).confidence,100);
});
test('skipped entries add no pauses; pauses remain gaps between actual words',()=>{
 const result=measureWords([word('',0,2),word('one',3,3.5),word(' ',4,5),word('',5.1,5.2),word('two',6,6.5),word(' ',7,8)],9);
 assert.equal(result.longPauses,1);
 assert.equal(result.fillers,0);
 assert.equal(result.confidence,92);
});
test('all-empty word entries reject with the remaining-words diagnostic',()=>{
 assert.throws(()=>measureWords([word('',0,.1),word(' \t',.1,.2)],1),error=>error.message==='invalid_transcription'&&error.transcriptionRule==='words_nonempty');
});
