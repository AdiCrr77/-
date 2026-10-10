# WhatsApp Raise Coach

## 1. What it is

A WhatsApp voice-note coach for asking for a raise. Send a voice note and get Clarity, Confidence, Persuasion and Warmth scores, each out of 100, plus a better version of your own words.

The current practice flow supports asking for a raise. Practice happens in WhatsApp, with no web chat or separate login.

## 2. How a round works

1. Open the connected WhatsApp account's **Message yourself** chat. An allowed participant can use a direct chat with that account.
2. Send `1` or `Ask for a raise`.
3. The demo manager opens: “I have 2 mins before my next meeting - what are you asking on pay?”
4. Reply with a voice note of at most 90 seconds. Describe your raise request, agreed goals, delivered work and how the result compared with expectations.
5. You receive “Listening to your answer...”. If a fact is missing, the manager asks for one fact at a time. Reply with another voice note. You can explicitly say that no goal was agreed or that you do not know a detail.
6. Each missing fact is asked about at most once. The app uses all accepted voice notes in the round, then scores the available answer. Unresolved details appear as bracketed fill-ins in the better version.
7. You receive a scorecard with the four category scores, the rounded overall score and a Heard line showing counted fillers, long pauses and hedges. A separate **Better version** message gives you wording to practise, using your supplied facts.
8. Send `1` to begin a fresh round. The current flow collects missing facts and scores one combined answer; scored follow-up conversations are still planned.

## 3. How scoring works

The raise checks follow [SCORING_CHECKS.md](SCORING_CHECKS.md). Clarity, Persuasion and Warmth judge the words across the complete round. Confidence measures delivery from transcription timestamps.

### Clarity

Four checks ask whether you state the ask within the first two sentences of your answer, include the key facts, make one clear request and avoid repetition or circling back. Each failed check costs 25 points. A repeated request is not a different request, but repetition can fail the repetition check. Numbers are required only when you supplied them.

### Confidence

Convex starts at 100 and subtracts 4 points per filler, 8 per long pause and 4 per hedge, with a minimum of 0. Fillers include “um”, “uh” and “er”; hedges include “I think”, “sort of”, “kind of”, “maybe”, “perhaps” and “possibly”.

A long pause is a gap between words strictly over 1.2 seconds or a word lasting strictly over 1.0 second. Leading silence, trailing silence and time between separate voice notes do not count. Counts are added across the accepted notes in the round.

### Persuasion

Four checks ask whether you:

- Name the work you delivered.
- Explain why it mattered to the team or business.
- Give a basis for judging the raise, such as a pay band, new responsibilities or comparable roles.
- Link your results to the ask.

Each failed check costs 25 points. Naming a target or a delivered number alone does not explain business value or establish a fair benchmark.

### Warmth

Four checks look for appreciation, a shared goal or progress, acknowledgment of the manager's decision process or constraints, and an invitation for their view.

Each check earns 25 points for clear expression, 12.5 for partial expression and 0 when missing. The total is rounded to a whole number. Partial expression includes polite acknowledgment without thanks, mentioning the team's result without shared framing, soft framing without explicit decision acknowledgment, or an open ending without a direct invitation question.

An endorsed personal insult sets Warmth to 0. Factual disagreement, naming a shortfall and holding your ground are not automatically disrespectful. Merely avoiding insults does not earn positive Warmth points.

### Evidence and overall

Positive content judgments require matching transcript evidence. Evidence matching ignores punctuation, capitals and extra spaces, while preserving the words, their order and numbers. The checks assess what you said; they do not independently verify your achievements.

Overall is the rounded average of the four category scores. The better version is an edit of your answer, not extra evidence for scoring. It uses bracketed fill-ins for missing details rather than inventing facts.

## 4. Stack

- **Hermes WhatsApp bridge:** receives voice notes and sends replies from a laptop with a linked WhatsApp session. Local ffmpeg converts recordings for processing.
- **Convex:** owns session state, stored scores and rewrites, validation, call limits and the actions that contact OpenAI.
- **OpenAI Whisper:** transcribes audio with word timestamps for the Confidence calculation.
- **OpenAI scoring model:** the current text-scoring implementation uses `gpt-5.4-mini-2026-03-17` to judge transcript content and write the better version. The request is capped at 500 output tokens. Transcription, scoring and retries share a limit of 30 AI calls per rolling hour.

Temporary recordings are deleted after processing, including failures. WhatsApp session files stay on the laptop outside this repository.

## 5. Run it locally

You need Node.js, npm, an installed Hermes WhatsApp bridge, ffmpeg and a Convex development deployment. On Windows, run the project in WSL. The launcher can also use Hermes's bundled Linux ffmpeg.

Install dependencies and run the tests:

```bash
npm ci
npm test
```

Sign in to Convex and configure the development deployment for this checkout:

```bash
npx convex login
npx convex dev --once
```

Keep the generated deployment settings in the ignored `.env.local` file. Configure the OpenAI credential in the Convex development environment through the dashboard; do not put it in local source files. Production credentials are configured separately in Convex.

Run the setup script from `package.json`:

```bash
npm run practice:setup
```

This creates or reuses a separate bridge credential, stores it in ignored `.env.local`, configures it in the existing development deployment and uploads the backend.

Stop any existing Hermes WhatsApp gateway, then start practice:

```bash
npm run practice:start
```

If a pairing QR appears, use WhatsApp → Settings → Linked devices. Keep the laptop process running while you practise. Ctrl+C stops it.

For additional participants, put `PRACTICE_ALLOWED_NUMBERS` in the project's local `.env` file. Use a comma-separated list of international digits, without plus signs or spaces. Leave it unset or empty for self-chat only. Pair WhatsApp in self-chat mode before enabling additional participants, then restart `npm run practice:start`. Group chats are disabled.

Both `.env` and `.env.local` are ignored by Git. Keep credentials, participant numbers, WhatsApp sessions, recordings and real answers out of commits.

The production deployment command from `package.json` is:

```bash
npm run deploy
```

This runs `convex deploy`; a Git push does not deploy the app. Verify the core round on a phone in WhatsApp before production deployment.
