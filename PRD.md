# Executive Assistant via iMessage

## Product Requirements Document

## 1. Summary

Build a lightweight executive assistant MVP that a user can control entirely through iMessage. The assistant should help the user stay on top of email and iMessage communication while away from their inbox or laptop. The MVP should focus on fast triage, drafting, and safe execution of common communication tasks.

The product should feel like texting a highly capable chief of staff:

- The user sends a plain-English request over iMessage.
- The assistant understands intent, gathers the relevant context from email or messages, and responds with a concise recommendation or draft.
- The assistant can take action on the user’s behalf, with confirmations for higher-risk actions.

## 2. Problem

Busy operators, founders, and executives often manage communication in fragmented moments: between meetings, in transit, or away from their main workstation. Email and iMessage both demand attention, but existing tools force users to context-switch between apps and manually triage everything.

The opportunity is to create a single conversational control surface, iMessage, where the user can:

- ask what needs attention,
- draft or send replies quickly,
- clear low-value communication overhead,
- stay responsive without opening multiple apps.

## 3. Target User

Primary user:

- A single executive, founder, or operator who is high-volume on email and iMessage.
- Comfortable delegating communication tasks if the assistant is reliable and safe.
- Wants speed and convenience more than a fully general AI agent.

Secondary user later:

- Small teams supporting an executive, including an EA or chief of staff.

## 4. Product Goal

Deliver the smallest useful version of an “assistant in iMessage” that can:

- summarize what needs attention,
- draft or send common replies,
- manage basic inbox and messaging workflows,
- do so with strong guardrails and minimal setup friction.

## 5. MVP Principles

- Start with communication, not full personal operations.
- Optimize for the top 5 repeatable workflows, not broad autonomy.
- Prefer speed and clarity over cleverness.
- Require explicit confirmation before any outward-facing high-risk action.
- Keep the assistant narrow, trustworthy, and easy to correct.

## 6. Goals

- Let the user manage their inbox from iMessage without opening email.
- Let the user manage their iMessage backlog from the same interface.
- Reduce response latency for routine communication.
- Make the assistant feel proactive but not out of control.

## 7. Non-Goals

For MVP, the product should not include:

- calendar scheduling,
- meeting rescheduling,
- travel booking,
- file management,
- CRM updates,
- multi-user delegation workflows,
- voice interface,
- autonomous sending without confirmation,
- broad internet research or task execution outside email and iMessage.

## 8. MVP Scope

### 8.1 Control Surface

The user interacts with the assistant entirely through iMessage.

Core behaviors:

- The assistant accepts natural-language requests via iMessage.
- The assistant responds in concise, text-message-sized outputs.
- The assistant maintains short-lived context within the active conversation.

### 8.2 Email Management Features

The MVP should support:

- Inbox summary:
  Return the most important unread or recent emails that likely need attention.
- Thread brief:
  Summarize a specific email thread in 2 to 5 bullets.
- Draft reply:
  Produce a reply draft in the user’s tone.
- Send reply:
  Send an email reply after explicit confirmation.
- New outbound email:
  Draft and send a new email after explicit confirmation.
- Archive or mark done:
  Remove low-priority emails from the active inbox after user approval.

Nice-to-have within MVP if simple:

- Priority labeling such as `urgent`, `needs reply`, `waiting`, `FYI`.
- Suggested responses for the top 3 urgent emails.

### 8.3 iMessage Management Features

The MVP should support:

- Message summary:
  Show recent messages or threads that may require a reply.
- Thread brief:
  Summarize a recent conversation with a person in plain English.
- Draft reply:
  Suggest a reply to a recent message thread.
- Send message:
  Send an iMessage to a contact after explicit confirmation.
- Follow-up prompt:
  Suggest who the user has not responded to yet.

### 8.4 Safety and Trust Features

The MVP must include:

- Trusted-user control:
  Only the owner can issue commands.
- Confirmation step:
  Any external send action must be confirmed before sending.
- Action preview:
  The assistant shows exactly what it is about to send.
- Clear audit trail:
  The assistant keeps a simple history of requests, drafts, confirmations, and completed actions.
- Safe fallback:
  If confidence is low, the assistant asks a clarifying question instead of acting.

### 8.5 Personalization

The MVP should support lightweight personalization:

- User name and preferred tone,
- VIP contacts,
- common signature or closing style,
- simple priority rules such as “always flag my investors and direct reports.”

## 9. Hero Use Cases

### Use Case 1: Inbox Triage While Away From Laptop

Scenario:
The user is in transit and wants to know what in their inbox truly matters.

Flow:

