# Plan

Milestones from PRODUCT.md section 7. Milestone 1 is approved, including the builder-approved raise missing-fact flow brought forward from milestone 3 on 2026-10-05.

1. **In progress:** Send one voice note answer to the demo manager's raise question and receive Clarity, Confidence, Charisma and Warmth scores, plus a better version of the user's own words.
2. Answer the demo manager's follow-ups until the overall stays above 85; "stop" or 2 minutes of silence sends the best version. Apply AGENTS.md's precise stopping rules.
3. Leave out a fact and receive a question asking only for that fact.
4. Practise the delay, party (user speaks first), and dating situations.
5. Open WhatsApp, pick a situation, and practise all supported situations.
6. **Last:** Close, reopen, and find saved data still there.

## Milestone 1 scope

- WhatsApp on the builder's own number, using Hermes in WSL on the laptop. WhatsApp delivery is brought forward from milestone 5 for this test only.
- Select `1` or `Ask for a raise`; send exactly: `I have 2 mins before my next meeting - what are you asking on pay?`
- Receive voice notes, each at most 90 seconds, and send `Listening to your answer...`. Keep the raise request, previously agreed goals, delivered outcome and comparison with expectations in session facts. Ask only for the next missing fact, in character, before producing scores and the better version; skip facts already supplied. Explicitly unknown or never-agreed goals are valid user facts.
- A Convex action first transcribes original audio with Whisper word timestamps, then sends original audio (not just a transcript) to `gpt-realtime-2.1-mini`, requesting text only and `max_output_tokens: 500`.
- Convex computes Confidence from timestamped-word counts, validates AI Clarity/Charisma/Warmth and computes overall as the average of the four scores, each out of 100, rounded to a whole number as requested by the builder on 2026-10-05.
- Send two messages: the existing five-line scorecard (bold overall, one emoji per category) plus one Heard: evidence line and the builder-requested final line `scored from: audio` for the actual audio scoring path, then bold `Better version` and the rewrite, without emojis or invented facts. Each message has at most seven lines.
- Enforce at most 30 AI calls per rolling hour across the app in Convex. Provider errors/call cap: `Busy right now. Try again in a few minutes.` Validation failures: `Couldn't score that one. Please send it again.` Monthly budget exhaustion: `Practice is paused for now. Back soon.` Unreadable audio: `I couldn't hear that clearly. Send it again?`
- OpenAI key is `OPENAI_API_KEY`, set by the builder in Convex, never on the laptop or in source. Builder sets the provider's $20 hard monthly limit.
- Delete temporary audio on success and failure. Keep WhatsApp sessions, credentials, voice notes, phone numbers and real answers outside the repository.
- No other situations, scored follow-ups, stopping rule, reminders, login, or web practice page. Missing-fact questions for the raise flow are approved; they are not scored follow-ups.

## Hermes to Convex delivery

Inspect the installed Hermes WhatsApp bridge before connecting it. Use its actual incoming-message and sending interfaces, with a dedicated practice handler rather than Hermes's general chat AI. The laptop receives the original WhatsApp Opus voice note, converts it locally to mono 24 kHz signed 16-bit PCM, and sends the audio to an authenticated Convex HTTP endpoint. Convex validates the decoded audio duration and owns selection, scoring, average calculation, storage and all limits. The Convex action opens the OpenAI Realtime connection with its environment key, then returns text messages for Hermes to send in order. The laptop deletes temporary media in a finally block; Convex does not persist audio. Duplicate WhatsApp message IDs must not trigger additional AI calls.

## Proof before milestone confirmation

- Automated checks use made-up data and cover scoring averages, invalid scores, duration, duplicate delivery, caps and message formatting.
- Push backend to the existing development deployment; do not rebind it or deploy production before confirmation.
- Test using a real WhatsApp voice note. Report its actual reply in chat, without saving the real answer in the repository.
- Give exact phone steps after the Hermes connection works. Milestone 1 remains incomplete until the WhatsApp test passes.
- After the builder confirms it works: commit, push, deploy using `npm run deploy`, and add one line to PROGRESS.md.

## Milestone 1 implementation status (2026-10-04)

