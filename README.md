# Executive Assistant Agent 

**An executive assistant that lives in iMessage** 

Sayla is an AI superconnector that helps people find and meet the right connections through natural conversation. No profiles to fill out, no swiping, no awkward networking events — just text Sayla like you would a friend, and she'll introduce you to people you'd genuinely click with.

---

## Value Proposition

### The Problem

Traditional networking is broken:

- LinkedIn is transactional and overwhelming
- Networking events are awkward and time-consuming
- Dating-style apps for professional networking feel forced
- People don't know what they're looking for until they find it

### The Solution

Sayla reimagines networking as conversation. She's an AI wingman who:

- **Lives where you already are** — iMessage, the most natural communication medium
- **Gets to know you through real conversation** — not forms or profiles
- **Makes quality introductions** — not quantity, just the right people
- **Remembers everything** — your interests, goals, and what makes you tick

---

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   1. CHAT       │ ──▶ │   2. DISCOVER   │ ──▶ │   3. CONNECT    │
│                 │     │                 │     │                 │
│  Text Sayla     │     │  She learns     │     │  She makes      │
│  like a friend  │     │  what you want  │     │  the intro      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Chat** — Text Sayla like you would a friend. She listens, remembers, and has her own opinions.
2. **Discover** — Through real conversation, she helps you figure out what you actually want — in friends, work, everything.
3. **Connect** — When she finds someone you'd genuinely vibe with, she makes the intro. Quality over quantity, always.

---

## Product Features

### Sayla — The AI Wingman

- **Personality-driven AI** — Warm, opinionated, and genuinely caring. Not a generic chatbot.
- **Conversational onboarding** — No forms. Just chat naturally about your interests and goals.
- **Proactive check-ins** — She texts you when something (or someone) makes her think of you.
- **Memory & context** — Remembers everything you've told her and references it naturally.

### Smart Matching

- **Vector embeddings** — Profiles are converted to 768-dimensional vectors for semantic similarity matching.
- **Intent compatibility** — Matches based on complementary goals:
  - Hiring ↔ Looking for work
  - Fundraising ↔ Investing
  - Networking ↔ Networking
  - Mentorship ↔ Looking for a mentor
- **Quality threshold** — Only surfaces matches above a configurable similarity score (default 0.75).

### Connection Experience

- **Group iMessage intros** — Sayla introduces matches directly in a group chat with context.
- **Safety features** — Report functionality, content moderation, and crisis resource support.

### Admin Dashboard

- **User management** — View all users, statuses, tags, and activity.
- **Conversation viewer** — See Sayla's conversations with any user for debugging/QA.
- **Sortable/filterable** — By status, last activity, check-in count, or creation date.

---

## Architecture

```
superconnector/
├── web/                    # React frontend
│   ├── src/
│   │   ├── api/            # TanStack Query hooks
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   └── lib/            # Utilities
│   └── vite.config.ts
│
├── server/                 # Express backend
│   ├── prisma/
│   │   ├── schema.prisma   # Prisma schema
│   │   └── migrations/     # Database migrations
│   └── src/
│       ├── modules/
│       │   ├── messaging/  # SMS/iMessage + AI responses
│       │   ├── matching/   # Vector matching algorithm
│       │   ├── admin/      # Admin dashboard API
│       │   └── cron/       # Scheduled jobs
│       └── utils/          # Shared utilities
│
├── docker-compose.yml      # Local PostgreSQL + pgvector
└── pnpm-workspace.yaml     # Monorepo configuration
```

---

## Technology Stack

### Frontend

| Technology      | Purpose                 |
| --------------- | ----------------------- |
| React 19        | UI framework            |
| Vite 7          | Build tool              |
| React Router 7  | Routing                 |
| TanStack Query  | Server state management |
| Tailwind CSS 4  | Styling                 |
| Motion (Framer) | Animations              |
| nuqs            | URL state management    |
| react-virtuoso  | Virtualized lists       |

### Backend

