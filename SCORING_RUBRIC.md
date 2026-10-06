# Active audio scoring rules

Confidence and Heard are computed in Convex from Whisper word timestamps. The feedback model, gpt-realtime-2.1-mini, hears the original audio and produces Clarity, Charisma, Warmth and the better version. It cannot supply Confidence or Heard.

## Confidence

`max(0, 100 - 4 * fillers - 8 * longPauses - 4 * hedges)`

- Fillers: normalized case and punctuation, matching um/umm (including stretched spellings), uh and er. Normal words such as umbrella do not match.
- Long pauses: a gap strictly greater than two seconds between timestamped words. Overlapping intervals use the latest covered end time. Leading/trailing silence is excluded.
- Hedges: non-overlapping lexical occurrences of maybe, I think, sort of, kind of, perhaps and possibly. This counter counts words, without AI interpretation of motive or context.
- No pitch inference or deductions. Missing, empty, invalid, out-of-order or out-of-duration word timestamps do not default to 100.
- Heard lists only these three locally computed counts, using exactly the same measurement as Confidence.

Whisper request: whisper-1, verbose_json, timestamp_granularities[]=word, temperature=0. Disfluent example prompt: “Um, uh, I think, maybe, umm, sort of. Uh, I would like to discuss a raise. Um, perhaps we can talk about it.” Language is auto-detected. The prompt guides recognition; it is not guaranteed to preserve every filler. Timestamps and transcripts remain model estimates, even though counting is deterministic. No transcript or timestamp array is saved or logged.

## Other categories and rewrite

The original audio feedback call produces each of Clarity, Charisma and Warmth out of 100 using PRODUCT.md definitions and audible delivery. Convex validates these numeric scores, inserts its own Confidence, and rounds their mean to a whole number. Rewrite instructions and the seven-line scorecard remain unchanged apart from the content of Heard.

## Limits and proof

The existing 90-second audio limit, 500-token feedback cap and 30-provider-call rolling-hour cap remain. Transcription reserves one call; feedback reserves another; any single feedback retry reserves a third and reuses the existing measurement. Whisper does not support a max_output_tokens setting; input duration remains bounded. All calls run in Convex with the environment key. Audio is wrapped as WAV only in memory and remains subject to existing success/failure deletion.

Synthetic timed words prove the formula: the test pair scores 100 versus 76. Acceptance still requires live firm/hesitant recordings of the same complete answer and both actual WhatsApp scorecards, with the hesitant Confidence at least 20 points lower. Never manufacture that gap or substitute synthetic scorecards for phone proof.

Sources: https://developers.openai.com/api/docs/guides/speech-to-text and https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create . Whisper is scheduled for removal February 26, 2027: https://developers.openai.com/api/docs/deprecations .

## Temporary approved rejection diagnostics (2026-10-06)

The builder explicitly authorized word/start/end logging only when transcription validation rejects. The log includes the fixed failing rule, word index and decoded duration for timestamp-bound checks. Keys and binary data are redacted; audio and other response fields are excluded. Scoring and validation conditions are unchanged. After the real diagnostic identified an empty word, the builder authorized skipping empty/whitespace-only entries. These entries are ignored before timestamp validation or counting. A transcript with no non-empty words remaining is rejected and logged. Pauses use consecutive retained words; discarded entries add no counts.
