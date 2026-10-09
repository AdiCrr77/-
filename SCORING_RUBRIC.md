# Active audio scoring rules

Confidence and Heard are computed in Convex from Whisper word timestamps. The feedback model, gpt-realtime-2.1-mini, hears the current original audio and receives every accepted round transcript plus retained earlier delivery observations to produce whole-round Clarity, Persuasion, Warmth and the better version. Earlier recordings are deleted and are not replayed. It cannot supply Confidence or Heard.

## Confidence

`max(0, 100 - 4 * fillers - 8 * longPauses - 4 * hedges)`

- Fillers: normalized case and punctuation, matching um/umm (including stretched spellings), uh and er. Normal words such as umbrella do not match.
- Long pauses: each gap strictly greater than 1.2 seconds between consecutive retained words, plus each single retained word lasting strictly more than 1.0 second. These are separate detected events. Leading/trailing recording silence and skipped empty entries are excluded.
- Hedges: non-overlapping lexical occurrences of maybe, I think, sort of, kind of, perhaps and possibly. This counter counts words, without AI interpretation of motive or context.
- No pitch inference or deductions. Missing, empty, invalid, out-of-order or out-of-duration word timestamps do not default to 100.
- Heard lists only these three locally computed counts, using exactly the same measurement as Confidence.

Whisper request: whisper-1, verbose_json, timestamp_granularities[]=word, temperature=0. Disfluent example prompt: “Um, uh, I think, maybe, umm, sort of. Uh, I would like to discuss a raise. Um, perhaps we can talk about it.” Language is auto-detected. The prompt guides recognition; it is not guaranteed to preserve every filler. Timestamps and transcripts remain model estimates, even though counting is deterministic. Transcripts are saved temporarily in the open round, then cleared at scoring or a fresh selection. Timestamp arrays are not persisted. Successful transcripts are not logged.

## Other categories and rewrite

The feedback call assesses all round transcripts and accumulated audible delivery observations for Clarity, Persuasion and Warmth out of 100, using PRODUCT.md definitions. Convex validates these numeric scores, inserts its own Confidence, and rounds their mean to a whole number. Rewrite instructions and the seven-line scorecard remain unchanged apart from the content of Heard.

## Limits and proof

The existing 90-second audio limit, 500-token feedback cap and 30-provider-call rolling-hour cap remain. Transcription reserves one call; feedback reserves another; any single feedback retry reserves a third and reuses the existing measurement. Whisper does not support a max_output_tokens setting; input duration remains bounded. All calls run in Convex with the environment key. Audio is wrapped as WAV only in memory and remains subject to existing success/failure deletion.

Synthetic timed words prove the formula: the test pair scores 100 versus 76. Acceptance still requires live firm/hesitant recordings of the same complete answer and both actual WhatsApp scorecards, with the hesitant Confidence at least 20 points lower. Never manufacture that gap or substitute synthetic scorecards for phone proof.

Sources: https://developers.openai.com/api/docs/guides/speech-to-text and https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create . Whisper is scheduled for removal February 26, 2027: https://developers.openai.com/api/docs/deprecations .

## Temporary approved rejection diagnostics (2026-10-06)

The builder explicitly authorized word/start/end logging only when transcription validation rejects. The log includes the fixed failing rule, word index and decoded duration for timestamp-bound checks. Keys and binary data are redacted; audio and other response fields are excluded. Scoring and validation conditions are unchanged. After the real diagnostic identified an empty word, the builder authorized skipping empty/whitespace-only entries. These entries are ignored before timestamp validation or counting. A transcript with no non-empty words remaining is rejected and logged. Pauses use consecutive retained words; discarded entries add no counts.

## Whole-round aggregation and fact completion (2026-10-06)

Sum fillers, long pauses and hedge counts measured independently in every accepted note, then apply the unchanged Confidence formula once. Never concatenate timestamp timelines or count silence between recordings. Heard uses these same totals. A note whose transcription fails is excluded; a valid transcript whose feedback fails remains available for later re-reading. Feedback marked unreadable discards that note. Earlier notes are never replaced by the latest clarification alone.

The server checks the merged facts after the model has reread the combined transcripts. It selects only still-missing facts not already asked. Once all missing facts have had their one question, score available material and require visible placeholders for unresolved details. Keep named facts and explicit uncertainty rather than inventing detail. The same model still judges semantic completeness; wiring tests cannot establish perfect extraction for arbitrary audio.

Saved scores include the WhatsApp message IDs of contributing notes. Open-round transcripts/counts/delivery observations are cleared after scoring or a fresh 1 selection. Transcription and feedback keep the existing separate quota reservations and retry behavior.

## Local successful-transcription diagnostics (2026-10-06)

Counting optionally records exact matched words, hedge phrases and internal long pauses without changing scores. Full Whisper text and word timestamps are returned transiently to the laptop for local SCORING DIAGNOSTIC printing, never saved as round data or sent to WhatsApp. The five biggest gaps use consecutive retained-word end/start times; counted long-pause entries identify either word_gap (>1.2 seconds) or word_duration (>1.0 second). No leading/trailing silence, empty-token timing or boundary between notes is added to pause counts. Known keys and binary data are redacted before returning the block.