- Convex selection, original-audio scoring, score storage, authenticated HTTP delivery, exact rolling-hour quota and duplicate protection are implemented locally. A dedicated worker uses the inspected Hermes bridge interfaces; its launcher uses the existing laptop pairing and bundled Linux ffmpeg.
- 27 automated checks passed with synthetic data, including a real ffmpeg Opus-to-PCM conversion and the registered Convex HTTP handlers. Convex modules import successfully locally.
- Not verified live: backend push, provider response and real WhatsApp voice note. This agent session cannot reach Convex/npm (DNS/network restrictions), and `convex dev --once` requires a Convex login unavailable in this noninteractive terminal. Local dependencies also contain Windows esbuild, and TypeScript is not installed. Run `npm ci` and `npx convex login` in unrestricted WSL, then follow WHATSAPP_TEST.md. No commit, push, production deploy or milestone confirmation has occurred.

## Milestone 1 scoring diagnosis (2026-10-05)

- The builder's real WhatsApp test reached the manager's opener and `Listening to your answer...`, then received `Busy right now. Try again in a few minutes.` The scoring cause is still unconfirmed.
- With the builder's approval, added diagnostic logging restricted to fixed error codes; unknown errors and JSON parsing failures cannot print answer text, credentials, phone numbers or audio. WebSocket HTTP rejection statuses are distinguished while the WhatsApp reply stays the same.
- All 32 synthetic checks pass; HTTP and Node action bundles compile. Pushing the diagnostics to the existing development deployment failed with network/DNS errors in this agent session. Next: run `npx convex dev --once` and `npx convex logs --history 10` in the builder's WSL terminal, retry `1` and a voice note on the phone, then inspect the `practice_scoring_error code=...` line before fixing scoring.

- Latest phone diagnostic: `invalid_audio` before any OpenAI call, from a seven-second recording with no reported bridge download error. Refined the approved diagnostics to distinguish empty/short/odd PCM and laptop download/conversion failures, including fixed decoder failure codes without stderr or paths. Restart the laptop practice process and push the backend diagnostics before the next WhatsApp retry.

- The next real WhatsApp retry passed audio validation but failed with `invalid_json`. Added fixed structural JSON diagnostic codes (empty, fenced, non-object, incomplete object, malformed object), without logging or retaining the response text. Scoring still rejects invalid JSON pending the specific cause; push the diagnostic update and inspect one more WhatsApp retry before choosing a parser or protocol fix.

- Latest phone diagnostic: `invalid_json_non_object`. The Realtime call requested JSON in prose without enforcing the response channel. Changed it to require one `submit_practice_result` function call, then validate its arguments with the existing score parser. All 36 synthetic checks pass and the scoring action bundle compiles. Development push and a real WhatsApp retry remain pending terminal network access; milestone 1 is not confirmed.

- Terminal full access now reaches the connected WhatsApp bridge and existing Convex CLI login. The response-format fix was pushed successfully to development deployment `clean-bulldog-54` on 2026-10-05. Live logs are available to the agent; the next real phone voice note remains the required end-to-end check.

- The builder reported that Better version was only a paraphrase and approved strengthening it. Rewrite instructions now explicitly improve clarity, confidence, charisma and warmth using all relevant supplied facts, with no invented facts or extra commentary. All 36 checks pass, including the transmitted instruction contract; actual rewrite quality still requires a WhatsApp voice-note check.

- Approved raise-context extension implemented and pushed to development `clean-bulldog-54`: Convex persists bounded session facts and the current question, validates extracted facts, asks one missing question at a time and scores only with complete context. New selection clears facts; in-flight old answers cannot overwrite a new session. All 40 synthetic checks pass, including context passed to the audio call. Rewrite uses accumulated facts; audible delivery is judged from the latest recording because audio is deleted after each call. WhatsApp validation remains pending.

- Firm/hesitant tone comparison is in progress before milestone 2. The hesitant attempt returned Busy with backend `invalid_scores`; no valid hesitant score was saved. Added fixed missing/type/range score diagnostics without exposing model output; all 41 synthetic tests pass. Comparison remains inconclusive until both recordings produce valid scores.

- The firm/hesitant comparison produced identical Confidence scores, so tone sensitivity is not established. The builder approved explicit audio-based criteria for all four categories and an accurate server-selected source line on the scorecard. Existing rewrite instructions, missing-fact questions, model and caps are preserved. Required proof is a fresh firm/hesitant WhatsApp pair with both complete scorecard messages reproduced verbatim in chat; no real answers or recordings belong in the repository.

- First phone attempt after audio-rubric update failed with `invalid_rewrite`. Added fixed missing/empty/length/format diagnostics; no rewrite text is logged and message content/validation is unchanged. All 43 synthetic checks pass. Need a fresh voice-note retry to identify the failed rewrite rule; tone comparison still has no valid new pair.

