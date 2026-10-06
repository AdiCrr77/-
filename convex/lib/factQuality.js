// Conservative server guard for generic fact placeholders. The extractor is also
// instructed to supply only concrete, user-stated facts (in any language).
export function usableFact(name, value) {
  const text = value.trim();
  if (!text || name === 'payRequest') return text;
  const normalized = text.toLowerCase().replace(/[’‘]/g, "'");
  // Explicit user uncertainty is valid; model commentary about missing audio is not.
  if (/^(?:i |we )?(?:do not know|don't know|cannot recall|can't recall|am unsure|are unsure|not sure)\b/.test(normalized)) return text;
  if (/^(?:we )?(?:never agreed|did not agree|didn't agree|no (?:specific )?(?:goals?|expectations?|targets?|benchmark))\b/.test(normalized)) return text;
  if (/\b(?:not audible|not specified|unspecified|not provided|not stated|not mentioned|unknown)\b/.test(normalized)) return '';
  if (name === 'expectations') {
    // A comparison must be explicitly extracted, never invented from completion.
    // The model handles multilingual semantics; obvious absent comparisons fail here.
    if (/^(?:did|done|completed|finished|delivered)\b/.test(normalized) && !/\b(?:met|meet|exceed|exceeded|below|above|short|expectations)\b/.test(normalized)) return '';
    return text;
  }
  const generic = name === 'agreedGoals'
    ? /\b(?:i|we|you|the|a|an|and|or|on|with|had|have|has|were|was|are|is|been|agreed|discussed|set|multiple|several|various|many|some|all|specific|number|of|goals?|expectations?|targets?|tasks?|requirements?|objectives?|manager|previously|before)\b/g
    : /\b(?:i|we|you|the|a|an|and|or|with|had|have|has|was|were|is|are|been|be|to|what|whatever|that|it|all|everything|work|tasks?|requirements?|needed|required|necessary|done|did|completed|finished|delivered|agreed|discussed|expected|manager|previously|before|of)\b/g;
  const detail = normalized.replace(generic, '').replace(/[\s.,;:!?"'()-]/g, '');
  return detail ? text : '';
}
