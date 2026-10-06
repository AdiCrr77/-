// This block is returned to the authenticated laptop worker only. It is never
// stored, printed in Convex, included in model input, or sent to WhatsApp.
export function formatScoringDiagnostic(diagnostic, secrets=[]) {
  const scalar=value=>typeof value==='string'||typeof value==='number'||typeof value==='boolean'||value===null?value:'[INVALID TYPE]';
  const words=diagnostic.words.map(item=>({word:scalar(item.word),start:scalar(item.start),end:scalar(item.end)}));
  const projected={
    fullTranscript:diagnostic.fullTranscript,duration:diagnostic.duration,words,
    biggestGaps:diagnostic.biggestGaps,fillers:diagnostic.fillers,longPauses:diagnostic.longPauses,hedges:diagnostic.hedges,
  };
  let text=JSON.stringify(projected,null,2);
  for(const secret of secrets.filter(Boolean)) text=text.split(secret).join('[REDACTED KEY]');
  text=text.replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED KEY]').replace(/[A-Za-z0-9+/]{256,}={0,2}/g,'[REDACTED BINARY]');
  return `SCORING DIAGNOSTIC\n${text}\nEND SCORING DIAGNOSTIC`;
}