| Technology                | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| Node.js 22+               | Runtime                                      |
| Express 5                 | Web framework                                |
| Prisma 7                  | Database ORM                                 |
| PostgreSQL + pgvector     | Database + vector similarity                 |
| Google Gemini             | AI responses & profile extraction            |
| Hugging Face Transformers | Embedding generation (nomic-embed-text-v1.5) |
| SendBlue                  | iMessage/SMS gateway                         |
| node-cron                 | Scheduled jobs                               |
| Winston                   | Logging                                      |

---

### User Lifecycle

```
onboarding                  ready_to_match          matched         inactive
    │                             │                    │                │
    ├─ awaiting_phone_link        │                    │                │
    ├─ collecting_background      │                    │                │
    ├─ collecting_interests       │                    │                │
    └─ generating_embedding ──────┴────────────────────┴────────────────┘
```

---

## API Reference

### Admin

| Endpoint                        | Method | Description                   |
| ------------------------------- | ------ | ----------------------------- |
| `/api/admin/users`              | GET    | List all users                |
| `/api/admin/users/:id/messages` | GET    | Get user's Sayla conversation |

### Webhooks (SendBlue)

| Endpoint                         | Method | Description             |
| -------------------------------- | ------ | ----------------------- |
| `/api/messaging/webhook/inbound` | POST   | Inbound SMS/iMessage    |
| `/api/messaging/webhook/status`  | POST   | Message delivery status |

---

## Cron Jobs

| Job               | Schedule         | Description                                                |
| ----------------- | ---------------- | ---------------------------------------------------------- |
| **Matching**      | Every 6 hours    | Batch matching cycle for all eligible users                |
| **Notifications** | Every 15 minutes | Send group intros for ready matches (respects quiet hours) |

---

## Environment Variables

### Server

```bash
# Database
DATABASE_URL="postgresql://..."

# Client
CLIENT_URL="https://your-frontend.com"

# AI
GEMINI_API_KEY="..."

# SMS (SendBlue)
SENDBLUE_API_KEY="..."
SENDBLUE_SECRET="..."
SENDBLUE_FROM_NUMBER="+1..."
SENDBLUE_WEBHOOK_BASE_URL="https://your-backend.com"
SENDBLUE_WEBHOOK_SECRET="..."

# Auth
JWT_SECRET="..."
```

### Frontend

```bash
VITE_API_URL="https://your-backend.com"
VITE_SAYLA_PHONE="+1..."
```

---

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker (for PostgreSQL)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/cocomo-ai/superconnector.git
cd superconnector

# Install dependencies
pnpm install

# Start PostgreSQL with pgvector
docker-compose up -d

# Set up environment variables
cp server/.env.example server/.env
cp web/.env.example web/.env
# Edit both files with your values

# Run database migrations
cd server && pnpm prisma migrate dev

# Start development servers
pnpm dev  # In both web/ and server/ directories
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

| Service                                     | Purpose                          | Required        |
| ------------------------------------------- | -------------------------------- | --------------- |
| [SendBlue](https://sendblue.co)             | iMessage/SMS send/receive        | Yes             |
| [Google AI (Gemini)](https://ai.google.dev) | AI responses, profile extraction | Yes             |
| [Hugging Face](https://huggingface.co)      | Embedding model (runs locally)   | Auto-downloaded |

---

## Safety & Moderation

Sayla is designed with safety in mind:

- **Crisis support** — Responds to self-harm ideation with empathy and provides crisis resources (988 Lifeline, Crisis Text Line)
- **Content boundaries** — Never NSFW, harmful, or manipulative content
- **User reporting** — Matched users can report inappropriate behavior
- **Rate limiting** — WebSocket and API rate limits prevent abuse
- **Behavioral rules** — AI prompts include strict behavioral guidelines

---

## License

Proprietary — Cocomo AI © 2024

---

## Contact

- **Website**: [cocomo.ai](https://cocomo.ai)
- **Email**: [hello@cocomo.ai](mailto:hello@cocomo.ai)
