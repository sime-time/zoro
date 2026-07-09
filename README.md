## Project Overview

Zoro is a smart friend and accountability agent that lives primarily inside iMessage/SMS.

The product helps users notice drift, make decisions, and follow through on the goals that matter to them. It should feel like a sharp friend in their pocket: direct, socially aware, encouraging when useful, and willing to call out mismatch between stated goals and actual behavior.

Positioning:

> The smart friend who helps you actually follow through.

Core promise:

> Text what is going on. Zoro helps you see the next move, stay honest, and keep momentum on your goals.

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
Profile, memory, and goal context are loaded/updated
  ↓
AI generates a short text-native reply
  ↓
Blooio sends reply back to user
```

Durable reminders follow the same text-native delivery path:

```txt
Zoro schedules a reminder
  ↓
Inngest stores and runs the scheduled job durably
  ↓
Blooio sends the reminder as an iMessage/SMS text
```

## Product Scope

Build the most useful text-native accountability agent.

MVP focus:

- Phone-number-based accounts.
- Conversational onboarding.
- Durable user profile, goals, preferences, and memory.
- Goal-aware conversation that helps users decide and follow through.
- Subscription gating through Stripe.
- Durable reminders scheduled with Inngest and delivered through Blooio texts.
- Safety handling for dangerous or high-risk messages.

## Product Principles

- Zoro is not a generic chatbot, task manager, therapist, or productivity dashboard.
- Texting is the primary interface.
- Prefer one concrete next action over broad advice.
- Ask one question at a time.
- Do not invent goals, facts, deadlines, preferences, or constraints.
- Do not pretend integrations or tools exist before they are implemented.
- Store durable context carefully; do not store secrets or unnecessary private data.

## Security Principles

- Verify Blooio webhooks before parsing or processing them.
- Use raw request bodies for webhook signature verification.
- Make inbound webhook processing idempotent.
- Store inbound messages before generating/sending replies.
- Keep database access private through Railway networking where possible.
- Use short-lived signed links for sensitive actions like billing, export, and deletion.
- Do not log secrets, credentials, raw private dumps, or full payment data.
