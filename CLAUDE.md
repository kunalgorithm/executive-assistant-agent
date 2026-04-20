# Executive Assistant Agent

Full-stack TypeScript monorepo for an iMessage-based executive assistant that helps a single owner manage calendar and email.

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Backend**: Express + WebSockets
- **Database**: PostgreSQL + pgvector via Prisma ORM
- **AI**: Google Gemini API + HuggingFace embeddings
- **Package Manager**: pnpm (required)
- **Node**: 22+ (see .nvmrc)

## Project Structure

```
web/          # React frontend
server/       # Express backend
```

## Environments

| Env     | Frontend                  | API / server                    |
| ------- | ------------------------- | ------------------------------- |
| Local   | `http://localhost:3000`   | `https://ea.ngrok.dev` (tunnel) |
| Staging | `https://ea.getsayla.com` | `https://api.ea.getsayla.com`   |
| Prod    | `https://sayla.com`       | `https://api.sayla.com`         |

Start the local tunnel with: `ngrok http --url=ea.ngrok.dev 80`. See README "Environments" for details.

## Commands

- `pnpm dev` — run dev environment
- `pnpm build` — build both packages
- `pnpm fix` — lint + format everything
- `pnpm fresh` — clean install

## Conventions

- Path alias: `@` → `./src` (both packages)
- Unused vars prefixed with `_`
- oxfmt: single quotes, trailing commas, 120 print width
- Pre-commit hooks run oxlint + oxfmt via lint-staged

## Code Patterns

- Functional React components with hooks
- TanStack React Query for server state
- Lazy loading with `React.lazy()` + `Suspense`
- `ProtectedRoute` for auth guards
- Backend modules organized by feature (`server/src/modules/`)
- `asyncRoute()` wrapper for Express error handling
- Zod for env validation
- Winston for logging

## Rules

- Don't commit or push to git without explicit user permission.
- Do not overuse loggers. Only log important and actionable information. Avoid logging sensitive data.
- While creating new plans, do not use useless and abstract metaphors, analogies and flattery language. Be direct, concise and specific. Focus on the core problem and solution without unnecessary embellishments.
- Always prioritize user experience above all.
- When in doubt, ask the user for clarification before proceeding with any action.
- Break all non-trivial tasks into phases and steps, and get user approval before moving to the next phase.
- Always provide a clear and concise summary of the current state and next steps after completing any task or phase.
- Never assume anything about the user's intentions or preferences. Always ask for confirmation before taking any action that could have significant consequences.
- Always be transparent about your capabilities and limitations. If you are unsure about something, say so and ask for guidance.
- To verify server build use `pnpm tsc --noEmit && pnpm build:only` and for web, use `pnpm build` in their respective directories. Do not run these commands in the root of the project.
- Do not repeat code. Try to abstract common logic into helper functions or shared components.
- Keep the codebase clean and organized. Follow the existing project structure and conventions.
- Use camelCase for variables, file names, functions etc. and PascalCase for naming react components. Do not use snake_case or kebab-case in the codebase. File names should be camelCase always.
- Use asyncRoute wrapper for all async Express handlers.
- Use environment variables from utils/env.ts only.
- Use pnpm for package management. Do not use npm or yarn (enforced in package.json engines).
- Use pnpm lint in the project root to check lint errors across the codebase. To verify build, use pnpm build instead of running tsc directly.
- After any change to prisma schema in the backend, update shared enums in web also.
- Prefer type over interface. Compose types with intersections and unions instead of extending interfaces.
- Do not use magic numbers, declare a constant with a descriptive name instead.
