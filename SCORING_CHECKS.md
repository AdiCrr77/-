# Persuasion and Warmth checks

- Clarity: is the message easy to follow (ask first, key facts, one ask, no repetition). Judged from words.
- Confidence: how you sound. Measured from the audio: fillers, long pauses, hedges.
- Persuasion: what you say to make your case. Judged from words only.
- Warmth: how you treat the other person. Judged from words only.

Scoring specification. Clarity, Confidence, better-version rules, scorecard layout, model and caps remain unchanged.

## Shared scoring and evidence rules

- Evaluate the complete answer round's accepted transcripts in chronological order. Use only words in those transcripts, not delivery, pitch, pauses, fillers, body language or guessed intentions.
- Each scenario has four Persuasion checks and four Warmth checks. Judge each check independently. Each category's score is `100 - 25 × failed checks`: 100, 75, 50, 25 or 0.
- Every check has a pass/fail judgment and transcript evidence. For a pass, quote wording that satisfies the stated criterion. For an explicit failure, quote the wording that violates it.
- If a required detail is absent, fail that check and mark the reason as missing evidence. Use the complete evaluated answer as the evidence quote; a short unrelated quote cannot prove an omission. That quote can be taken from the already available transcript, rather than asking the model to repeat it within the existing reply cap.
- Reuse Clarity's quote matching: ignore punctuation, capitals and extra spaces, but preserve words, their order and numbers. Keep the original quoted wording in diagnostics. No invented quotations or quote-length penalty.
- Quote matching verifies the source of evidence, not its meaning. The judgment must also satisfy the check's criterion; finding the word "respect" or "because" alone does not establish a pass.
- A pass without matching evidence fails. An explicit failure without matching evidence is unsupported; do not invent replacement evidence. Missing evidence remains a failure when the required detail is absent from the complete answer.
- Every Warmth check requires a positive behavior explicitly expressed in the transcript. Merely avoiding insults, contempt, blame, invented motives, mind-reading or demands for private information earns no check pass. A contradictory statement can invalidate the claimed positive behavior; it is not evidence of appreciation or choice simply because those words appear.
- Facts stated in the transcript count as stated facts; these checks do not verify them against the outside world. Do not require a number, shared experience, promise or achievement the speaker has not supplied.
- Firm requests, factual disagreement, missed targets and personal boundaries are not automatically disrespectful. Do not reward compliance with the other person's wishes.
- Examples below are made up. Each line demonstrates only its own check, not a complete answer or a guaranteed category score. "Fail" means the pass criterion is not met, including when required wording is absent.

## Warmth insult cap

This is a separate rule, not one of the four positive checks. In every scenario, any insult spoken by the user about the listener or another person or group makes all four Warmth checks fail: Warmth = 0. Quote the exact insult as evidence for the override. Positive wording elsewhere cannot cancel it.

An insult is an explicit degrading personal label or attack, such as "You're an idiot" or "The team is useless." Factual disagreement, naming a missed deadline, expressing a boundary or describing a shortfall is not an insult. Clearly reporting someone else's insult without endorsing it does not trigger the cap.

## 1. Asking for a raise

AI must answer all eight questions every time using fixed required keys P1-P4 and W1-W4. Every answer has `pass` (yes/no as a boolean) and `quote`. For missing evidence, a no uses `quote: "MISSING"`; diagnostics substitute the full answer. Other quotes contain at most 15 words and must match the transcript ignoring punctuation, capitals and extra spaces. Each no costs 25 points. Any insult sets Warmth to 0.

### Persuasion

| Check | Pass/fail criterion | Example that passes | Example that fails |
| --- | --- | --- | --- |
| P1: Did they name what they delivered? | Pass for yes, supported by transcript wording. Fail for no; use "MISSING" when the required evidence is absent. | "I rebuilt the onboarding guide and trained the two new starters." | "I've been here a while and worked really hard." |
| P2: Did they say why it mattered to the team or business? | Pass for yes, supported by transcript wording. Fail for no; use "MISSING" when the required evidence is absent. | "The guide lets new starters resolve routine tickets without waiting for a senior colleague." | "I wrote a new guide." |
| P3: Did they say how the raise should be judged (pay band, new responsibilities, comparable roles)? | Pass for yes, supported by transcript wording. Fail for no; use "MISSING" when the required evidence is absent. | "Please assess this request against the senior-role pay band because I now handle that role's training responsibilities." | "Our target was 30 tickets; I resolved 40." |
| P4: Did they link their results to the ask? | Pass for yes, supported by transcript wording. Fail for no; use "MISSING" when the required evidence is absent. | "I'm requesting a 12% raise because I'm now training starters as well as handling my own tickets." | "I'd like a 12% raise. I train starters." |

