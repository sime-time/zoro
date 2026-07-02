import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const messageRole = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

export const goalStatus = pgEnum("goal_status", [
  "active",
  "paused",
  "completed",
  "archived",
]);

export const habitStatus = pgEnum("habit_status", [
  "active",
  "paused",
  "archived",
]);

export const habitTargetPeriod = pgEnum("habit_target_period", [
  "day",
  "week",
  "month",
]);

export const habitEventType = pgEnum("habit_event_type", [
  "completed",
  "skipped",
]);

const timestamps = () => ({
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const users = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey(),
    phone: text().notNull(),
    name: text(),
    email: text(),
    timezone: text(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("users_phone_idx").on(table.phone)],
);

export const userFacts = pgTable(
  "user_facts",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text().notNull(),
    value: text().notNull(),
    confidence: real().notNull().default(1),
    source_message_id: uuid().references(() => messages.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    index("user_facts_user_idx").on(table.user_id),
    uniqueIndex("user_facts_user_key_idx").on(table.user_id, table.key),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text(),
    motivation: text(),
    success_criteria: text(),
    status: goalStatus().notNull().default("active"),
    deadline: date(),
    source_message_id: uuid().references(() => messages.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    index("goals_user_idx").on(table.user_id),
    index("goals_user_status_idx").on(table.user_id, table.status),
  ],
);

export const habits = pgTable(
  "habits",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    target_count: integer().notNull().default(1),
    target_period: habitTargetPeriod().notNull().default("day"),
    status: habitStatus().notNull().default("active"),
    source_message_id: uuid().references(() => messages.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    index("habit_user_idx").on(table.user_id),
    index("habit_user_status_idx").on(table.user_id, table.status),
  ],
);

export const habitEvents = pgTable(
  "habit_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habit_id: uuid()
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    event_type: habitEventType().notNull(),
    occurred_on: date().notNull(),
    note: text(),
    source_message_id: uuid().references(() => messages.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    index("habit_events_user_idx").on(table.user_id),
    index("habit_events_habit_date_idx").on(table.habit_id, table.occurred_on),
    index("habit_events_user_date_idx").on(table.user_id, table.occurred_on),
  ],
);

export const threads = pgTable(
  "threads",
  {
    id: uuid().defaultRandom().primaryKey(),
    blooio_chat_id: text().notNull(),
    is_group: boolean().default(false).notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("threads_blooio_chat_idx").on(table.blooio_chat_id)],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    thread_id: uuid()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (table) => [
    index("participants_thread_idx").on(table.thread_id),
    uniqueIndex("participants_user_thread_idx").on(
      table.user_id,
      table.thread_id,
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    thread_id: uuid()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    role: messageRole().notNull(),
    content: text().notNull(),
    ...timestamps(),
  },
  (table) => [
    index("messages_thread_idx").on(table.thread_id),
    index("messages_user_thread_idx").on(table.user_id, table.thread_id),
  ],
);
