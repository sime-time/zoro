import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  commitmentEventType,
  commitmentStatus,
  goalStatus,
  memoryImportance,
  memoryType,
  messageRole,
  routineTargetPeriod,
  scheduledMessageStatus,
  scheduledMessageType,
} from "./enums";

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

export const meals = pgTable(
  "meals",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text().notNull(),
    log_date: date().notNull(),

    calories: integer().notNull(),
    protein_g: numeric({ precision: 8, scale: 2, mode: "number" }).notNull(),
    carbs_g: numeric({ precision: 8, scale: 2, mode: "number" }).notNull(),
    fat_g: numeric({ precision: 8, scale: 2, mode: "number" }).notNull(),
    ...timestamps(),
  },
  (table) => [
    index("meals_user_idx").on(table.user_id),
    index("meals_user_log_date_idx").on(table.user_id, table.log_date),
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
    status: goalStatus().notNull().default("active"),
    deadline: date(),
    ...timestamps(),
  },
  (table) => [
    index("goals_user_idx").on(table.user_id),
    index("goals_user_status_idx").on(table.user_id, table.status),
  ],
);

// Generates commitments on schedule
export const routines = pgTable(
  "routines",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    thread_id: uuid()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    goal_id: uuid().references(() => goals.id, {
      onDelete: "set null",
    }),
    title: text().notNull(),
    description: text(),
    target_count: integer().notNull().default(1),
    target_period: routineTargetPeriod().notNull().default("week"),
    is_active: boolean().notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    index("routines_user_idx").on(table.user_id),
    index("routines_thread_idx").on(table.thread_id),
    index("routines_goal_idx").on(table.goal_id),
    index("routines_active_idx").on(table.user_id, table.is_active),
  ],
);

export const commitments = pgTable(
  "commitments",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    thread_id: uuid()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    goal_id: uuid().references(() => goals.id, {
      onDelete: "set null",
    }),
    source_message_id: uuid().references(() => messages.id, {
      onDelete: "set null",
    }),

    title: text().notNull(),
    details: text(),
    motivation: text(),
    success_criteria: text(),

    status: commitmentStatus().notNull().default("pending"),
    due_at: timestamp({ withTimezone: true }),
    resolved_at: timestamp({ withTimezone: true }),

    routine_id: uuid().references(() => routines.id, {
      onDelete: "set null",
    }),
    routine_period_start: date(),
    routine_period_end: date(),
    routine_slot: integer(),

    ...timestamps(),
  },

  (table) => [
    index("commitments_user_status_idx").on(table.user_id, table.status),
    index("commitments_due_idx").on(table.status, table.due_at),
    index("commitments_goal_idx").on(table.goal_id),
    index("commitments_routine_idx").on(table.routine_id),
    index("commitments_thread_idx").on(table.thread_id),
    uniqueIndex("commitments_routine_slot_idx").on(
      table.routine_id,
      table.routine_period_start,
      table.routine_slot,
    ),
  ],
);

export const commitmentEvents = pgTable(
  "commitment_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    commitment_id: uuid()
      .notNull()
      .references(() => commitments.id, { onDelete: "cascade" }),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source_message_id: uuid().references(() => messages.id, {
      onDelete: "set null",
    }),

    type: commitmentEventType().notNull(),
    note: text(),
    metadata: jsonb(),
    occurred_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index("commitment_events_commitment_idx").on(
      table.commitment_id,
      table.occurred_at,
    ),
    index("commitment_events_user_idx").on(table.user_id, table.occurred_at),
  ],
);

export const scheduledMessages = pgTable(
  "scheduled_messages",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    thread_id: uuid()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    commitment_id: uuid().references(() => commitments.id, {
      onDelete: "cascade",
    }),
    message_id: uuid().references(() => messages.id, { onDelete: "set null" }),

    type: scheduledMessageType().notNull(),
    scheduled_for: timestamp({ withTimezone: true }).notNull(),
    status: scheduledMessageStatus().notNull().default("scheduled"),
    content: text(),
    sent_at: timestamp({ withTimezone: true }),
    last_error: text(),
    ...timestamps(),
  },
  (table) => [
    index("scheduled_messages_dispatch_idx").on(
      table.status,
      table.scheduled_for,
    ),
    index("scheduled_messages_user_idx").on(table.user_id, table.scheduled_for),
    index("scheduled_messages_commitment_idx").on(table.commitment_id),
    index("scheduled_messages_thread_idx").on(table.thread_id),
  ],
);

export const memories = pgTable("memories", {
  id: uuid().defaultRandom().primaryKey(),
  user_id: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  source_message_id: uuid().references(() => messages.id, {
    onDelete: "set null",
  }),

  type: memoryType().notNull(),
  subject: text().notNull(), // short label/category for memory
  content: text().notNull(), // actual remembered statement

  importance: memoryImportance().notNull().default("normal"),
  is_active: boolean().notNull().default(true),

  ...timestamps(),
});