### Warmth

| Check | Pass/fail criterion | Example that passes | Example that fails |
| --- | --- | --- | --- |
| W1: Did they thank the manager or appreciate their help? | Pass for yes, supported by transcript wording. Fail for no; use "MISSING" when the required evidence is absent. | "Thank you for helping me take on the training responsibilities." | "I'd like a 12% raise." |
| W2: Did they frame a goal or progress as shared ("we")? | Pass for yes, supported by transcript wording. Fail for no; use "MISSING" when the required evidence is absent. | "We agreed on the onboarding goal, and we're making progress toward it." | "I delivered 40 tickets." |
| W3: Did they acknowledge the manager's decision process or constraints? | Pass for yes, supported by transcript wording. Fail for no; use "MISSING" when the required evidence is absent. | "I understand you need to consider the pay band before deciding." | "I'd like you to approve the raise." |
| W4: Did they invite the manager's view? | Pass for yes, supported by transcript wording. Fail for no; use "MISSING" when the required evidence is absent. | "I'd like to hear how you assess my contribution against the role." | "That is my case for the raise." |

## 2. Explaining a work delay

### Persuasion

| Check | Pass/fail criterion | Example that passes | Example that fails |
| --- | --- | --- | --- |
| P1: Concrete progress | Pass if the speaker names completed work or the remaining work. A supplied percentage can support this, but is not required. Fail for a generic status without either. | "The draft is complete; the final data check remains." | "It's progressing." |
| P2: Cause connected to the delay | Pass if the speaker names a specific blocker and explicitly explains which work it prevents or slows. Fail if the reason is vague or its effect on the work is unstated. | "The missing export prevents me from checking the final totals." | "There have been some issues." |
| P3: An action to move the work forward | Pass if the speaker names an action they have taken or will take to address the blocker or advance the remaining work. Fail if they only describe the problem or wait without an action. | "I've requested the export and am checking the unaffected sections while it arrives." | "I'm waiting for things to improve." |
| P4: A reason the revised commitment is credible | Pass if the speaker connects the revised delivery time to remaining work or states the dependency that makes it conditional. Fail for an unsupported delivery promise. | "The remaining check takes two hours, so I can deliver by 4 p.m. if the export arrives by noon." | "I'll definitely finish by 4 p.m., somehow." |

### Warmth

| Check | Pass/fail criterion | Example that passes | Example that fails |
| --- | --- | --- | --- |
| W1: Own responsibility | Pass if the speaker explicitly owns their communication, task or recovery action. Fail if ownership is not expressed. | "I should have flagged this earlier; I'll send the revised status today." | "The export has not arrived." |
| W2: Acknowledges the recipient's impact | Pass if the speaker explicitly names how the delay affects the recipient's work, plans or time. Fail if that acknowledgment is absent or dismissive. | "I know this leaves you less time to review before the client call." | "The data will arrive on Tuesday." |
| W3: Appreciation for help or patience | Pass if the speaker explicitly thanks the recipient or collaborators, or names help or patience they appreciate. Fail if no appreciation is expressed. | "Thanks for keeping me updated while the export is being prepared." | "The export is being prepared." |
| W4: Makes room for coordination | Pass if the speaker explicitly invites the recipient to state a priority or constraint relevant to the recovery plan. Fail if this invitation is absent or coordination is refused. | "Please tell me if the client needs one section first so I can prioritize it." | "I'll check the remaining sections next." |

## 3. Dating: getting clarity on the relationship

### Persuasion

