# AGENTS.md

## Commands
- Use Bun Runtime: `bun install`, `bun run dev`, `bun run start`.
- Format/lint is `bun run check`; it runs `@biomejs/biome check --write`, so it can modify files.
- Tests use Bun directly: `bun test` or focused runs like `bun test src/tests/tools.test.ts`.
- Drizzle config reads `DATABASE_URL` through `src/env.ts`; run migration/codegen commands with all required env vars present.

## App Shape
- `src/main.ts` is the Hono entrypoint; routes are `GET /` and `POST /webhook/blooio`.
- Blooio webhook verification depends on the raw request body in `src/blooio/webhook.ts`; do not parse JSON before `verifyBlooioSignature`.
- Webhook handler returns `200` after starting `handleInboundMessage(...)` asynchronously; errors in that async work are logged, not returned to Blooio.
- Inbound flow: mark read/start typing, find/create user by phone, load facts/goals/habits/history, call `chat`, save assistant message, send split messages, then stop typing.

## Environment
- `src/env.ts` requires these at import time: `DATABASE_URL`, `BLOOIO_API_KEY`, `BLOOIO_BASE_URL`, `BLOOIO_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `EXA_API_KEY`.
- Unit tests mock modules heavily, but importing files that touch `src/env.ts` can still require env vars unless mocked before import.

## Agent Behavior Gotchas
- Assistant's name is Zoro
- Assistant replies use `---` as the delimiter for separate outgoing texts; `src/blooio/inbound.ts` splits on it and also turns double newlines into separators.
- Time-sensitive tools must require a saved IANA timezone before goals, habits, habit completions, or meal logs.
- Only expose iMessage reactions when `context.service === "iMessage"`; SMS should not get reaction tools.
- Internal goal/habit IDs are included in prompts for tool calls but must not be mentioned to users.

## Database
- Schema lives in `src/db/schema.ts`; generated migrations/snapshots live under `drizzle/`.
- Drizzle Kit config is `drizzle.config.ts` with schema `./src/db/schema.ts` and output `./drizzle`.
- Phone numbers are normalized with `libphonenumber-js`; users are keyed by normalized phone.

## Style
- Biome uses 2-space indentation and double quotes.
- TypeScript is strict with `noUncheckedIndexedAccess`; prefer explicit handling of possibly missing array/object values.
