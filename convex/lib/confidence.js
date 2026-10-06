import { transcriptionRejection } from "./transcriptionDiagnostics.js";
const HEDGES = [['i','think'],['sort','of'],['kind','of'],['maybe'],['perhaps'],['possibly']];
export function measureWords(words, duration, {onDiagnostic} = {}) {
  if (!Number.isFinite(duration)) throw transcriptionRejection('duration_finite');
  if (duration <= 0) throw transcriptionRejection('duration_positive');
  if (duration > 90) throw transcriptionRejection('duration_limit');
  if (!Array.isArray(words)) throw transcriptionRejection('words_array');
  if (!words.length) throw transcriptionRejection('words_nonempty');
  if (words.length > 2000) throw transcriptionRejection('words_limit');
  let fillers=0, longPauses=0, hedges=0, lastStart=-1;
  const tokens=[];
  const tokenRefs=[];
  const diagnostic={words:words.map(item=>({word:item?.word,start:item?.start,end:item?.end})),biggestGaps:[],fillers:[],longPauses:[],hedges:[]};
  let previousWord;

  for (const [index, item] of words.entries()) {
    if (!item) throw transcriptionRejection('word_present', index);
    if (typeof item.word !== 'string') throw transcriptionRejection('word_string', index);
    // Blank transcription artifacts have no words or timing evidence to count.
    if (!item.word.trim()) continue;
    if (item.word.length > 200) throw transcriptionRejection('word_length', index);
    if (!Number.isFinite(item.start)) throw transcriptionRejection('start_finite', index);
    if (!Number.isFinite(item.end)) throw transcriptionRejection('end_finite', index);
    if (item.start < 0) throw transcriptionRejection('start_nonnegative', index);
    if (item.end < item.start) throw transcriptionRejection('end_after_start', index);
    if (item.end > duration + .05) throw transcriptionRejection('end_within_duration', index);
    if (item.start < lastStart) throw transcriptionRejection('start_order', index);
    if(onDiagnostic && previousWord) diagnostic.biggestGaps.push({fromWordIndex:previousWord.index,toWordIndex:index,start:previousWord.end,end:item.start,seconds:item.start-previousWord.end});
    if (previousWord && item.start-previousWord.end>1.2) {
      longPauses++;
      if(onDiagnostic) diagnostic.longPauses.push({kind:'word_gap',fromWordIndex:previousWord.index,toWordIndex:index,start:previousWord.end,end:item.start,seconds:item.start-previousWord.end});
    }
    if (item.end-item.start>1.0) {
      longPauses++;
      if(onDiagnostic) diagnostic.longPauses.push({kind:'word_duration',wordIndex:index,word:item.word,start:item.start,end:item.end,seconds:item.end-item.start});
    }
    previousWord={index,end:item.end};
    lastStart=item.start;
    const parts=item.word.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
    if (!parts.length) throw transcriptionRejection('word_tokens', index);
    for (const part of parts) {
      if (/^(?:u+m+|u+h+|e+r+)$/.test(part)) {
        fillers++;
        if(onDiagnostic) diagnostic.fillers.push({word:item.word,normalized:part,wordIndex:index,start:item.start,end:item.end});
      }
      tokens.push(part);
      tokenRefs.push({wordIndex:index,start:item.start,end:item.end});
    }
  }
  if (lastStart < 0) throw transcriptionRejection('words_nonempty');
  for (let i=0;i<tokens.length;i++) {
    const phrase=HEDGES.find(p=>p.every((token,j)=>tokens[i+j]===token));
    if (phrase) {
      hedges++;
      if(onDiagnostic) diagnostic.hedges.push({phrase:phrase.join(' '),fromWordIndex:tokenRefs[i].wordIndex,toWordIndex:tokenRefs[i+phrase.length-1].wordIndex,start:tokenRefs[i].start,end:tokenRefs[i+phrase.length-1].end});
      i+=phrase.length-1;
    }
  }
  if(onDiagnostic) {
    diagnostic.biggestGaps.sort((a,b)=>b.seconds-a.seconds);
    diagnostic.biggestGaps=diagnostic.biggestGaps.slice(0,5);
    onDiagnostic(diagnostic);
  }
  return measurementFromCounts({fillers,longPauses,hedges});
}
export function measurementFromCounts({fillers,longPauses,hedges}) {
  if([fillers,longPauses,hedges].some(n=>!Number.isSafeInteger(n)||n<0)) throw new Error('invalid_transcription');
  const confidence=Math.max(0,100-4*fillers-8*longPauses-4*hedges);
  return {fillers,longPauses,hedges,confidence,heard:`Heard: ${fillers} filler${fillers===1?'':'s'}, ${longPauses} long pause${longPauses===1?'':'s'}, ${hedges} hedge${hedges===1?'':'s'}`};
}
