// Criteria and examples copied verbatim from SCORING_CHECKS.md.
export const FEEDBACK_RUBRICS = {
  "raise": {
    "persuasion": [
      {
        "name": "P1: Did they name what they delivered?",
        "criterion": "Pass for yes, supported by transcript wording. Fail for no; use \"MISSING\" when the required evidence is absent.",
        "passExample": "I rebuilt the onboarding guide and trained the two new starters.",
        "failExample": "I've been here a while and worked really hard."
      },
      {
        "name": "P2: Did they say why it mattered to the team or business?",
        "criterion": "Pass for yes, supported by transcript wording. Fail for no; use \"MISSING\" when the required evidence is absent.",
        "passExample": "The guide lets new starters resolve routine tickets without waiting for a senior colleague.",
        "failExample": "I wrote a new guide."
      },
      {
        "name": "P3: Did they say how the raise should be judged (pay band, new responsibilities, comparable roles)?",
        "criterion": "Pass for yes, supported by transcript wording. Fail for no; use \"MISSING\" when the required evidence is absent.",
        "passExample": "Please assess this request against the senior-role pay band because I now handle that role's training responsibilities.",
        "failExample": "Our target was 30 tickets; I resolved 40."
      },
      {
        "name": "P4: Did they link their results to the ask?",
        "criterion": "Pass for yes, supported by transcript wording. Fail for no; use \"MISSING\" when the required evidence is absent.",
        "passExample": "I'm requesting a 12% raise because I'm now training starters as well as handling my own tickets.",
        "failExample": "I'd like a 12% raise. I train starters."
      }
    ],
    "warmth": [
      {
        "name": "W1: Did they thank the manager or appreciate their help?",
        "criterion": "Pass for yes, supported by transcript wording. Fail for no; use \"MISSING\" when the required evidence is absent.",
        "passExample": "Thank you for helping me take on the training responsibilities.",
        "failExample": "I'd like a 12% raise."
      },
      {
        "name": "W2: Did they frame a goal or progress as shared (\"we\")?",
        "criterion": "Pass for yes, supported by transcript wording. Fail for no; use \"MISSING\" when the required evidence is absent.",
        "passExample": "We agreed on the onboarding goal, and we're making progress toward it.",
        "failExample": "I delivered 40 tickets."
      },
      {
        "name": "W3: Did they acknowledge the manager's decision process or constraints?",
        "criterion": "Pass for yes, supported by transcript wording. Fail for no; use \"MISSING\" when the required evidence is absent.",
        "passExample": "I understand you need to consider the pay band before deciding.",
        "failExample": "I'd like you to approve the raise."
      },
      {
        "name": "W4: Did they invite the manager's view?",
        "criterion": "Pass for yes, supported by transcript wording. Fail for no; use \"MISSING\" when the required evidence is absent.",
        "passExample": "I'd like to hear how you assess my contribution against the role.",
        "failExample": "That is my case for the raise."
      }
    ]
  },
  "delay": {
    "persuasion": [
      {
        "name": "P1: Concrete progress",
        "criterion": "Pass if the speaker names completed work or the remaining work. A supplied percentage can support this, but is not required. Fail for a generic status without either.",
        "passExample": "The draft is complete; the final data check remains.",
        "failExample": "It's progressing."
      },
      {
        "name": "P2: Cause connected to the delay",
        "criterion": "Pass if the speaker names a specific blocker and explicitly explains which work it prevents or slows. Fail if the reason is vague or its effect on the work is unstated.",
        "passExample": "The missing export prevents me from checking the final totals.",
        "failExample": "There have been some issues."
      },
      {
        "name": "P3: An action to move the work forward",
        "criterion": "Pass if the speaker names an action they have taken or will take to address the blocker or advance the remaining work. Fail if they only describe the problem or wait without an action.",
        "passExample": "I've requested the export and am checking the unaffected sections while it arrives.",
        "failExample": "I'm waiting for things to improve."
      },
      {
        "name": "P4: A reason the revised commitment is credible",
        "criterion": "Pass if the speaker connects the revised delivery time to remaining work or states the dependency that makes it conditional. Fail for an unsupported delivery promise.",
        "passExample": "The remaining check takes two hours, so I can deliver by 4 p.m. if the export arrives by noon.",
        "failExample": "I'll definitely finish by 4 p.m., somehow."
      }
    ],
    "warmth": [
      {
        "name": "W1: Own responsibility",
        "criterion": "Pass if the speaker explicitly owns their communication, task or recovery action. Fail if ownership is not expressed.",
        "passExample": "I should have flagged this earlier; I'll send the revised status today.",
        "failExample": "The export has not arrived."
      },
      {
        "name": "W2: Acknowledges the recipient's impact",
        "criterion": "Pass if the speaker explicitly names how the delay affects the recipient's work, plans or time. Fail if that acknowledgment is absent or dismissive.",
        "passExample": "I know this leaves you less time to review before the client call.",
        "failExample": "The data will arrive on Tuesday."
      },
      {
        "name": "W3: Appreciation for help or patience",
        "criterion": "Pass if the speaker explicitly thanks the recipient or collaborators, or names help or patience they appreciate. Fail if no appreciation is expressed.",
        "passExample": "Thanks for keeping me updated while the export is being prepared.",
        "failExample": "The export is being prepared."
      },
      {
        "name": "W4: Makes room for coordination",
        "criterion": "Pass if the speaker explicitly invites the recipient to state a priority or constraint relevant to the recovery plan. Fail if this invitation is absent or coordination is refused.",
        "passExample": "Please tell me if the client needs one section first so I can prioritize it.",
        "failExample": "I'll check the remaining sections next."
      }
    ]
  },
  "dating": {
    "persuasion": [
      {
        "name": "P1: A concrete reason for raising the topic",
        "criterion": "Pass if the speaker names a shared experience, current arrangement or specific event that prompted the conversation. Fail if their reason is only vague intensity.",
        "passExample": "We've been seeing each other most weekends for three months, and I'd like to talk about where this is going.",
        "failExample": "This whole thing is a lot."
      },
      {
        "name": "P2: States their own desired direction",
        "criterion": "Pass if the speaker explicitly states what relationship arrangement or direction they want. Fail if they only demand that the other person choose.",
        "passExample": "I'd like us to date exclusively.",
        "failExample": "You need to decide what we're doing."
      },
      {
        "name": "P3: Explains why that direction matters to them",
        "criterion": "Pass if the speaker links the desired direction to their own stated feeling, preference or practical need. Fail if the link is absent or relies solely on what everybody supposedly does.",
        "passExample": "I'd like exclusivity because I want to focus on building one relationship.",
        "failExample": "Everybody dates exclusively by now."
      },
      {
        "name": "P4: Makes the proposed arrangement concrete",
        "criterion": "Pass if the speaker explains what their proposed direction would mean in practice. Fail if the proposed arrangement remains an undefined label.",
        "passExample": "By exclusive, I mean neither of us dates other people.",
        "failExample": "I want something serious, whatever that means."
      }
    ],
    "warmth": [
      {
        "name": "W1: Appreciation for the connection",
        "criterion": "Pass if the speaker explicitly names something they appreciate about the person, their time together or their openness. Fail if no appreciation is expressed.",
        "passExample": "I've really enjoyed the time we've spent getting to know each other.",
        "failExample": "I'd like us to date exclusively."
      },
      {
        "name": "W2: Respects the other person's choice",
        "criterion": "Pass if the speaker explicitly allows a different answer without guilt, threats or pressure to prove affection. A personal boundary can pass. Fail if that choice is denied or acknowledgment is absent.",
        "passExample": "You don't have to want exclusivity; if we want different things, I may choose to step back.",
        "failExample": "I want an exclusive relationship."
      },
      {
        "name": "W3: Names the other person's stated interest",
        "criterion": "Pass if the speaker explicitly acknowledges a preference, need or concern they say the other person has expressed. Fail if no such acknowledgment appears. Do not infer the person's interest from silence.",
        "passExample": "You said keeping time for your friends matters to you, and I want to respect that.",
        "failExample": "Having time with my friends matters to me."
      },
      {
        "name": "W4: Invites their perspective without forcing an immediate answer",
        "criterion": "Pass if the speaker explicitly invites the other person's view and does not demand an immediate decision. Fail if the invitation is absent or paired with that demand.",
        "passExample": "How do you see us? You can take some time to think before answering.",
        "failExample": "That's how I see our relationship."
      }
    ]
  },
  "party": {
    "persuasion": [
      {
        "name": "P1: A shared opening topic",
        "criterion": "Pass if the speaker introduces a topic tied to the gathering, host, activity or an explicitly stated common interest. Fail for an opening with no such connection.",
        "passExample": "This playlist is great; have you heard this band live?",
        "failExample": "Here is my opinion about office printer maintenance."
      },
      {
        "name": "P2: A specific personal contribution",
        "criterion": "Pass if the speaker shares a concrete personal detail or observation relevant to that topic. Fail for generic self-description or an unrelated boast.",
        "passExample": "I started learning salsa last month, so this song caught my attention.",
        "failExample": "I'm a very interesting person."
      },
      {
        "name": "P3: An invitation to contribute more than yes or no",
        "criterion": "Pass if the speaker asks an open question or explicitly invites a story, preference or opinion. Fail if the only invitation is closed or none appears.",
        "passExample": "What got you into dancing?",
        "failExample": "Do you dance?"
      },
      {
        "name": "P4: Connects their contribution to the invitation",
        "criterion": "Pass if the speaker links their own detail or observation to what they invite the other person to share, keeping one conversational thread. Fail if the personal contribution and invitation jump between unrelated topics.",
        "passExample": "I'm learning salsa; what helped you when you first started dancing?",
        "failExample": "I'm learning salsa; what's your opinion of tax policy?"
      }
    ],
    "warmth": [
      {
        "name": "W1: Friendly greeting",
        "criterion": "Pass if the speaker directly greets or welcomes the person, with wording such as \"hi\", \"hello\" or \"nice to meet you.\" Fail if no greeting or welcome appears.",
        "passExample": "Hi, I'm Sam. Nice to meet you.",
        "failExample": "How do you know the host?"
      },
      {
        "name": "W2: Respects whether they want to engage",
        "criterion": "Pass if the speaker explicitly gives the other person room to decline or continue what they were doing, without pressuring them. Fail if that room is absent or denied.",
        "passExample": "If you're waiting for someone, no worries; I just wanted to say hello.",
        "failExample": "I'd like to talk for a minute."
      },
      {
        "name": "W3: Shows interest in their perspective",
        "criterion": "Pass if the speaker explicitly invites the person's own experience, interests or opinion without declaring it unimportant. Fail if that invitation is absent or dismissive.",
        "passExample": "What do you enjoy about these gatherings?",
        "failExample": "I enjoy these gatherings."
      },
      {
        "name": "W4: Appreciation or a specific positive observation",
        "criterion": "Pass if the speaker explicitly thanks the person or offers a specific positive observation about the shared setting or something the person has chosen to share. Fail if none appears. Do not require an earlier reply from the person.",
        "passExample": "It's lovely to meet someone else who enjoys this music.",
        "failExample": "This is the song playing right now."
      }
    ]
  }
};
export const WARMTH_INSULT_CAP = "This is a separate rule, not one of the four positive checks. In every scenario, any insult spoken by the user about the listener or another person or group makes all four Warmth checks fail: Warmth = 0. Quote the exact insult as evidence for the override. Positive wording elsewhere cannot cancel it.\n\nAn insult is an explicit degrading personal label or attack, such as \"You're an idiot\" or \"The team is useless.\" Factual disagreement, naming a missed deadline, expressing a boundary or describing a shortfall is not an insult. Clearly reporting someone else's insult without endorsing it does not trigger the cap.";
export const FEEDBACK_EVIDENCE_RULES = "- Evaluate the complete answer round's accepted transcripts in chronological order. Use only words in those transcripts, not delivery, pitch, pauses, fillers, body language or guessed intentions.\n- Each scenario has four Persuasion checks and four Warmth checks. Judge each check independently. Each category's score is `100 - 25 × failed checks`: 100, 75, 50, 25 or 0.\n- Every check has a pass/fail judgment and transcript evidence. For a pass, quote wording that satisfies the stated criterion. For an explicit failure, quote the wording that violates it.\n- If a required detail is absent, fail that check and mark the reason as missing evidence. Use the complete evaluated answer as the evidence quote; a short unrelated quote cannot prove an omission. That quote can be taken from the already available transcript, rather than asking the model to repeat it within the existing reply cap.\n- Reuse Clarity's quote matching: ignore punctuation, capitals and extra spaces, but preserve words, their order and numbers. Keep the original quoted wording in diagnostics. No invented quotations or quote-length penalty.\n- Quote matching verifies the source of evidence, not its meaning. The judgment must also satisfy the check's criterion; finding the word \"respect\" or \"because\" alone does not establish a pass.\n- A pass without matching evidence fails. An explicit failure without matching evidence is unsupported; do not invent replacement evidence. Missing evidence remains a failure when the required detail is absent from the complete answer.\n- Every Warmth check requires a positive behavior explicitly expressed in the transcript. Merely avoiding insults, contempt, blame, invented motives, mind-reading or demands for private information earns no check pass. A contradictory statement can invalidate the claimed positive behavior; it is not evidence of appreciation or choice simply because those words appear.\n- Facts stated in the transcript count as stated facts; these checks do not verify them against the outside world. Do not require a number, shared experience, promise or achievement the speaker has not supplied.\n- Firm requests, factual disagreement, missed targets and personal boundaries are not automatically disrespectful. Do not reward compliance with the other person's wishes.\n- Examples below are made up. Each line demonstrates only its own check, not a complete answer or a guaranteed category score. \"Fail\" means the pass criterion is not met, including when required wording is absent.";
