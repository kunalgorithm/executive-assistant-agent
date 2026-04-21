# Changelog

All notable changes to this project will be documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Newest at the top. Pre-release — no version tags yet.

## How to keep this updated

When you merge a PR or push a non-trivial commit, add a bullet to the latest dated section (or start a new one with today's date). Group under `Added`, `Changed`, `Fixed`, or `Removed`. Link PRs and commits where useful.

---

## 2026-04-20

### Added

- **iMessage-native reminders** — new `reminders` module with `create_reminder`, `list_reminders`, `update_reminder`, `cancel_reminder` tools exposed to Gemini. Cron job runs every minute to dispatch due reminders via SendBlue. Supports one-off and recurring (e.g. yearly birthdays), plus categories for birthdays, conflicts, and busy windows. Analytics events added. ([#2](https://github.com/kunalgorithm/executive-assistant-agent/pull/2))

### Changed

- **Contact search rewritten for fuzzy/first-name matching.** Replaced Google's `people.searchContacts` (opaque, cold-start empty-result quirks) with a paginated `people.connections.list` fetch + in-memory scored matching (5-min cache per user). Partial names, first-name-only, email fragments, and phone digits all match. Results ranked by match quality (exact → prefix → substring).
- **Write confirmation rules relaxed for solo events.** Calendar events without attendees and all task writes now execute immediately (no "good to go?" roundtrip) when required details are present. Events with attendees still require explicit confirmation — invites go to real humans. ([`58c566a`](https://github.com/kunalgorithm/executive-assistant-agent/commit/58c566a))

### Fixed

- **Server build script no longer silently skips esbuild on Render.** `tsc --noEmit` lived in the web package, not the server's devDependencies — on isolated installs it was failing silently and the bundle never rebuilt, so deployed code stayed stale. Build now runs `prisma generate` explicitly and skips the typecheck (lint script owns that). ([#6](https://github.com/kunalgorithm/executive-assistant-agent/pull/6))

### Added

- **Restaurant search tool** — `search_restaurants` exposed to Gemini, backed by Google Places API (New). Server-side API key (`GOOGLE_MAPS_API_KEY`), no per-user OAuth. Returns name, rating, price level, hours, phone, and a Google Maps URL the owner can tap to book via Reserve with Google. ([#5](https://github.com/kunalgorithm/executive-assistant-agent/pull/5))
- **Google Tasks connector** — `list_tasks`, `create_task`, `update_task`, `delete_task` tools. Bundled the `tasks` scope into the existing Google OAuth consent flow. ([#4](https://github.com/kunalgorithm/executive-assistant-agent/pull/4))
- **Google Contacts connector** — `search_contacts` tool via People API. Bundled `contacts.readonly` scope into the existing OAuth flow. ([#3](https://github.com/kunalgorithm/executive-assistant-agent/pull/3))
- **New env var**: `GOOGLE_MAPS_API_KEY` (optional, enables restaurant tool).
- **DB columns** on `users`: `contacts_connected_at`, `tasks_connected_at`.

### Changed

- System prompt expanded to describe calendar + tasks + contacts + restaurants as the assistant's scope.
- `ConnectionState` now tracks `contactsConnected`, `tasksConnected`, and `restaurantsAvailable` in addition to `calendarConnected`.
- OAuth callback stamps `calendarConnectedAt`, `contactsConnectedAt`, and `tasksConnectedAt` on success (one consent, three connections).

## 2026-04-19

### Added

- **Google Calendar tool calls** — Gemini function-calling wired to `list_calendar_events`, `create_calendar_event`, `update_calendar_event`, `delete_calendar_event` with multi-turn tool loop (capped at 6 round-trips). Writes require explicit owner confirmation per prompt rules.
- **Current date/time block** injected into the system prompt in the owner's timezone so relative dates resolve correctly.
- **Timezone auto-sync** on OAuth — pulls the authoritative timezone from the owner's primary Google Calendar during the OAuth callback and overwrites the area-code-based heuristic.
- **One-shot utility** `server/scripts/syncTimezone.ts` to backfill timezones for users who connected before the auto-sync shipped.
- **Google Calendar OAuth flow** — `GET /api/auth/google/start`, `GET /api/auth/google/callback`, per-user refresh + access token storage, HMAC-signed state, one-time connect tokens (1h TTL).
- **Connect flow via iMessage** — new users auto-receive a welcome + magic-link connect URL; `connect` / `link` / `reconnect` keywords regenerate the link. React pages at `/connect` and `/connect/success`.
- **`Environments` documentation** — README + CLAUDE.md tables for local (`ea.ngrok.dev`), staging (`ea.getsayla.com` + `api.ea.getsayla.com`), prod (`sayla.com` + `api.sayla.com`). `.env.example` annotated per-env.
- **Landing page rewrite** — minimal single-section landing describing the executive assistant (calendar + email scope). `/jobs/head-of-growth` route removed.

### Changed

- **Gemini thinking disabled** (`thinkingConfig.thinkingBudget: 0`) — `gemini-3-flash-preview` is a reasoning model and thought tokens were consuming the `maxOutputTokens` budget, producing empty responses.
- **System prompt hardened against hallucination** — explicit rules against fabricating calendar events, times, attendees, or "example" data. "Connected" state distinguishes OAuth-linked from tool-wired.
- **Link-unfurl metadata** rebranded from "Sayla | Your Superconnector" to "Sayla | Your Executive Assistant".

### Removed

- **Superconnector/matching feature set** — Match, DraftRevision, and RoomMessage Prisma models; matching module; embeddings pipeline (HuggingFace + pgvector); intro drafting + opt-in flow; admin matches tab + intro-mode UI; related cron jobs; analytics events. Prisma migration history squashed to a single fresh init.
- **`/jobs/head-of-growth`** route and page.
- Dependencies: `@huggingface/transformers`, `pg-mem`, pgvector extension.
