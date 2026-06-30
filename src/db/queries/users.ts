import { eq } from "drizzle-orm";
import { db } from "../client";
import { users } from "../schema";

export type User = typeof users.$inferSelect;

function isE164PhoneNumber(input: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(input);
}

export async function findOrCreateUser(phone: string): Promise<User> {
  if (!isE164PhoneNumber(phone)) {
    throw new Error("Phone number must be in E.164 format");
  }

  const [found] = await db.select().from(users).where(eq(users.phone, phone));

  if (found) return found as User;

  const [inserted] = await db
    .insert(users)
    .values({ phone })
    .onConflictDoNothing({ target: users.phone })
    .returning();

  if (inserted) return inserted as User;

  throw new Error("User not found or created");
}

export async function getUserId(phone: string): Promise<string> {
  if (!isE164PhoneNumber(phone)) {
    throw new Error("Phone number must be in E.164 format");
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  return user.id;
}
