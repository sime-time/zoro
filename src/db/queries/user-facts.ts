import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { userFacts } from "../schema";

export type UserFact = typeof userFacts.$inferSelect;

export async function getUserFacts(userId: string): Promise<UserFact[]> {
  return await db.select().from(userFacts).where(eq(userFacts.user_id, userId));
}

export async function upsertUserFacts({
  userId,
  key,
  value,
}: {
  userId: string;
  key: string;
  value: string;
}): Promise<UserFact> {
  const normalizedKey = key.trim();
  const normalizedValue = value.trim();

  if (!normalizedKey) throw new Error("User fact key is required");
  if (!normalizedValue) throw new Error("User fact value is required");

  const [fact] = await db
    .insert(userFacts)
    .values({
      user_id: userId,
      key: normalizedKey,
      value: normalizedValue,
    })
    .onConflictDoUpdate({
      target: [userFacts.user_id, userFacts.key],
      set: {
        value: normalizedValue,
        updated_at: new Date(),
      },
    })
    .returning();

  if (!fact) throw new Error("User fact failed to save");

  return fact;
}

export async function deleteUserFact(userId: string, key: string) {
  return await db
    .delete(userFacts)
    .where(and(eq(userFacts.user_id, userId), eq(userFacts.key, key)));
}
