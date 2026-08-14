## Project Overview

Zora is a text-native personal assistant that lives primarily inside iMessage/SMS.

The product helps users set reminders, manage lightweight personal context, search the web, and interact with connected external apps like Gmail, Google Calendar, and Notion through Composio. It should feel like a sharp friend in their pocket: concise, useful, socially aware, and proactive when timing matters.

Positioning:

> A personal assistant you can text.

Core promise:

> Text Zora what you need. It can remind you, look things up, and help with connected apps from the same conversation.

## Tech Stack

- **Bun** — TypeScript runtime, package manager, and test runner.
- **Hono** — webhook/API server.
- **Railway** — app hosting and production infrastructure.
- **Railway Postgres** — app database, connected over Railway private networking.
- **Drizzle ORM** — schema, migrations, and type-safe database access.
- **Blooio** — iMessage/SMS API layer.
- **Vercel AI SDK** — AI orchestration, model calls, and tool calling when compatible.
- **Composio** — external app/tool integration for Gmail, Google Calendar, Notion, and future connected apps.
- **Stripe** — checkout, subscriptions, billing, and customer portal.
- **Inngest** — durable background jobs and reminder scheduling.

## High-Level Architecture

```txt
User texts Zora
  ↓
Blooio webhook
  ↓
Bun/Hono API server on Railway
  ↓
Drizzle repos read/write Railway Postgres
  ↓
Profile, memories, reminders, conversation history, and Composio session state are loaded/updated
  ↓
AI generates a short text-native reply
  ↓
Blooio sends reply back to user
```

Proactive reminder messages follow the same text-native delivery path:

```txt
Reminder is due
  ↓
scheduled_messages row is created/updated
  ↓
Inngest claims due scheduled message durably
  ↓
Zora checks the reminder is still active/relevant
  ↓
Blooio sends the reminder as an iMessage/SMS text
  ↓
Reminder/message history records what happened
```

## Product Scope

Build the most useful text-native personal assistant.

MVP focus:

- Phone-number-based accounts.
- Conversational onboarding.
- Durable user profile, memories, reminders, messages, and Composio session records.
- One-off and simple recurring reminders delivered through Blooio texts.
- Web search for current, recent, location-specific, or verifiable external information.
- External app access through Composio for Gmail, Google Calendar, and Notion.
- Private app connection flows via Composio Connect Links.
- iMessage reactions only when the conversation service supports them.
- Subscription gating through Stripe.
- Safety handling for dangerous or high-risk messages.

Out of core MVP scope:

- Productivity dashboard UI.
- Complex recurrence rules.
- Habit/streak tracking as a primary product concept.
- Meal and macro tracking.
- Broad unrestricted external app access.

## Core Data Model

Reminders describe what Zora should remind the user about. Scheduled messages describe outbound texts Zora plans to send. Composio sessions preserve external app tool context for a user/thread.

Core tables:

- `users` — phone-number keyed accounts, profile, timezone, preferences.
- `threads`, `participants`, `messages` — text conversation history and traceability.
- `memories` — durable user context that should change future behavior.
- `reminders` — one-off and simple recurring reminders.
- `scheduled_messages` — durable queue for outbound reminder messages.
- `composio_sessions` — persisted Composio session IDs scoped by user and thread.

Reminder scheduling uses one-off `scheduled_messages` rows linked to reminders.

```txt
reminder
  ↓ schedules
scheduled_messages
```

Example:

```txt
Reminder:
Call mom tomorrow at 9am

Scheduled messages:
- outbound reminder text at the scheduled time
```

`scheduled_messages` should not be recurring rows. They are one-off outbound texts linked to reminders. Recurring reminders create the next scheduled message after each occurrence is sent or completed.

`memories` replaces generic `user_facts`. A memory is not just a key/value fact; it has type, source, confidence, importance, and lifecycle fields so stale or contaminated context does not quietly pollute the system prompt.

Memory types:

- `fact` — stable user information.
- `preference` — communication, accountability, planning, or product preferences.
- `constraint` — schedule, energy, access, health, or environment limits.
- `motivation` — why a goal or commitment matters.
- `behavior_pattern` — observed repeated behavior, blockers, misses, or follow-through patterns.
- `relationship` — durable relationship/social context relevant to support.
- `strategy` — tactics that help this user follow through.

Memory rows should include source and lifecycle fields so stale or contaminated context does not quietly pollute the system prompt.

Only save memory that should affect future behavior. Do not save system/developer/tool text, prompt fragments, one-off trivia, jokes, or roleplay unless the user explicitly wants it remembered as a durable preference.

Prompt context should include a small set of relevant active memories, not every memory ever saved.

Reminder lifecycle:

```txt
conversation
  ↓
reminder request detected
  ↓
reminder clarified
  ↓
reminder/check-in sent
  ↓
outcome collected
  ├── completed
  ├── rescheduled
  └── cancelled
```

## External App Integrations

Composio is used for external app tools.

Current enabled toolkits:

- Gmail
- Google Calendar
- Notion

Zora uses the app's `users.id` as the Composio user ID. Composio sessions are persisted per `user_id + thread_id`, so a conversation can reuse tool/auth context across turns.

Zora disables Composio in-chat connection management and owns connection flows through local tools:

- `connectExternalApp`
- `listConnectedExternalApps`

Group chats must not expose app connection links or private external app data. Users should DM Zora for external app authentication and private app actions.

## Product Principles

- Zora is a personal assistant, not a generic chatbot, therapist, or productivity dashboard.
- Texting is the primary interface.
- Prefer one concrete useful action over broad advice.
- Ask one question at a time.
- Use Zora reminder tools for reminders, not Google Calendar.
- Use Google Calendar only for the user's external calendar.
- Do not invent facts, deadlines, preferences, connected apps, or tool results.
- Do not pretend integrations or tools exist before they are implemented.
- Store durable context carefully; do not store secrets or unnecessary private data.
- Avoid dumping stale or low-value memories into every prompt.

## Security Principles

- Verify Blooio webhooks before parsing or processing them.
- Use raw request bodies for webhook signature verification.
- Make inbound webhook processing idempotent.
- Store inbound messages before generating/sending replies.
- Keep database access private through Railway networking where possible.
- Use short-lived signed links for sensitive actions like billing, export, and deletion.
- Do not log secrets, credentials, raw private dumps, or full payment data.
- Do not log Composio API keys, OAuth tokens, credentials, Connect Link secrets, or raw private app data.
- Do not expose Composio Connect Links in group chats.
- External app writes such as sending email, creating calendar events, editing Notion, or deleting data require confirmation unless the user already clearly confirmed the exact action.
- Composio stores and refreshes connected account credentials; the app should not store OAuth tokens directly.