| Check | Pass/fail criterion | Example that passes | Example that fails |
| --- | --- | --- | --- |
| P1: A concrete reason for raising the topic | Pass if the speaker names a shared experience, current arrangement or specific event that prompted the conversation. Fail if their reason is only vague intensity. | "We've been seeing each other most weekends for three months, and I'd like to talk about where this is going." | "This whole thing is a lot." |
| P2: States their own desired direction | Pass if the speaker explicitly states what relationship arrangement or direction they want. Fail if they only demand that the other person choose. | "I'd like us to date exclusively." | "You need to decide what we're doing." |
| P3: Explains why that direction matters to them | Pass if the speaker links the desired direction to their own stated feeling, preference or practical need. Fail if the link is absent or relies solely on what everybody supposedly does. | "I'd like exclusivity because I want to focus on building one relationship." | "Everybody dates exclusively by now." |
| P4: Makes the proposed arrangement concrete | Pass if the speaker explains what their proposed direction would mean in practice. Fail if the proposed arrangement remains an undefined label. | "By exclusive, I mean neither of us dates other people." | "I want something serious, whatever that means." |

### Warmth

| Check | Pass/fail criterion | Example that passes | Example that fails |
| --- | --- | --- | --- |
| W1: Appreciation for the connection | Pass if the speaker explicitly names something they appreciate about the person, their time together or their openness. Fail if no appreciation is expressed. | "I've really enjoyed the time we've spent getting to know each other." | "I'd like us to date exclusively." |
| W2: Respects the other person's choice | Pass if the speaker explicitly allows a different answer without guilt, threats or pressure to prove affection. A personal boundary can pass. Fail if that choice is denied or acknowledgment is absent. | "You don't have to want exclusivity; if we want different things, I may choose to step back." | "I want an exclusive relationship." |
| W3: Names the other person's stated interest | Pass if the speaker explicitly acknowledges a preference, need or concern they say the other person has expressed. Fail if no such acknowledgment appears. Do not infer the person's interest from silence. | "You said keeping time for your friends matters to you, and I want to respect that." | "Having time with my friends matters to me." |
| W4: Invites their perspective without forcing an immediate answer | Pass if the speaker explicitly invites the other person's view and does not demand an immediate decision. Fail if the invitation is absent or paired with that demand. | "How do you see us? You can take some time to think before answering." | "That's how I see our relationship." |

## 4. Social/party: starting a conversation

The user speaks first. Do not require an earlier question or reply from the demo person.

### Persuasion

| Check | Pass/fail criterion | Example that passes | Example that fails |
| --- | --- | --- | --- |
| P1: A shared opening topic | Pass if the speaker introduces a topic tied to the gathering, host, activity or an explicitly stated common interest. Fail for an opening with no such connection. | "This playlist is great; have you heard this band live?" | "Here is my opinion about office printer maintenance." |
| P2: A specific personal contribution | Pass if the speaker shares a concrete personal detail or observation relevant to that topic. Fail for generic self-description or an unrelated boast. | "I started learning salsa last month, so this song caught my attention." | "I'm a very interesting person." |
| P3: An invitation to contribute more than yes or no | Pass if the speaker asks an open question or explicitly invites a story, preference or opinion. Fail if the only invitation is closed or none appears. | "What got you into dancing?" | "Do you dance?" |
| P4: Connects their contribution to the invitation | Pass if the speaker links their own detail or observation to what they invite the other person to share, keeping one conversational thread. Fail if the personal contribution and invitation jump between unrelated topics. | "I'm learning salsa; what helped you when you first started dancing?" | "I'm learning salsa; what's your opinion of tax policy?" |

### Warmth

| Check | Pass/fail criterion | Example that passes | Example that fails |
| --- | --- | --- | --- |
| W1: Friendly greeting | Pass if the speaker directly greets or welcomes the person, with wording such as "hi", "hello" or "nice to meet you." Fail if no greeting or welcome appears. | "Hi, I'm Sam. Nice to meet you." | "How do you know the host?" |
| W2: Respects whether they want to engage | Pass if the speaker explicitly gives the other person room to decline or continue what they were doing, without pressuring them. Fail if that room is absent or denied. | "If you're waiting for someone, no worries; I just wanted to say hello." | "I'd like to talk for a minute." |
| W3: Shows interest in their perspective | Pass if the speaker explicitly invites the person's own experience, interests or opinion without declaring it unimportant. Fail if that invitation is absent or dismissive. | "What do you enjoy about these gatherings?" | "I enjoy these gatherings." |
| W4: Appreciation or a specific positive observation | Pass if the speaker explicitly thanks the person or offers a specific positive observation about the shared setting or something the person has chosen to share. Fail if none appears. Do not require an earlier reply from the person. | "It's lovely to meet someone else who enjoys this music." | "This is the song playing right now." |
