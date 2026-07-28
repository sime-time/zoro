import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  memoryImportance,
  memoryType,
  messageRole,
  reminderFrequency,
  reminderStatus,
  scheduledMessageStatus,
  weekdayName,
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

export const reminders = pgTable(
  "reminders",
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    thread_id: uuid()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),

    title: text().notNull(),
    details: text(),
    status: reminderStatus().notNull().default("active"),

    // initial reminder timestamp for the first scheduled message
    remind_at: timestamp({ withTimezone: true }).notNull(),

    local_time: text(), // HH:mm
    frequency: reminderFrequency().notNull().default("once"),
    interval: integer(), // every X days/weeks/months
    weekdays: weekdayName().array(),
    day_of_month: integer(),

    ...timestamps(),
  },
  (table) => [
    index("reminders_user_status_idx").on(table.user_id, table.status),
    index("reminders_thread_idx").on(table.thread_id),
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
    reminder_id: uuid()
      .notNull()
      .references(() => reminders.id, {
        onDelete: "cascade",
      }),
    message_id: uuid().references(() => messages.id, { onDelete: "set null" }),

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
    index("scheduled_messages_reminder_idx").on(table.reminder_id),
    index("scheduled_messages_thread_idx").on(table.thread_id),
  ],
);
