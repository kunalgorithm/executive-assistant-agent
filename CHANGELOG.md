# Changelog

## 2026-03-16

- **Group Messages in Admin Dashboard**: Admins can now view group conversation messages for a match directly in the matches tab. Added a new `/matches/:matchId/messages` API endpoint and a `GroupConversationPanel` component with infinite scrolling support.

## 2026-03-14

- **Tooling Overhaul**: Replaced ESLint with [oxlint](https://oxc.rs/) and Prettier with [oxfmt](https://oxc.rs/) for significantly faster linting and formatting. Added `.oxlintrc.json` and `.oxfmtrc.json` configurations. Updated `lint-staged` to use the new tools.
- **Centralized Dependency Catalog**: Moved shared dependencies into a centralized `pnpm` workspace catalog for consistent versioning across `server` and `web` packages. Reverted catalog usage in `render.yaml` since Render does not support the catalog protocol.
- **VS Code Extensions**: Added recommended VS Code extensions and workspace settings for oxlint and oxfmt.

## 2026-03-13

- **Group Conversations**: Sayla can now participate in iMessage group chats. When both users opt in to an introduction, the group chat messages are tracked and Sayla can respond contextually within the group. Added `messageType` field to distinguish direct vs group messages and a `groupId` on matches for linking group chats.
- **Draft Revisions**: Introduction draft edits are now tracked with a `DraftRevision` table. Each time an admin edits a draft message, the previous version is saved, enabling an audit trail of changes before sending.
- **AI-Generated Match Reasons**: The matching algorithm now generates a human-readable reason explaining why two users were matched. Added a backfill endpoint to retroactively generate reasons for existing suggested matches.
- **Compatibility Check Before Introduction**: Admins can now run an AI compatibility check between two users before starting an introduction. The system analyzes both profiles and conversation histories to assess fit and generates a compatibility summary.
- **Smarter Onboarding**: Sayla no longer asks questions the user has already answered. The AI prompt now includes a "known profile" section built from existing user data (name, intent, title, bio, tags, social links), so it only asks for missing information.
- **Security Hardening**:
  - Added `express-rate-limit` with three tiers: global (100/min), admin (30/min), and heavy admin operations (5/min).
  - Replaced the `lock` utility with an improved `locks` module — `runExclusive` for per-key sequential processing and `withCronLock` to prevent overlapping cron runs.
  - Admin routes now use dedicated rate limiters.
- **Embedding Model Warmup**: The embedding model is now warmed up on server startup to avoid cold-start latency on the first embedding generation request.
- **Embedding Generation Refactor**: Extracted embedding generation and storage into a dedicated `embeddings` module under `matching/`, cleaning up the webhook handler.
- **Backfill Endpoints**: Added admin backfill endpoints for primary intent extraction, profile completion (triggering embedding generation for users stuck in onboarding), and match reason generation.
- **Merged Introductions into Matches Tab**: The separate introductions tab has been removed. All introduction management now lives within the matches tab, with status filters to switch between suggested matches, active introductions, and other states.
- **Admin Notes Component**: Extracted admin notes into a reusable `AdminNotes` component with auto-save on blur.
- Increased max AI output token limit for longer responses.
- Fixed admin conversation view to show only direct messages (excluding group messages).
- Fixed draft not updating in the UI when switching between matches.
- Fixed primary intent not getting populated during onboarding extraction.
- Fixed UI not refreshing after data mutations (query invalidation improvements).
- Removed sensitive data from server logs.

## 2026-03-10

- Added pagination and sorting schemas (for almost every admin API endpoint) to handle large datasets efficiently.
- Introduced infinite scrolling for admin users, introductions, and matches tabs in the frontend.
- Created a reusable useInfiniteScroll hook for handling infinite scrolling logic.
- Added semaphore utility to limit concurrent processing in the webhook for onboarding extraction.
- Adjusted database connection settings for improved performance.

## 2026-03-09

- **Ignore Reactions**: Inbound iMessage reactions (tapbacks) are now silently ignored. Previously they could trigger unintended processing in the webhook pipeline. The webhook now detects reaction payloads and returns early.
- **Prevent Message Cut-Offs**: Added safeguards to prevent outbound messages from being truncated by Sendblue's character limit or Gemini's token limit. Messages that would exceed limits are now split more intelligently before sending, and the AI prompt enforces shorter responses to stay within safe bounds.
- **Remove Nudges**: Removed the nudge system entirely. The nudge cron job and all related logic have been stripped out to fix build errors and simplify the codebase.

- Added a new `lock` utility for per-key sequential processing. Messages from the same user are processed sequentially while different users run in parallel.
- Refactored critical sections of the messaging pipeline to use the new `lock` utility, ensuring that operations for a given user are processed sequentially.
- Prevent webhook misuse by adding a new `SENDBLUE_WEBHOOK_SECRET` environment variable and validating incoming webhook requests against it. This will also be added in the sendblue dashboard webhook configuration.
- Removed the `REQUEST_LOGGING` environment variable. Stopped logging incoming requests to reduce log noise. Wasn't providing much value and was cluttering logs, especially with AI-generated messages.
- Improved the JSON parsing logic to handle cases where partial or malformed JSON is returned.
- Feature to extract links from user messages and store in db
- first version of embedding generation and storage in db, triggered after onboarding completes
- remove file logging, logs are shown in stdout. It was difficult to see file logs and with every new build, render deletes those log files automatically.
- removed unused `nanoid` package
- Introduced new analytics events for match suggestions and approvals.
- Updated primary intents to include more compatibility options.
- Added new match statuses and removed obsolete ones.
- Enhanced timezone utility to check for quiet hours.
- Implemented admin API endpoints for managing matches (list, approve, reject, backfill).
- Created new types for AdminMatch and updated existing types for better match handling.
- Developed MatchesTab component for the admin panel to display and manage matches.
- Added cron jobs for batch matching and notifications for ready matches.
- Implemented matching algorithm to suggest matches based on user profiles and intents.
- Updated database schema to include new scoring fields for matches.

---

## 2026-03-08

- Feature: A new `analytics` tab to see all the analytics events tracked from the app. Events can be filtered by event type, user, and date range. This will help us debug and verify that all the events are firing correctly, and also give us insights into user behavior.
- Introduced a new analytics event tracking system with predefined events.
- Updated the analytics tracking function to utilize the new event structure.
- Implemented pagination and sorting for user listings in the admin panel.
- Refactored existing code to improve organization and maintainability.
- Removed unused pagination and rate limiting utilities.
- Enhanced the user interface with a new popover component for displaying user information.
- Added `cleanSendblueData` function to filter unnecessary fields from Sendblue API responses.
- Introduced `profileExtractionSchema` for structured user profile data extraction.
- Implemented `classifyCheckInResponseSchema` for classifying user responses to check-ins.
- Updated `sendAndSaveOutbound` and `processInboundMessageAsync` functions to utilize new data cleaning and profile extraction logic.
- Refactored webhook handling to improve logging and error handling.
- Added new analytics events for AI response failures and user profile resets.
- Standardized user status labels and onboarding substates for consistency.

---

## 2026-03-07

- Remove modular prisma schema (in multiple files) -> single `schema.prisma` for faster iteration.
- Update design tokens and replace non-standard colors
- remove the `auth` and `onboarding` modules. Auth enabled magic-link login and onboarding handled the welcome sequence and user profile setup. With the new flow, both are now fully integrated into the main messaging pipeline, so separate modules are no longer needed.
- remove the `RoomMessage` model and the `chat` module. This enabled web-ui chat message storage and related code, which we are no longer building out since we're focusing on iMessage interactions only. The `RoomMessage` was the storage model for web-ui messages.
- removed the `ws` and `jsonwebtoken` dependencies. No longer used in the app, with the related code.
- add SEO tags in the main html template.
- add window alert before logging out admin automatically (if done, without user action). Earlier, when there was an error with admin APIs we used to logout admin directly, now added an alert to notify them.
- updated the readme to reflect these changes

## 2026-03-06

- **Head of Growth Job Page**: Added a dedicated job listing page at `/jobs/head-of-growth` for our first growth hire. Built as a separate HTML entry point so iMessage and social link previews show the correct title and description.
- **RESET Now Triggers Full Welcome Sequence** - When a user sends "NEW" or "RESET", they now receive the same welcome sequence as brand new users — intro message, opening question, then contact card. Previously they got a one-off reset message. Profile is also fully wiped including name and social URLs.

- **Updated Welcome Messages**:
  1. First message: "hi! i'm sayla. i find the people who will actually move the needle for you."
  2. Second message: "let's get into it — what's your full name?"
  3. Contact card sent last instead of in between

- **Smarter Message Splitting**: Messages were getting cut off mid-sentence due to a hard character limit in the multipart splitting logic. Removed the character limit entirely — splitting now only happens on natural line breaks that the AI model creates. The model is instructed to separate thoughts with blank lines, and each line is sent as its own text bubble.

- **Admin Panel UX**:
  1. Default sort changed to most recently active users first
  2. Tags column moved to last position

---

## 2026-03-05

- **Admin Introduction System**: Built a full admin-driven introduction flow. Admins can select two users, generate AI-drafted intro pitches personalized to each person, review/edit drafts, send opt-in requests via SMS, and create iMessage group chats once both users accept.

- **Flow**:
  1. Admin selects two users and clicks "New Introduction"
  2. AI generates personalized pitch messages for each user based on their conversation history
  3. Admin reviews and optionally edits drafts
  4. Admin sends opt-in SMS to both users
  5. System tracks responses — once both opt in, admin can send group intro
  6. Sendblue creates an iMessage group chat with both users

- **AI Name Extraction, Timezone Support & Quiet Hours**
  1. Sayla now extracts the user's first and last name from conversation via AI during onboarding, so users don't need to enter it manually
  2. Timezone auto-detected from phone number area code
  3. Cron jobs (check-ins, nudges) now respect quiet hours — no messages during nighttime in the user's local timezone
- **Multipart Text Messages**: Sayla now splits long AI responses into multiple shorter texts, sent sequentially with natural delays. Feels more like texting with a real person instead of receiving a wall of text.
- **Tapback Reactions**: Sayla can now react to messages with iMessage tapbacks (love, laugh, emphasize). An AI classifier decides whether a message warrants a reaction — most messages get no reaction to keep it feeling natural.
- **Natural Typing Pacing**: Typing indicators and natural delays before sending messages. Sayla sends a typing indicator while generating a response and paces multi-part messages with realistic delays based on message length.
- **Verbose Logging & Contact Card**: Structured, tagged logging throughout the messaging pipeline for production debugging. Every decision branch, API call, and error is logged with full context.
- Also added Sayla contact card (VCF) — sent to new users during welcome so they can save her number.
- **Admin Notes & Send Contact Card**: Admins can write free-text notes on any user (auto-saved on blur) and manually send Sayla's contact card from the admin panel.

- **App Icons & Welcome Message Polish**:
  1. Full set of favicon/app icons for all platforms
  2. Updated welcome text to be more natural

- **Collect Social Links During Onboarding**: Added a new onboarding phase where Sayla asks users to share social profiles (LinkedIn, X/Twitter, Instagram, website). Having these links gives people more context when Sayla pitches intros, which increases opt-in rates.
  1. After collecting interests, Sayla transitions into a social links phase
  2. Explains that sharing profiles helps when pitching intros
  3. Accepts whatever they share — no pressure, one ask then moves on
  4. Once they respond, onboarding wraps up and embedding generation begins

- **Automatic Opt-In / Decline Detection**: When an admin sends introduction opt-in requests to two people, the system now automatically detects whether each person accepted or declined and responds accordingly. Previously, only "yes" responses were detected; "no" responses were silently ignored.
  1. AI classifies each inbound message as accepted, declined, or unrelated
  2. If accepted: marks opted in, Sayla responds with a confirmation
  3. If declined: marks declined, Sayla responds gracefully
  4. If unrelated: message passes through to normal conversation
  5. Admin UI now shows three states: Waiting, Yes, No