- Repeated Busy replies have included invalid scores, invalid rewrites and most recently invalid facts. Fixed omitted fact fields being rejected instead of treated as unknown; known session facts are retained. Malformed AI output now receives one automatic retry using the same original audio, with a separate atomic quota reservation and one retry maximum per delivery. Provider/billing failures and unreadable audio are not retried. Both requests use the unchanged model and 500-token cap; the 30-call global limit includes retries, and per-attempt timeouts keep two attempts within the worker's request timeout. All 50 synthetic checks pass. Real WhatsApp confirmation remains required.

- Builder explicitly authorized logging rejected AI response text for diagnosis, with API keys and audio redacted. The first synthetic WhatsApp test after adding logging passed, so there was no rejected response to reproduce from it; earlier rejected text was not retained. Official model docs show function calling supported but strict Structured Outputs unsupported. Simplified the forced function-call contract to flat string fact fields and four non-null numeric scores; Convex merges facts and still asks its unchanged questions before displaying a result. Overall now rounds to a whole number and validation failures use the builder's exact new error message. Existing scorecard styling, rewrite instructions, model and caps are preserved. All 53 synthetic checks pass; a fresh live synthetic WhatsApp check follows the development push.

- Development push succeeded and the new synthetic voice-note test sent a complete six-line audio scorecard through Hermes, with rounded overall and no retry or validation error. Temporary synthetic audio was removed. Neither live synthetic test reproduced a rejection, so no raw rejected response was available to show; logging is active for the next genuine validation rejection. A user phone check still gates milestone confirmation and production shipping.

## Parked

- Milestones 2–6, except the approved raise missing-fact flow brought forward from milestone 3.
- Calendar access, reminders and WhatsApp Business migration.

## Approved scoring repeatability fix (2026-10-05)

- Fixed observation rubrics are written in SCORING_RUBRIC.md and calculated by Convex, replacing direct model scores on the live scoring path. One Heard: line lists observations after the category scores; DESIGN.md now permits seven lines. Rewrite instructions, model and caps are unchanged.
- All 55 synthetic checks pass; the Node scoring action bundles successfully. Development push failed with network authorization/fetch and DNS errors in this session. Run `npx convex dev --once` from connected WSL before checking WhatsApp.
- Pending acceptance: three forwards of the same original voice note, with a fresh `1` selection before each, must produce Confidence scores within five points. No claim of observed audio repeatability or milestone completion yet.

## Incomplete scoring response diagnosis (2026-10-05)

- Builder supplied live logs showing both attempts ended with `incomplete_response`; the retry's function arguments stopped at the start of the JSON object. The provider's stopping reason was not logged, so token exhaustion is not yet confirmed.
- Added safe completion metadata logging: fixed status/type/reason values and numeric output-token count only, alongside existing redacted rejected text. Unknown metadata cannot print private values. No scoring request, model, cap, rewrite or message changes.
- All 57 synthetic tests pass and the scoring action bundles. Development push again failed with fetch/DNS errors. Push from connected WSL, reproduce with one WhatsApp voice note, and inspect `practice_scoring_completion` before changing the request.

## Confirmed output-cap fix (2026-10-05)

- Builder's fresh completion log confirms `reason=max_output_tokens output_tokens=500`. Rejected text contains a prose preamble and an unfinished observation object. No real response copied into repository files or tests.
- Replaced verbose provider field names with compact named keys, expanded and validated in Convex before applying the unchanged rubrics. Fact summaries request terse newly supplied/changed values instead of repeating session facts. Explicitly forbid preamble/commentary and indentation; keep every observation and the complete rewrite. Rewrite instructions, seven-line scorecard, model and all caps remain unchanged.
- Compact/full synthetic outputs produce exactly the same application facts, scores, evidence and rewrite; missing observations still reject, missing facts still ask one question, and omitted unchanged facts merge from session context. All 58 checks pass and scoring action compiles. Development push remains blocked by fetch/DNS failure; connected WSL must push, then a fresh WhatsApp voice note must verify completion before the three-forward confidence test.

## Reasoning-budget correction (2026-10-05)

- New builder logs show compact keys are live, but both attempts still hit 500 output tokens with almost no visible JSON. Compact field names alone did not resolve the live failure.
- Official OpenAI model documentation identifies gpt-realtime-2.1-mini as a reasoning model, and the Realtime client-event reference documents reasoning.effort=minimal for reasoning-capable models. Added minimal reasoning at session and response levels, retaining the same model, rubric, rewrite instructions, scorecard and all caps. Hidden reasoning consuming the budget remains an inference until numeric usage confirms it.
- Failure diagnostics now log safe numeric text/audio/reasoning token breakdowns when supplied, with unknown for absent or invalid values. All 60 tests pass; action compiles. Development push failed with fetch/DNS errors; connected WSL push and a new WhatsApp voice-note check are still required.

