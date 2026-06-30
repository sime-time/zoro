import {
  boolean,
  index,
  pgEnum,
  pgTable,
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
