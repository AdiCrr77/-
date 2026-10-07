// This block is returned to the authenticated laptop worker only. It is never
// stored, printed in Convex, included in model input, or sent to WhatsApp.
export function formatScoringDiagnostic(diagnostic, secrets=[]) {
  const scalar=value=>typeof value==='string'||typeof value==='number'||typeof value==='boolean'||value===null?value:'[INVALID TYPE]';
  const scoreValue=value=>{
    if(value===undefined)return '[MISSING]';
    if(value===null || typeof value==='boolean')return value;
    if(typeof value==='number')return Number.isFinite(value)?value:String(value);
    if(typeof value==='string')return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(value.trim())?value:'[REDACTED NON-SCORE]';
    return '[INVALID TYPE]';
  };
  const words=diagnostic.words.map(item=>({word:scalar(item.word),start:scalar(item.start),end:scalar(item.end)}));
  const projected={
    fullTranscript:diagnostic.fullTranscript,duration:diagnostic.duration,words,
    biggestGaps:diagnostic.biggestGaps,fillers:diagnostic.fillers,longPauses:diagnostic.longPauses,hedges:diagnostic.hedges,
    ...(Array.isArray(diagnostic.clarityChecks) ? {clarityChecks:diagnostic.clarityChecks.map(check=>({
      check:scalar(check.check),aiPass:scalar(check.aiPass),quote:scalar(check.quote),quoteFound:scalar(check.quoteFound),pass:scalar(check.pass),
    }))} : {}),
    ...(Array.isArray(diagnostic.feedbackScoreRejections) ? {feedbackScoreRejections:diagnostic.feedbackScoreRejections.map(scores=>({charisma:scoreValue(scores.charisma),warmth:scoreValue(scores.warmth)}))} : {}),
    ...(Array.isArray(diagnostic.rewriteRejections) ? {rewriteRejections:diagnostic.rewriteRejections.map(scalar)} : {}),
    ...(typeof diagnostic.r === 'string' ? {r:diagnostic.r} : {}),
  };
  let text=JSON.stringify(projected,null,2);
  for(const secret of secrets.filter(Boolean)) text=text.split(secret).join('[REDACTED KEY]');
  text=text.replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED KEY]').replace(/[A-Za-z0-9+/]{256,}={0,2}/g,'[REDACTED BINARY]');
  return `SCORING DIAGNOSTIC\n${text}\nEND SCORING DIAGNOSTIC`;
}