## Approved vague-fact correction (2026-10-05)

- Premature scoring came from treating any nonempty extracted fact as complete. Convex now rejects common generic goal/outcome placeholders and extractor commentary about missing details, rechecks stored facts, and retains specific prior facts when the latest extraction is vague. Extraction instructions require a named goal, actual outcome and explicit user-stated comparison; completion alone cannot imply meeting expectations.
- Clarification asks `What specific goal had we agreed on?` and `What specific outcome did you deliver?`. Explicit uncertainty or never-agreed goals remain accepted. Scorecard, rubric, rewrite instructions, model and caps are unchanged.
- All 65 synthetic tests pass, including two fresh multi-answer sessions with no score saved before facts are complete. Scoring action compiles. Development push failed with network/DNS errors; connected WSL must push and perform the phone check. Server placeholder checks cover common English generic wording; semantic extraction for other wording and languages still depends on the audio model and needs live validation.

## Approved measured Confidence replacement (2026-10-05)

- Whisper word-timestamp transcription uses verbose_json, temperature=0 and the approved disfluent example prompt. Convex counts fillers, internal word gaps over two seconds and hedge phrases, computes max(0,100−4×fillers−8×pauses−4×hedges), and constructs Heard from those same counts. Pitch estimates and AI Confidence are removed from the live call contract.
- Unchanged gpt-realtime-2.1-mini now returns numeric Clarity/Charisma/Warmth and the same rewrite. Original audio still reaches that feedback call. Scorecard layout and all caps remain unchanged. Each transcription, feedback and feedback retry reserves its own call under the same atomic 30-call limit; feedback retries reuse the transcription. No transcript or timestamp arrays are persisted or logged; WAV is built in memory only.
- Missing/invalid timestamps never yield perfect Confidence. Automated proof covers counts, the strict pause threshold, hedge phrases, seven-line formatting, AI scores failing validation, provider failures, retry reuse, obsolete sessions and shared quota. Synthetic firm/hesitant timed words score 100/76; that does not constitute live proof.
- Development push failed with network/DNS errors. A connected WSL push and the builder's two complete firm/hesitant WhatsApp recordings remain required. Reproduce both real scorecards verbatim in chat and require a measured Confidence gap of at least 20 before acceptance.
- Final local verification: all 77 tests pass, and both the scoring action and mutation modules bundle successfully. No live firm/hesitant scorecards are available yet; development upload remains blocked from this session.

## Approved transcription diagnostics only (2026-10-06)

- Builder authorized logging only rejected transcription word/start/end fields and the exact failed validation rule before any scoring fix. Compound checks now identify the same failing predicate and word index while retaining identical acceptance conditions, error replies and Confidence calculations.
- `practice_transcription_rejected` emits field-allowlisted words and timestamps, fixed rule/condition, numeric index and decoded duration for bounds diagnosis. Known keys and binary strings are redacted; audio, headers, full transcript text and other response fields are excluded. Rejected words go to logs only, never repository files or database records. Successful transcriptions are not logged.
- All 81 tests pass and scoring action bundles. A synthetic rejection verifies the end-within-duration diagnostic; three-second leading silence and trailing silence still pass unchanged. No real failed voice-note response has been reproduced or captured by this session.
- Development push failed with fetch/DNS errors, and access to the local WhatsApp bridge is denied (EPERM). Push diagnostics from connected WSL, retry one phone voice note, and inspect `practice_transcription_rejected`. Show the real words and exact broken rule in chat; wait for the builder's yes before changing validation/scoring.

## Approved empty transcription entry fix (2026-10-06)

- Real phone diagnostics identified an empty word entry as the rejection cause. With the builder's approval, measureWords now skips empty and whitespace-only entries before timestamp validation or counting, keeping all other validation and the Confidence formula unchanged. If no non-empty words remain, the words_nonempty diagnostic rejects the transcript. Original word projections remain available in rejection logs.
- All 86 tests pass and scoring action compiles. Regression tests cover an empty middle entry, whitespace entries, retained-word pauses, all-blank rejection diagnostics and no rejection log on a valid transcript with a blank entry. Tests use synthetic examples only.
- Files saved for the builder's running Ubuntu convex dev process to upload. No bridge access or separate deployment attempted. Await a phone retry; no live success claimed yet.
