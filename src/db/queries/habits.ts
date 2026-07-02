import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "../client";
import {
  habitEvents,
  type habitStatus,
  habits,
  type habitTargetPeriod,
  type weekDays,
} from "../schema";

export type Habit = typeof habits.$inferSelect;
export type HabitEvent = typeof habitEvents.$inferSelect;
export type HabitStatus = (typeof habitStatus.enumValues)[number];
export type HabitTargetPeriod = (typeof habitTargetPeriod.enumValues)[number];
export type WeekDays = (typeof weekDays.enumValues)[number];

export async function getActiveHabits(userId: string): Promise<Habit[]> {
  return await db
    .select()
    .from(habits)
    .where(and(eq(habits.user_id, userId), eq(habits.status, "active")))
    .orderBy(asc(habits.created_at));
}

export async function createHabit({
  userId,
  name,
  description,
  targetCount = 1,
  targetPeriod = "day",
  scheduledDays,
}: {
  userId: string;
  name: string;
  description?: string;
  targetCount?: number;
  targetPeriod?: HabitTargetPeriod;
  scheduledDays?: WeekDays[];
}): Promise<Habit> {
  if (name.trim() === "") throw new Error("Habit name is required");

  if (targetCount < 1) {
    throw new Error("Habit target count must be at least 1");
  }

  const [habit] = await db
    .insert(habits)
    .values({
      user_id: userId,
      name: name.trim(),
      description: description?.trim() || null,
      target_count: targetCount,
      target_period: targetPeriod,
      scheduled_days: scheduledDays,
    })
    .returning();

  if (!habit) throw new Error("Habit failed to save");

  return habit;
}

export async function updateHabit({
  userId,
  habitId,
  name,
  description,
  targetCount,
  targetPeriod,
  scheduledDays,
  status,
}: {
  userId: string;
  habitId: string;
  name?: string;
  description?: string | null;
  targetCount?: number;
  targetPeriod?: HabitTargetPeriod;
  scheduledDays?: WeekDays[];
  status?: HabitStatus;
}): Promise<Habit> {
  const updates: Partial<typeof habits.$inferInsert> = {
    updated_at: new Date(),
  };

  if (name !== undefined && name.trim() !== "") updates.name = name;

  if (description !== undefined) {
    updates.description = description?.trim() || null;
  }

  if (targetCount !== undefined) {
    if (targetCount < 1) {
      throw new Error("Habit target count must be at least 1");
    }
    updates.target_count = targetCount;
  }

  if (targetPeriod !== undefined) updates.target_period = targetPeriod;
  if (scheduledDays !== undefined) updates.scheduled_days = scheduledDays;
  if (status !== undefined) updates.status = status;

  const [habit] = await db
    .update(habits)
    .set(updates)
    .where(and(eq(habits.id, habitId), eq(habits.user_id, userId)))
    .returning();

  if (!habit) throw new Error("Habit not found or failed to update");

  return habit;
}

export async function recordHabitCompletion({
  userId,
  habitId,
  occurred,
  note,
}: {
  userId: string;
  habitId: string;
  occurred: string; // YYYY-MM-DD
  note?: string;
}): Promise<HabitEvent> {
  const [event] = await db
    .insert(habitEvents)
    .values({
      user_id: userId,
      habit_id: habitId,
      status: "completed",
      occurred,
      note: note?.trim() || null,
    })
    .returning();

  if (!event) throw new Error("Habit completion failed to save");

  return event;
}

export async function getHabitEvents({
  userId,
  habitId,
  to,
  from,
}: {
  userId: string;
  habitId?: string;
  to?: string; // YYYY-MM-DD
  from?: string; // YYYY-MM-DD
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