1. User texts: “What emails need my attention this morning?”
2. Assistant returns the top 5 items with a short reason for each.
3. User texts: “Draft replies for the first two.”
4. Assistant sends short drafts.
5. User texts: “Send the first, tweak the second to be warmer.”
6. Assistant previews the updated second draft and sends only the confirmed first message.

Value:

- Saves the user from opening email.
- Converts inbox anxiety into a small set of concrete decisions.

### Use Case 2: Clear Outstanding iMessage Replies Between Meetings

Scenario:
The user has several recent iMessages and wants to catch up quickly.

Flow:

1. User texts: “Who do I owe a text back to?”
2. Assistant returns a short list of recent threads needing reply.
3. User texts: “Reply to Alex: Running 10 late, see you there.”
4. Assistant previews the outgoing message.
5. User confirms.
6. Assistant sends and marks the thread handled.

Value:

- Helps the user stay responsive without opening Messages and scanning manually.

### Use Case 3: Draft a Thoughtful Response to a Sensitive Email

Scenario:
The user receives a difficult message and wants help responding carefully from their phone.

Flow:

1. User texts: “Summarize the email from Dana and draft a diplomatic reply.”
2. Assistant returns:
   - a 3-bullet summary,
   - recommended posture,
   - a draft reply.
3. User texts: “Shorter and firmer.”
4. Assistant revises the draft.
5. User confirms send.

Value:

- Makes the assistant feel like a communication partner, not just a relay tool.

### Use Case 4: Morning Communication Briefing

Scenario:
The user wants one message that explains what matters across email and iMessage.

Flow:

1. User texts: “Morning brief.”
2. Assistant responds with:
   - urgent emails,
   - VIP messages,
   - top follow-ups,
   - suggested first actions.
3. User texts: “Archive the low-priority emails and draft responses to the investor notes.”

Value:

- Creates a daily ritual and a clear wedge for habitual use.

## 10. Functional Requirements

### P0 Requirements

- Receive and process user instructions through iMessage.
- Access the user’s email account and recent email threads.
- Access the user’s recent iMessage conversations.
- Generate summaries for inbox items and message threads.
- Draft replies for email and iMessage.
- Require confirmation before sending any outbound message.
- Send confirmed email replies and iMessages.
- Support simple commands such as:
  - “What needs my attention?”
  - “Summarize this thread.”
  - “Draft a reply.”
  - “Send it.”
  - “Archive it.”

### P1 Requirements

- Personalize drafts to the user’s tone.
- Identify VIP senders and surface them first.
- Suggest follow-ups proactively.
- Group communication into `urgent`, `reply soon`, `waiting`, and `FYI`.

## 11. UX Requirements

- Responses should fit naturally inside iMessage and be easy to skim.
- The assistant should avoid long walls of text.
- Summaries should default to bullets or short sections.
- Every draft should clearly distinguish between:
  - summary,
  - recommendation,
  - draft text,
  - pending action.
- Confirmation prompts should be explicit:
  “Ready to send this to Sarah?”

## 12. Safety Requirements

- Never send an external message without explicit confirmation.
- Never hallucinate thread context if source data is missing.
- If multiple recipients or threads match a request, ask which one.
- The user must be able to cancel any pending action.
- The assistant should log all completed sends and archives.

## 13. Success Metrics

MVP success should be measured by:

- Weekly active usage through iMessage,
- number of completed communication tasks per day,
- percent of drafted messages that get approved,
- time saved versus manually opening inbox and Messages,
- user trust score from direct qualitative feedback,
- low error rate for wrong-thread or wrong-recipient actions.

## 14. Key Risks

- Trust risk:
  Users will abandon the product quickly if it sends the wrong thing or feels unpredictable.
- Scope risk:
  “Executive assistant” can balloon into a general-purpose agent product.
- iMessage constraint risk:
  iMessage access may require a specific device or account setup in the MVP.
- Tone risk:
  Draft quality must feel personal enough to be useful.

## 15. Open Questions

- Should the assistant operate only for one trusted owner in MVP, or also allow a human EA to drive it?
- Should “send” require a one-step confirm every time, or can trusted low-risk contacts become auto-send later?
- How much memory of user preferences is needed before drafts feel genuinely personalized?
- Is morning briefing important enough to be a headline feature, or just a convenience workflow?

## 16. Recommended MVP Cut

If we want the fastest credible version, the MVP should launch with exactly these headline capabilities:

- “What needs my attention?” across email and iMessage,
- summarize any relevant thread,
- draft a reply,
- confirm and send,
- archive low-priority email,
- identify who the user owes a reply to.

That is enough to validate the core promise: communication management through iMessage, without overreaching into a full autonomous assistant.
