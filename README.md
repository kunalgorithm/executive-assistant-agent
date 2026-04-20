# Executive Assistant Agent

**A personal executive assistant that lives in iMessage.**

Text your assistant like you would a chief of staff — ask about your day, triage your inbox, schedule meetings, or reschedule conflicts. No app to open, no dashboard to check. Just iMessage.

---

## MVP Scope

The MVP is a **single-player** executive assistant for one user (the owner). It is not a multi-tenant product. It does not connect users to each other. It does one thing well: help the owner manage **calendar** and **email** via iMessage.

### In scope (MVP)

- **Calendar (Google Calendar)**
  - Summarize today / this week ("what's on my calendar tomorrow?")
  - Create events from natural language ("book 30m with Priya next Tues afternoon")
  - Reschedule, cancel, or move events
  - Surface conflicts and suggest alternatives
  - Respect the owner's working hours and timezone

- **Email (Gmail)**
  - Daily / on-demand inbox triage ("what needs my attention?")
  - Summarize threads
  - Draft replies for approval via iMessage (owner confirms before send)
  - Mark as read / archive / snooze on command
  - Flag messages requiring human decision

- **Conversational surface**
  - iMessage only (via SendBlue)
  - Preserves the existing warm, opinionated personality
  - Remembers context across messages (ongoing threads, preferences, recurring people)

### Out of scope (MVP)

- Multi-user / introductions / matching / embeddings (removed from the prior Sayla product)
- Slack, Discord, web chat, mobile app
- Task managers (Linear, Asana, Todoist)
- Document drafting beyond email replies
- Voice / phone calls
- Admin dashboard for other users (a single-owner admin view stays for debugging only)

---

## Value Proposition

### The problem

The owner's day is fragmented across Gmail and Google Calendar. Most interactions with these tools are short, repetitive decisions (accept/decline, reply/archive, reschedule). They don't need a UI — they need a delegate.

### The solution

An assistant that:

- **Lives in iMessage** — the fastest surface to reach the owner
- **Acts, doesn't just inform** — proposes the action, waits for approval, then executes
- **Keeps the owner in the loop** — destructive or outbound actions (send email, cancel meeting) require explicit confirmation
- **Is proactive when asked** — morning briefing, end-of-day review, meeting prep

---

## Connector Roadmap

The landing page expands Sayla beyond a narrow work-only assistant. To make the current product story real, these are the integrations that matter most.

### Phase 1 — Must-have

1. **iMessage / SMS transport**
   - This is the product surface. Without reliable inbound and outbound messaging, none of the Sayla experience works.
   - Current direction: SendBlue for iMessage-compatible messaging.

2. **Calendar**
   - Google Calendar, Outlook / Microsoft 365, and ideally Apple Calendar / CalDAV.
   - Scheduling and rescheduling are the core wedge, so this has to be strong from day one.

3. **Contacts / address book**
   - iCloud, Google Contacts, and device contacts where possible.
   - This is what turns "my parents", "Anna", or household members into real people Sayla can coordinate with.

4. **Reminders / tasks**
   - Apple Reminders plus one cross-platform task system such as Google Tasks or Todoist.
   - This is required for birthdays, bills, renewals, nudges, and follow-through.

5. **Email**
   - Gmail and Outlook first.
   - Morning briefs, confirmation emails, thread summaries, and lots of real-world coordination depend on inbox visibility.

6. **Browser automation / agentic web actions**
   - Quietly essential.
   - Internet repair bookings, returns, forms, reservations, and many life-admin tasks will not all have clean APIs, so Sayla needs a dependable browser-action layer.

### Phase 2 — High-value next

7. **Restaurant reservations**
   - Resy, OpenTable, and possibly SevenRooms.
   - This directly supports one of the most common consumer asks: "find a time and book somewhere good."

### Recommended rollout order

- **Now:** iMessage / SMS transport, Calendar, Contacts, Reminders / tasks
- **Next:** Email, Browser automation / agentic web actions
- **Then:** Restaurant reservations

---

## How It Works

```
  iMessage ──▶  SendBlue webhook  ──▶  Express server
                                            │
                                            ├─▶ LLM (Gemini) plans a response or tool call
                                            │
                                            ├─▶ Google Calendar API (read/write events)
                                            ├─▶ Gmail API (read threads, draft/send replies)
                                            │
                                            └─▶ SendBlue ──▶ iMessage reply to owner
```

1. Owner texts the assistant's number.
2. Server receives the webhook, loads recent conversation + owner context.
3. LLM decides: respond conversationally, or call a calendar / email tool.
4. For write actions (send email, create/cancel event), the assistant proposes and waits for "yes".
5. Reply is sent back to iMessage.

---

## Product Principles

- **Trust is the product.** The assistant never sends an email or modifies a calendar event without explicit owner confirmation. Read actions are fine unprompted.
- **One owner, one number.** The MVP assumes a single authenticated user. No auth flows for guests, invitees, or matched pairs.
- **Short messages.** Replies are concise. Long lists are bulleted. The assistant does not lecture.
- **Recoverable.** Every write action logs enough detail that the owner can undo it via a follow-up message ("undo that last reschedule").

---

## Architecture

