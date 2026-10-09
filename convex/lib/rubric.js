// Fixed rubric v1. Counts are extracted from the current audio, never the rewrite.
export const OBSERVATION_FIELDS = {
  fillers: { type: "integer", minimum: 0, maximum: 200 },
  longPauses: { type: "integer", minimum: 0, maximum: 44 },
  hedges: { type: "integer", minimum: 0, maximum: 200 },
  askEnding: { type: "string", enum: ["dropped", "rose", "level", "unclear"] },
  earlyAsk: { type: "boolean" },
  unclearPhrases: { type: "integer", minimum: 0, maximum: 200 },
  restarts: { type: "integer", minimum: 0, maximum: 200 },
  supportingFacts: { type: "integer", minimum: 0, maximum: 3 },
  linkedAsk: { type: "boolean" },
  emphasizedPoints: { type: "integer", minimum: 0, maximum: 2 },
  respectfulPhrases: { type: "integer", minimum: 0, maximum: 2 },
  collaborativePhrases: { type: "integer", minimum: 0, maximum: 2 },
  hostilePhrases: { type: "integer", minimum: 0, maximum: 200 },
};
export const OBSERVATION_INSTRUCTIONS = `Report observations from the current ORIGINAL AUDIO only. Never choose numeric scores.
fillers: count each nonlexical um/umm/uh/er; do not count normal words or repeat one stretched filler.
longPauses: count internal gaps strictly longer than 2 seconds between spoken words; exclude leading/trailing silence.
hedges: count non-overlapping occurrences of maybe, I think, sort of, kind of, perhaps, possibly; count only uncertainty about the ask, not quoted speech or factual uncertainty.
askEnding: dropped, rose, level or unclear for pitch at the end of the main pay request. Unclear if no audible main ask. Do not infer pitch from punctuation, accent or gender.
earlyAsk: true only when the pay request is explicit within the first two completed sentences.
unclearPhrases: count phrases whose words cannot be understood; each contiguous unclear span counts once.
restarts: count abandoned clauses that restart; exclude ordinary repetition for emphasis.
supportingFacts: count distinct audible evidence categories: agreed goal, delivered outcome, comparison with expectations (0-3). Do not count prior session facts unless spoken here.
linkedAsk: true only when the speaker explicitly connects delivered evidence to the raise request.
emphasizedPoints: count distinct ask/evidence points with audible stress or deliberate emphasis, capped at 2; loudness alone does not count.
respectfulPhrases: count explicit thanks, please, acknowledgement of the listener's time/perspective, capped at 2.
collaborativePhrases: count explicit invitations to discuss or agree next steps together, capped at 2.
hostilePhrases: count insults, threats or blame directed at the listener; firm disagreement is not hostility.
Return all observation fields. Counts must be integers. Do not guess inaudible cues.`;
export function scoreObservations(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("invalid_scores");
  for (const [name, rule] of Object.entries(OBSERVATION_FIELDS)) {
    const value = o[name];
    if (rule.type === "integer" ? !Number.isInteger(value) || value < rule.minimum || value > rule.maximum
      : rule.type === "boolean" ? typeof value !== "boolean" : !rule.enum.includes(value)) throw new Error("invalid_scores");
  }
  const clamp = n => Math.max(0, Math.min(100, n));
  const scores = {
    confidence: clamp(100 - 2*o.fillers - 4*o.longPauses - 3*o.hedges - (o.askEnding === "rose" ? 5 : o.askEnding === "unclear" ? 5 : 0)),
    clarity: clamp(100 - (o.earlyAsk ? 0 : 20) - 5*o.unclearPhrases - 3*o.restarts - 2*o.longPauses),
    persuasion: clamp(40 + 10*o.supportingFacts + (o.linkedAsk ? 20 : 0) + 5*o.emphasizedPoints - 2*o.restarts),
    warmth: clamp(80 + 5*o.respectfulPhrases + 5*o.collaborativePhrases - 20*o.hostilePhrases),
  };
  const heard = `Heard: ${o.fillers} fillers, ${o.longPauses} long pauses, ${o.hedges} hedges, ask ending ${o.askEnding}; early ask ${o.earlyAsk ? "yes" : "no"}, ${o.unclearPhrases} unclear phrases, ${o.restarts} restarts; ${o.supportingFacts} supporting facts, linked ask ${o.linkedAsk ? "yes" : "no"}, ${o.emphasizedPoints} emphasized points; ${o.respectfulPhrases} respectful, ${o.collaborativePhrases} collaborative, ${o.hostilePhrases} hostile phrases`;
  return { scores, heard };
}
