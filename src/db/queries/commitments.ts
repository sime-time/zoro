import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
export async function getHabitEvents({
  userId,
  habitId,
  from,
  to,
}: {
  userId: string;
  habitId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}): Promise<HabitEvent[]> {
  const filters: SQL[] = [eq(habitEvents.user_id, userId)];

  if (habitId !== undefined) {
    filters.push(eq(habitEvents.habit_id, habitId));
  }

  if (from !== undefined) {
    filters.push(gte(habitEvents.occurred, from));
  }

  if (to !== undefined) {
    filters.push(lte(habitEvents.occurred, to));
  }

  const events = await db
    .select()
    .from(habitEvents)
    .where(and(...filters))
    .orderBy(asc(habitEvents.occurred), asc(habitEvents.created_at));

  return events;
}
