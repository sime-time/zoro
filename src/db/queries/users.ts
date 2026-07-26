import { eq } from "drizzle-orm";
import parsePhoneNumber from "libphonenumber-js";
import { db } from "../client";
import { users } from "../schema";

export type User = typeof users.$inferSelect;

export async function findOrCreateUser(phoneNumber: string): Promise<User> {
  const phone = parsePhoneNumber(phoneNumber);
  if (!phone) {
    throw new Error("Phone number is not valid");
  }

  const [inserted] = await db
    .insert(users)
    .values({ phone: phone.number })
    .onConflictDoNothing({ target: users.phone })
    .returning();

  if (inserted) return inserted as User;

  const [found] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone.number));

  if (found) return found as User;

  throw new Error("User not found or created");
}

export async function getUserId(phoneNumber: string): Promise<string> {
  const phone = parsePhoneNumber(phoneNumber);
  if (!phone) {
    throw new Error("Phone number is not valid");
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, phone.number))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  return user.id;
}

export async function getUserById(userId: string): Promise<User> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function updateTimezone(userId: string, timezone: string) {
  const [user] = await db
    .update(users)
    .set({
      timezone,
      updated_at: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  if (!user) {
    throw new Error("User timezone not saved");
  }

  return user;
}

export async function updateUserName(userId: string, name: string) {
  const [user] = await db
    .update(users)
    .set({ name, updated_at: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!user) {
    throw new Error("User name not saved");
  }

  return user;
}
