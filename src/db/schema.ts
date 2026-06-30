import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "assistant", "system"]);

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
