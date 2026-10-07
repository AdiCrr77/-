// Evidence matching ignores presentation, while keeping word order and numbers.
export function normalizeQuote(text) {
  return text.toLowerCase().replace(/[’'‘]/gu, '')
    .replace(/(?<=\d)[,.](?=\d)/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/gu, ' ').trim();
}
export function quoteMatches(quote, transcripts) {
  if (typeof quote !== 'string') return false;
  const normalized = normalizeQuote(quote);
  return !!normalized && transcripts.some(text => typeof text === 'string' &&
    (` ${normalizeQuote(text)} `).includes(` ${normalized} `));
}

// Identify requests from explicit ask clauses, rather than treating descriptions
// of goals, results, or being "on track" as a second request.
function requestTarget(text) {
  const target = text.trim().replace(/^(?:(?:for|a|an|the|also|uh|um)\s+)+/iu, '').trim();
  const normalized = normalizeQuote(target);
  if (!normalized) return null;
  let kind;
  if (/\b(?:raise|pay rise|(?:pay|salary) increase)\b/iu.test(target)) kind = 'raise';
  else if (/\bbonus\b/iu.test(target)) kind = 'bonus';
  else if (/\bpromotion\b/iu.test(target)) kind = 'promotion';
  else if (/\b(?:days? off|time off|leave)\b/iu.test(target)) kind = 'time off';
  const amount = target.match(/\b\d+(?:\.\d+)?/u)?.[0];
  return {raw:target,key:kind ? `${kind}:${amount ? String(Number(amount)) : ''}` : normalized, text:normalized, known:!!kind};
}
function requestsIn(text) {
  const requests=[];
  const plain=text.replace(/[’‘]/gu,"'");
  const add=(request,from)=>{
    const position=plain.indexOf(request.raw,from);
    if(position<0)return;
    const prefix=normalizeQuote(plain.slice(0,position));
    requests.push({...request,start:prefix.length+(prefix?1:0),source:normalizeQuote(plain)});
  };
  const cue=/\b(?:i(?:'d| would)\s+(?:also\s+)?like(?:\s+to\s+(?:ask|request))?|i(?:'m| am)\s+(?:also\s+)?asking|i\s+(?:also\s+)?(?:want|wanted|request|ask)(?:\s+to\s+(?:ask|request))?|(?:could|can|would|will)\s+you|please\s+(?:give|approve|grant))\b/giu;
  for(const match of plain.matchAll(cue)) {
    const tail=plain.slice(match.index+match[0].length).split(/[;!?]|\.(?!\d)|,|\b(?:but|because)\b/iu)[0];
    const targets=tail.split(/\band\b/iu);
    for(let index=0;index<targets.length;index++) {
      const request=requestTarget(targets[index]);
      if(request && (index===0 || request.known)) add(request,match.index+match[0].length);
    }
  }
  // An "and ..." continuation can introduce an additional concrete ask.
  for(const match of plain.matchAll(/(?:^|[.!?])\s*and\s+([^.!?;]+)/giu)) {
    const request=requestTarget(match[1]);
    if(request?.known && !/^(?:i|we|you|our)\b/iu.test(match[1])) add(request,match.index);
  }
  return requests.sort((a,b)=>a.start-b.start);
}
export function hasSecondRequest(quote, transcripts) {
  if (!quoteMatches(quote, transcripts)) return false;
  const requests=transcripts.filter(text=>typeof text==='string').flatMap(requestsIn);
  if (!requests.length) return false;
  const first=requests[0];
  const normalized=normalizeQuote(quote);
  return requests.slice(1).some(request=>{
    if(request.key===first.key)return false;
    const source=` ${request.source} `;
    const needle=` ${normalized} `;
    for(let offset=source.indexOf(needle);offset>=0;offset=source.indexOf(needle,offset+1)) {
      // The matched quote must cover the actual second ask, not a different
      // occurrence of words such as "bonus" in a description of results.
      if(request.start>=offset && request.start+request.text.length<=offset+normalized.length)return true;
    }
    return false;
  });
}
