import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import type { reminderFrequency, reminderStatus, weekdayName } from "../enums";
import { reminders } from "../schema";

export type Reminder = typeof reminders.$inferSelect;
export type ReminderFrequency = (typeof reminderFrequency.enumValues)[number];
export type ReminderStatus = (typeof reminderStatus.enumValues)[number];
export type WeekdayName = (typeof weekdayName.enumValues)[number];

export async function createReminder({
  userId,
  threadId,
  title,
  details,
  remindAt,
  localTime,
  frequency = "once",
  interval = 1,
  weekdays,
  dayOfMonth,
}: {
  userId: string;
  threadId: string;
  title: string;
  details?: string;
  remindAt: Date;
  localTime?: string | null;
  frequency?: ReminderFrequency;
  interval?: number | null;
  weekdays?: WeekdayName[] | null;
  dayOfMonth?: number | null;
}): Promise<Reminder> {
  if (title.trim() === "") {
    throw new Error("Reminder title is required");
  }

  const [reminder] = await db
    .insert(reminders)
    .values({
      user_id: userId,
      thread_id: threadId,
      title: title.trim(),
      details: details?.trim() || null,
      remind_at: remindAt,
      local_time: localTime,
      frequency,
      interval,
      weekdays,
      day_of_month: dayOfMonth,
    })
    .returning();

  if (!reminder) throw new Error("Reminder failed to save");

  return reminder;
}

export async function getReminderById({
  userId,
  reminderId,
}: {
  userId: string;
  reminderId: string;
}): Promise<Reminder> {
  const [reminder] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, reminderId), eq(reminders.user_id, userId)));

  if (!reminder) throw new Error("Reminder not found");

  return reminder;
}

export async function getActiveReminders(userId: string): Promise<Reminder[]> {
  const active = await db
    .select()
    .from(reminders)
    .where(eq(reminders.user_id, userId))
    .orderBy(asc(reminders.remind_at), asc(reminders.created_at));

  return active;
}

export async function updateReminder({
  userId,
  reminderId,
  title,
  details,
  remindAt,
  localTime,
  status,
  frequency,
  interval,
  weekdays,
  dayOfMonth,
}: {
  userId: string;
  reminderId: string;
  title?: string;
  details?: string | null;
  remindAt?: Date;
  localTime?: string | null;
  status?: ReminderStatus;
  frequency?: ReminderFrequency;
  interval?: number | null;
  weekdays?: WeekdayName[] | null;
  dayOfMonth?: number | null;
}): Promise<Reminder> {
  const updates: Partial<typeof reminders.$inferInsert> = {
    updated_at: new Date(),
  };

  if (title !== undefined) {
    if (title.trim() === "") throw new Error("Reminder title is required");
    updates.title = title.trim();
  }

  if (details !== undefined) updates.details = details?.trim() || null;
  if (remindAt !== undefined) updates.remind_at = remindAt;
  if (localTime !== undefined) updates.local_time = localTime;
  if (status !== undefined) updates.status = status;
  if (frequency !== undefined) updates.frequency = frequency;
  if (interval !== undefined) updates.interval = interval;
  if (weekdays !== undefined) updates.weekdays = weekdays;
  if (dayOfMonth !== undefined) updates.day_of_month = dayOfMonth;

  const [reminder] = await db
    .update(reminders)
    .set(updates)
    .where(and(eq(reminders.id, reminderId), eq(reminders.user_id, userId)))
    .returning();

  if (!reminder) {
    throw new Error("Reminder not found or failed to update");
  }

  return reminder;
}

export async function cancelReminder({
  userId,
  reminderId,
}: {
  userId: string;
  reminderId: string;
}): Promise<Reminder> {
  return await updateReminder({ userId, reminderId, status: "cancelled" });
}

export async function completeReminder({
  userId,
  reminderId,
}: {
  userId: string;
  reminderId: string;
}): Promise<Reminder> {
  return await updateReminder({ userId, reminderId, status: "completed" });
}
