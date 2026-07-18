## Project Overview

Zoro is a commitment-centered accountability agent that lives primarily inside iMessage/SMS.

The product helps users turn stated intentions into concrete commitments, follow up at useful times, record what happened, and recover when plans slip. It should feel like a sharp friend in their pocket: direct, socially aware, encouraging when useful, and willing to call out mismatch between stated goals and actual behavior.

Positioning:

> The smart friend who helps you actually follow through.

Core promise:

> Text what you intend to do. Zoro keeps the loop alive until it is done, changed, blocked, or dropped.

## Tech Stack

- **Bun** — TypeScript runtime, package manager, and test runner.
- **Hono** — webhook/API server.
- **Railway** — app hosting and production infrastructure.
- **Railway Postgres** — app database, connected over Railway private networking.
- **Drizzle ORM** — schema, migrations, and type-safe database access.
- **Blooio** — iMessage/SMS API layer.
- **Vercel AI SDK** — AI orchestration, model calls, and tool calling when compatible.
- **Stripe** — checkout, subscriptions, billing, and customer portal.
- **Inngest** — durable background jobs and reminder scheduling.

## High-Level Architecture

```txt
User texts Zoro
  ↓
Blooio webhook
  ↓
Bun/Hono API server on Railway
  ↓
Drizzle repos read/write Railway Postgres
  ↓
Profile, memories, goals, and unresolved commitments are loaded/updated
  ↓
AI generates a short text-native reply
  ↓
Blooio sends reply back to user
```

Proactive accountability messages follow the same text-native delivery path:

```txt
Commitment needs reminder/check-in/follow-up
  ↓
scheduled_messages row is created/updated
  ↓
Inngest claims due scheduled message durably
  ↓
Zoro checks commitment is still unresolved/relevant
  ↓
Blooio sends the reminder as an iMessage/SMS text
  ↓
Commitment event history records what happened
```

## Product Scope

Build the most useful text-native accountability agent.

MVP focus:

- Phone-number-based accounts.
- Conversational onboarding.
- Durable user profile, goals, memories, commitments, and scheduled messages.
- Commitment-aware conversation that helps users clarify what they will do, when, and what counts as done.
- Automatic capture of clear commitments from natural language, without requiring CRUD wording.
- Reminder, check-in, and follow-up loops delivered through Blooio texts.
- Missed/blocked commitment recovery: identify blocker, reduce scope, or reschedule only when user recommits.
- Subscription gating through Stripe.
- Safety handling for dangerous or high-risk messages.

Out of core MVP scope:

- Habit tracking as a checkbox/streak product concept.
- Meal and macro tracking.
- Productivity dashboard UI.
- Complex recurrence rules.

Routines replace habits as recurring commitment templates. Meal tracking remains an optional module, but neither routines nor meals should define Zoro's core identity.

## Core Data Model

Goals describe direction. Commitments describe what the user said they would do. Scheduled messages describe outbound texts Zoro plans to send.

Core tables:

- `users` — phone-number keyed accounts, profile, timezone, preferences.
- `threads`, `participants`, `messages` — text conversation history and traceability.
- `goals` — longer-term direction, motivation, milestones, and next action.
- `memories` — typed, sourced, confidence-scored context that should change future behavior.
- `routines` — recurring intentions that generate concrete commitments.
- `commitments` — concrete promises or intended actions kept alive until resolved.
- `commitment_events` — append-only history of creation, reminders, misses, completions, blockers, and reschedules.
- `scheduled_messages` — durable queue for reminders, check-ins, and follow-ups.

Routines do not record completion directly. They generate commitments, and those commitments receive events and scheduled messages.

```txt
routine
  ↓ generates
commitments
  ↓ get
scheduled_messages
```

Example:

```txt
Routine:
Gym 3x/week

Generated commitments:
- Gym session 1 this week
- Gym session 2 this week
- Gym session 3 this week

Scheduled messages:
- reminder before a session is due
- check-in after due time
- follow-up if unresolved
```

`scheduled_messages` should not be recurring rows. They are one-off outbound texts linked to concrete commitments. A periodic routine generator creates missing commitments for the current period, then normal scheduling policy creates one-off scheduled messages for each commitment.

`memories` replaces generic `user_facts`. A memory is not just a key/value fact; it has type, source, confidence, importance, and lifecycle fields so stale or contaminated context does not quietly pollute the system prompt.

Memory types:

- `fact` — stable user information.
- `preference` — communication, accountability, planning, or product preferences.
- `constraint` — schedule, energy, access, health, or environment limits.
- `motivation` — why a goal or commitment matters.
- `behavior_pattern` — observed repeated behavior, blockers, misses, or follow-through patterns.
- `relationship` — durable relationship/social context relevant to support.
- `strategy` — tactics that help this user follow through.

Memory rows should include `source_message_id`, `confidence`, `importance`, `last_confirmed_at`, `expires_at`, and `is_active`.

Only save memory that should affect future behavior. Do not save system/developer/tool text, prompt fragments, one-off trivia, jokes, or roleplay unless the user explicitly wants it remembered as a durable preference.

Prompt context should include a small set of relevant active memories, not every memory ever saved.

Commitment lifecycle:

```txt
conversation
  ↓
possible intention detected
  ↓
commitment clarified
  ↓
commitment scheduled
  ↓
reminder/check-in sent
  ↓
outcome collected
  ├── completed
  ├── missed
  ├── blocked
  ├── rescheduled
  └── cancelled
  ↓
follow-up or recovery plan
```

Key distinction:

- `due_at` = when user intends to act or finish.
- `next_check_in_at` = when Zoro should speak next.

Do not overload one timestamp for both.

## Product Principles

- Zoro is not a generic chatbot, task manager, therapist, or productivity dashboard.
- Texting is the primary interface.
- Prefer one concrete next action over broad advice.
- Ask one question at a time.
- Keep meaningful commitments alive until they are completed, cancelled, rescheduled, blocked, or missed.
- Do not turn every casual thought into a commitment.
- Clarify weak or vague intentions before storing them.
- After misses, diagnose blocker before offering motivation or accepting another vague promise.
- Do not invent goals, facts, deadlines, preferences, or constraints.
- Do not pretend integrations or tools exist before they are implemented.
- Store durable context carefully; do not store secrets or unnecessary private data.
- Store memories with source and confidence; avoid dumping stale or low-value facts into every prompt.

## Security Principles

- Verify Blooio webhooks before parsing or processing them.
- Use raw request bodies for webhook signature verification.
- Make inbound webhook processing idempotent.
- Store inbound messages before generating/sending replies.
- Keep database access private through Railway networking where possible.
- Use short-lived signed links for sensitive actions like billing, export, and deletion.
- Do not log secrets, credentials, raw private dumps, or full payment data.
