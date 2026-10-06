# AGENTS.md

## 1. How the product works
Interface: WhatsApp on the user's phone. The one thing they do there: pick one of four situations, then answer the practice question with a voice note.
Business logic: The four situations are: ask for a raise, explain a work delay, speak up at a party, clarity in your relationship. The demo person speaks first, except at the party, where the app prompts the user to start. When a voice note arrives, a Convex action sends it to the AI together with the situation, the current question and the facts the user has already given. If a fact the situation needs is missing, ask only for that fact. Otherwise the AI scores Clarity, Confidence, Charisma and Warmth, each out of 100, using the definitions in PRODUCT.md. Overall = the average of the four. It writes a better version of the user's own words, and the demo person asks the next follow-up.
Stopping rule: the session ends after 2 answers in a row each score 85 or more. Any answer under 85 resets the count to 0. Example: scores 70, 86, 79, 88, 90 end the session at 90.
A follow-up is a question the demo person asks after a scored answer. Questions asking for a missing fact do not count. The session ends after the 8th follow-up is answered.
"stop", or 2 minutes with no new voice note after the app's last message, ends the session. The timer is paused while an answer is being scored, and a new voice note restarts it.
The takeaway on every ending is the same: the AI's rewrite of the user's highest-scoring answer in that session.
If the user says "stop" or goes silent for 2 minutes before any answer is scored, send "No answer to score yet. Send a voice note anytime to start again." After a session ends, the next message starts a fresh session with the intro. If the user sends "delete", erase their saved scores, facts and rewrites, and reply "Your history is deleted."
Database: each user's WhatsApp number, the situation they picked, the facts they gave, every answer's four scores and overall, the better versions, and the promotion month if they give it. Voice notes are deleted after scoring, and also when scoring fails.
Third party:
- WhatsApp: Hermes on my laptop, connected to my own WhatsApp number. It receives and sends messages. Switch to a WhatsApp Business number later. Any login or session file stays on my laptop, never in the repo.
- OpenAI: scores the voice note and writes the better version. Key in Convex environment variables.
Not in v1: login, calendar access, reminders, any web chat.

When I report a bug, I'll name the part. Look there first, and tell me if you think I named the wrong one.

## 2. How we work
- Read IDEA_SCOPE.md, PRODUCT.md, PLAN.md and PROGRESS.md before anything else, and DESIGN.md before any message work.
- Before writing code, tell me in two or three sentences what you think I'm after, then your plan. Wait for my yes. Don't guess.
- One milestone at a time: the next one in PLAN.md, working end to end. Nothing outside it.
- If I ask for something new mid-milestone, add it to the parked list in PLAN.md and carry on.
- Never say "done" until you've seen it work and told me how to check it on my phone in WhatsApp.
- When I report a bug, find the cause before changing anything. Fix only that.
- When we add something new, write tests so what already works doesn't break. When I drop a feature, drop its tests.
- Build and test only in WhatsApp. No web test page for the practice flow.
- After I confirm a milestone works: commit, push, then deploy, and add one line to PROGRESS.md.
- Never put a key or password in code, in a VITE_ variable or in a committed file.
- The demo person always stays in character. Scores and the better version come in a separate message.
- At the party, the user speaks first. In the other three situations, the demo person speaks first.

## 3. Shipping
Live link: [ your .convex.site link, after the first deploy ] (a landing page with the WhatsApp button)
Repo: https://github.com/AdiCrr77/- , public
Deploy: npm run deploy. A push never deploys by itself.
Keys: every key lives in Convex environment variables, set for dev and for prod. Never in code, a VITE_ variable or a committed file. Never ask me to paste it into chat.
.gitignore covers .env.local.
Real people's data (voice notes, phone numbers, their answers) never goes in the repo, not even as a test file. Tests use made-up examples.
Every limit and every "is this allowed" check happens in a Convex function.
Before I share the link: I open it on my phone, logged out, on mobile data, and do the core flow once.

## 4. The AI call
Model: GPT-Realtime-2.1 Mini (takes audio). GPT-6.1 Sol does not take audio, so it is not used for scoring.
What goes in, and its limit: one voice note, at most 90 seconds.
What comes out: text only. Ask the model for text replies, never audio replies.
Where it runs: a Convex action. Never in the interface.
Key: in Convex environment variables, dev and prod.
Reply cap: max_output_tokens 500
Calls cap: at most 30 AI calls an hour across the app (Convex rate limiter)
Provider limit: a hard monthly limit of $20, set by me in OpenAI (Organization limits, Spend, Enforce a hard limit)
When a cap is hit or the call fails: send "Busy right now. Try again in a few minutes." If the monthly limit is reached: send "Practice is paused for now. Back soon."
Login: none in v1. The WhatsApp number is enough.
The AI must never: invent facts the user didn't give, give medical, legal or therapy advice, or go beyond the four situations.