# Milestone 1 phone check

This uses the approved development Convex deployment and the installed Hermes bridge. It does not run Hermes's general chat AI.

On the laptop, from this project in WSL:

1. The launcher uses `ffmpeg` from PATH or Hermes's bundled Linux version. Set `PRACTICE_FFMPEG` to another executable path if needed.
2. Install the project dependencies in WSL with `npm ci` so the build tool matches Linux (the starting dependencies were installed on Windows).
3. Run `npm test`.
4. If WSL is not signed into Convex, run `npx convex login` and finish the browser login. Use the account owning the deployment already recorded in `.env.local`.
5. Run `npm run practice:setup`. This generates a separate bridge token, stores it in ignored `.env.local`, sets it on the existing development Convex deployment, and pushes the backend there. The OpenAI key stays in Convex. No new deployment is created.
6. Stop any Hermes WhatsApp gateway, then run `npm run practice:start`. This starts the installed bridge in self-chat mode with its existing laptop session. If a QR appears, link it in WhatsApp → Settings → Linked devices. Sessions stay outside the repository.

On your phone:

1. Open WhatsApp's **Message yourself** chat.
2. Send `1` or `Ask for a raise`.
3. Expect: `I have 2 mins before my next meeting - what are you asking on pay?`
4. Send a voice note under 90 seconds with your raise request and the achievements you want to mention.
5. Expect `Listening to your answer...`. If you omitted the raise amount, agreed goals, delivered outcome or whether the outcome met/exceeded/fell short of expectations, the manager asks for one missing fact. Answer with another voice note under 90 seconds. Facts already supplied should not be requested again. If no goal was agreed, say that explicitly.
6. Once those facts are supplied, expect a seven-line scorecard and a separate **Better version** message using the facts across your answers. Check that nothing is invented. There is no scored follow-up in milestone 1; these questions only collect missing facts.
6. Send `1` to start another one-answer rehearsal.

Leave the laptop running during the test. Ctrl+C stops the practice bridge and removes its temporary media cache. Each processed recording is also deleted on success and failure. Scores and rewrites are saved in Convex; recordings are not.

## Audio delivery comparison before milestone 2

Send `1`, then one complete raise answer containing the request, agreed expectations, delivered outcome and whether it met/exceeded/fell short of expectations, spoken firmly. Wait for the scorecard, whose final line must read `scored from: audio`. Send `1` again and repeat the same complete answer hesitantly, with uncertain pauses and fillers, under 90 seconds. Each test must reach scoring with its own complete recording, rather than scoring a later missing-fact answer. Compare the two full scorecard messages exactly as delivered. A source label proves the selected input path, not successful tone discrimination; equal Confidence scores leave tone sensitivity unproven.

The builder sets the $20 enforced provider limit and `OPENAI_API_KEY` in Convex development and production settings. Do not paste keys into chat. Production shipping and git commits wait for the builder's WhatsApp confirmation, as required by PLAN.md.

## Repeatability check for rubric v1

After pushing the updated backend with `npx convex dev --once`, send `1` and forward one complete raise voice note. Repeat twice, sending `1` before each forward so the question and session facts are identical. Forward the original audio; do not rerecord. Each scorecard should have seven lines, with `Heard:` after Warmth and `scored from: audio` last. Record all three Confidence scores and evidence lines. Pass only when the highest Confidence minus the lowest is at most 5. This check is pending; synthetic tests establish formula repeatability, not model observation repeatability.

## Vague-fact regression phone check

After `npx convex dev --once` succeeds, send `1`. Give a raise request but describe your work only generally. When asked for the agreed goal, say only that several goals were agreed. Expect `What specific goal had we agreed on?`, with no scorecard. Name an actual goal, then an actual delivered outcome when asked. If you have not explicitly compared the outcome with expectations, expect that comparison question before scoring. Explicitly saying you do not know or no goals were ever agreed must be retained as your fact. Repeat from a new `1` selection to confirm the same clarification behavior.

## Measured Confidence firm/hesitant acceptance check

Push with `npx convex dev --once` from connected WSL. Keep `npm run practice:start` running. Send a new `1`, then one firm recording containing your raise request, a specific agreed goal, specific delivered outcome and explicit comparison with expectations. Save the exact seven-line scorecard. Send another new `1` and a hesitant recording of the same factual answer with audible fillers/long pauses. Save that scorecard too. Both should contain a Heard line listing fillers, long pauses and hedges counted in Convex. The hesitant Confidence must be at least 20 below the firm Confidence. Paste both actual replies in chat for verification; do not save real recordings or answers in this repo. Transcription, feedback and retries count toward the existing 30-call hourly allowance. If a fact is missing, the clarification flow continues as before, but the final Confidence describes all accepted voice notes in the current round.

## Whole-round and missing-fact acceptance check

Wait for the already-running Ubuntu Convex dev process to report functions ready. On your phone, send a fresh 1, then supply your raise request and at least one specific goal or outcome in the first recording. Check that a fact supplied in any earlier recording is not requested again. Answer one clarification vaguely on purpose: the app must move to the next still-missing, unasked fact instead of repeating that question. After each missing fact has had its single question, expect a scorecard for the combined answer and a Better version containing a visible gap for any unresolved fact.

For count verification, include a filler in the first note and none in the last. Heard must retain that earlier filler. Long pauses inside a note count, but your time between separate voice notes must not count. Start another fresh 1 and confirm that earlier round facts, questions and counts are cleared. Paste actual replies in chat; real recordings/transcripts do not belong in the repository.

## Local SCORING DIAGNOSTIC output

Leave Convex dev running so it uploads the backend changes. In the separate practice:start terminal, use Ctrl+C and then `npm run practice:start` to load the updated worker. After a fresh voice note is processed, that terminal prints a SCORING DIAGNOSTIC block containing full Whisper text, all word timestamps, up to five largest raw gaps and the actual counted fillers/long pauses/hedges. Copy that block for diagnosis; it is separate from the unchanged WhatsApp messages. The block concerns the current note; each processed note prints its own block, while the scorecard can represent cumulative round counts. Diagnostic text is returned only to the authenticated laptop and is not saved in Convex or repository files.
