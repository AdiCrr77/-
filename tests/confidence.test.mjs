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
test('pause thresholds are strictly over 1.2 seconds between words or 1.0 second within a word',()=>{
 assert.equal(measureWords([word('one',0,0),word('two',1.2,1.7)],20).longPauses,0);
 assert.equal(measureWords([word('one',0,0),word('two',1.201,1.7)],20).longPauses,1);
 assert.equal(measureWords([word('one',0,1)],20).longPauses,0);
 assert.equal(measureWords([word('one',0,1.001)],20).longPauses,1);
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

test('normal-speed words with leading and trailing silence produce zero long pauses',()=>{
 const result=measureWords([word('Hello',3,3.2),word('there',3.3,3.6),word('friend',3.8,4.1)],10);
 assert.equal(result.longPauses,0);
 assert.equal(result.confidence,100);
});
test('a word spanning the reported uh interval is detected as one long pause',()=>{
 let diagnostic;
 const result=measureWords([word('uh',5.58,7.32)],10,{onDiagnostic:value=>{diagnostic=value;}});
 assert.equal(result.longPauses,1);
 assert.equal(result.fillers,1);
 assert.equal(result.confidence,88);
 assert.equal(diagnostic.longPauses[0].kind,'word_duration');
 assert.equal(diagnostic.longPauses[0].seconds,7.32-5.58);
});
test('a gap over 1.2 seconds and a stretched word count separately',()=>{
 const result=measureWords([word('hello',3,3.2),word('uh',4.78,6.52),word('there',6.6,6.9)],10);
 assert.equal(result.longPauses,2);
 assert.equal(result.fillers,1);
 assert.equal(result.confidence,80);
});

test('exact supplied 11.73-second diagnostic timings produce two long pauses',()=>{
 const words=[{"word":"Yes","start":0.80,"end":1.24},{"word":"so","start":1.28,"end":1.46},{"word":"the","start":1.46,"end":1.92},{"word":"outcome","start":1.92,"end":2.44},{"word":"um","start":4.02,"end":4.52},{"word":"yes","start":4.84,"end":5.58},{"word":"uh","start":5.58,"end":7.32},{"word":"we","start":7.32,"end":7.70},{"word":"did","start":7.70,"end":7.98},{"word":"not","start":7.98,"end":8.14},{"word":"exceed","start":8.14,"end":8.56},{"word":"the","start":8.56,"end":8.88},{"word":"outcome","start":8.88,"end":9.00},{"word":"We","start":9.18,"end":9.18},{"word":"did","start":9.18,"end":9.28},{"word":"not","start":9.28,"end":9.50},{"word":"meet","start":9.50,"end":9.60},{"word":"the","start":9.60,"end":9.92},{"word":"outcome","start":9.92,"end":9.92},{"word":"but","start":10.08,"end":10.16},{"word":"we","start":10.16,"end":10.34},{"word":"are","start":10.34,"end":10.46},{"word":"on","start":10.46,"end":10.60},{"word":"the","start":10.60,"end":10.70},{"word":"right","start":10.70,"end":10.94},{"word":"track","start":10.94,"end":11.16}];
 let diagnostic;
 const result=measureWords(words,11.73,{onDiagnostic:value=>{diagnostic=value;}});
 assert.equal(result.longPauses,2);
 assert.equal(result.fillers,2);
 assert.equal(result.hedges,0);
 assert.equal(result.confidence,76);
 assert.equal(result.heard,'Heard: 2 fillers, 2 long pauses, 0 hedges');
 assert.deepEqual(diagnostic.longPauses,[
   {kind:'word_gap',fromWordIndex:3,toWordIndex:4,start:2.44,end:4.02,seconds:4.02-2.44},
   {kind:'word_duration',wordIndex:6,word:'uh',start:5.58,end:7.32,seconds:7.32-5.58},
 ]);
});
