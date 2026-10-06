import { transcriptionRejection } from "./transcriptionDiagnostics.js";
const HEDGES = [['i','think'],['sort','of'],['kind','of'],['maybe'],['perhaps'],['possibly']];
export function measureWords(words, duration) {
  if (!Number.isFinite(duration)) throw transcriptionRejection('duration_finite');
  if (duration <= 0) throw transcriptionRejection('duration_positive');
  if (duration > 90) throw transcriptionRejection('duration_limit');
  if (!Array.isArray(words)) throw transcriptionRejection('words_array');
  if (!words.length) throw transcriptionRejection('words_nonempty');
  if (words.length > 2000) throw transcriptionRejection('words_limit');
  let fillers=0, longPauses=0, hedges=0, lastStart=-1, lastEnd=0;
  const tokens=[];
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
    if (lastStart>=0 && item.start-lastEnd>2) longPauses++;
    lastStart=item.start;
    lastEnd=Math.max(lastEnd,item.end);
    const parts=item.word.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
    if (!parts.length) throw transcriptionRejection('word_tokens', index);
    for (const part of parts) {
      if (/^(?:u+m+|u+h+|e+r+)$/.test(part)) fillers++;
      tokens.push(part);
    }
  }
  if (lastStart < 0) throw transcriptionRejection('words_nonempty');
  for (let i=0;i<tokens.length;i++) {
    const phrase=HEDGES.find(p=>p.every((token,j)=>tokens[i+j]===token));
    if (phrase) { hedges++; i+=phrase.length-1; }
  }
  const confidence=Math.max(0,100-4*fillers-8*longPauses-4*hedges);
  return {fillers,longPauses,hedges,confidence,heard:`Heard: ${fillers} filler${fillers===1?'':'s'}, ${longPauses} long pause${longPauses===1?'':'s'}, ${hedges} hedge${hedges===1?'':'s'}`};
}