```
executive-assistant-agent/
├── web/                    # Owner-facing admin UI (debug conversations, view logs)
│   └── src/
│       ├── api/            # TanStack Query hooks
│       ├── components/
│       ├── pages/
│       └── lib/
│
├── server/                 # Express backend
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── modules/
│       │   ├── messaging/  # SendBlue webhook + AI orchestration
│       │   ├── calendar/   # Google Calendar tools (to be built)
│       │   ├── email/      # Gmail tools (to be built)
│       │   ├── admin/      # Single-owner admin API
│       │   └── cron/       # Scheduled briefings (morning/evening)
│       └── utils/
│
├── docker-compose.yml      # Local PostgreSQL
└── pnpm-workspace.yaml
```

---

## Technology Stack

### Frontend

| Technology     | Purpose      |
| -------------- | ------------ |
| React 19       | UI framework |
| Vite 7         | Build tool   |
| React Router 7 | Routing      |
| TanStack Query | Server state |
| Tailwind CSS 4 | Styling      |
| Motion         | Animations   |

### Backend

| Technology          | Purpose               |
| ------------------- | --------------------- |
| Node.js 22+         | Runtime               |
| Express 5           | Web framework         |
| Prisma 7            | Database ORM          |
| PostgreSQL          | Database              |
| Google Gemini       | LLM + tool use        |
| Google Calendar API | Calendar read/write   |
| Gmail API           | Email read/draft/send |
| SendBlue            | iMessage gateway      |
| node-cron           | Scheduled briefings   |
| Winston             | Logging               |

> Note: pgvector and HuggingFace embeddings are removed with the matching feature. Plain Postgres is sufficient for the MVP.

---

## Data Model (MVP target)

- **Owner** — single row, holds Google OAuth tokens, timezone, working hours, preferences
- **Message** — inbound/outbound iMessage record
- **Conversation** — ongoing session context (recent turns, pending confirmations)
- **ActionLog** — every calendar/email write with before/after snapshot for undo

---

## API Reference (planned)

### Webhooks (SendBlue)

| Endpoint                         | Method | Description      |
| -------------------------------- | ------ | ---------------- |
| `/api/messaging/webhook/inbound` | POST   | Inbound iMessage |
| `/api/messaging/webhook/status`  | POST   | Delivery status  |

### OAuth (Google)

| Endpoint                    | Method | Description                      |
| --------------------------- | ------ | -------------------------------- |
| `/api/auth/google/start`    | GET    | Begin OAuth for Calendar + Gmail |
| `/api/auth/google/callback` | GET    | Exchange code, store tokens      |

### Admin

| Endpoint                  | Method | Description                 |
| ------------------------- | ------ | --------------------------- |
| `/api/admin/conversation` | GET    | Owner's iMessage transcript |
| `/api/admin/action-log`   | GET    | Recent write actions        |

---

## Cron Jobs (MVP)

| Job               | Schedule          | Description                                 |
| ----------------- | ----------------- | ------------------------------------------- |
| **Morning brief** | 7:30am owner's TZ | Today's calendar + top inbox items          |
| **Evening recap** | 6:00pm owner's TZ | Tomorrow preview + unread important threads |

---

## Environment Variables

### Server

```bash
# Database
DATABASE_URL="postgresql://..."

# Client
CLIENT_URL="https://your-frontend.com"

# LLM
GEMINI_API_KEY="..."

# iMessage (SendBlue)
SENDBLUE_API_KEY="..."
SENDBLUE_SECRET="..."
SENDBLUE_FROM_NUMBER="+1..."
SENDBLUE_WEBHOOK_BASE_URL="https://your-backend.com"
SENDBLUE_WEBHOOK_SECRET="..."

# Google (Calendar + Gmail)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="https://your-backend.com/api/auth/google/callback"

# Owner
OWNER_PHONE_NUMBER="+1..."   # the only number allowed to talk to the agent

# Auth
JWT_SECRET="..."
```

### Frontend

```bash
VITE_API_URL="https://your-backend.com"
```

---

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker (for PostgreSQL)

### Quick Start

```bash
# Install
pnpm install

# Start PostgreSQL
docker-compose up -d

# Configure env
cp server/.env.example server/.env
cp web/.env.example web/.env

# Migrate DB
cd server && pnpm prisma migrate dev

# Run
pnpm dev
```

### Scripts

```bash
# Root
pnpm clean          # Remove all node_modules
pnpm fresh          # Clean install
pnpm fix            # Run linter + formatter

# Server
pnpm dev            # Start dev server
pnpm build          # Build for production
pnpm prisma studio  # Open Prisma Studio

# Web
pnpm dev            # Start Vite dev server
pnpm build          # Build for production
pnpm preview        # Preview production build
```

---

## External Services

| Service                                     | Purpose                 | Required |
| ------------------------------------------- | ----------------------- | -------- |
| [SendBlue](https://sendblue.co)             | iMessage send/receive   | Yes      |
| [Google AI (Gemini)](https://ai.google.dev) | LLM + tool use          | Yes      |
| Google Cloud (Calendar + Gmail APIs)        | Calendar & email access | Yes      |

---

## Safety & Trust

- **Confirmation required for writes.** Sending email or modifying calendar events always requires an explicit "yes" from the owner.
- **Single-owner lock.** Inbound webhooks from any number other than `OWNER_PHONE_NUMBER` are rejected.
- **Action log.** Every write is logged with a before/after snapshot so the owner can ask "undo that" in natural language.
- **Scoped OAuth.** Google tokens are stored encrypted at rest. Minimum necessary scopes (calendar + gmail.modify).
- **No third-party data sharing.** Conversation and email content are only sent to Gemini for response generation.

---
