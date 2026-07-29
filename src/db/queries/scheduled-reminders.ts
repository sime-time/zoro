import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { reminders, scheduledMessages } from "../schema";
import type { Reminder, ReminderFrequency, WeekdayName } from "./reminders";
import type { ScheduledMessage } from "./scheduled";

export async function createScheduledReminder({
  userId,
  threadId,
  title,
  details,
  localTime,
  frequency = "once",
  interval = 1,
  weekdays,
  dayOfMonth,
  scheduledFor,
  content,
}: {
  userId: string;
  threadId: string;
  title: string;
  details?: string;
  localTime?: string | null;
  frequency?: ReminderFrequency;
  interval?: number;
  weekdays?: WeekdayName[] | null;
  dayOfMonth?: number | null;
  scheduledFor: Date;
  content?: string;
}): Promise<{ reminder: Reminder; scheduledMessage: ScheduledMessage }> {
  if (title.trim() === "") {
    throw new Error("Reminder title is required");
  }

  return await db.transaction(async (tx) => {
    const [reminder] = await tx
      .insert(reminders)
      .values({
        user_id: userId,
        thread_id: threadId,
        title: title.trim(),
        details: details?.trim() || null,
        local_time: localTime,
        frequency,
        interval,
        weekdays,
        day_of_month: dayOfMonth,
      })
      .returning();

    if (!reminder) {
      throw new Error("Reminder failed to save");
    }

    const [scheduledMessage] = await tx
      .insert(scheduledMessages)
      .values({
        user_id: userId,
        thread_id: threadId,
        reminder_id: reminder.id,
        scheduled_for: scheduledFor,
        content: content?.trim() || reminder.title,
      })
      .returning();

    if (!scheduledMessage) {
      throw new Error("Scheduled message failed to save");
    }

    return { reminder, scheduledMessage };
  });
}

export async function cancelScheduledReminder({
  userId,
  reminderId,
  scheduledMessageId,
}: {
  userId: string;
  reminderId: string;
  scheduledMessageId: string;
}) {
  return await db.transaction(async (tx) => {
    const [reminder] = await tx
      .update(reminders)
      .set({ status: "cancelled", updated_at: new Date() })
      .where(
        and(
          eq(reminders.id, reminderId),
          eq(reminders.user_id, userId),
          eq(reminders.status, "active"),
        ),
      )
      .returning();

    if (!reminder) throw new Error("Reminder not found or failed to cancel");

    const [scheduledMessage] = await tx
      .update(scheduledMessages)
      .set({ status: "cancelled", updated_at: new Date() })
      .where(
        and(
          eq(scheduledMessages.id, scheduledMessageId),
          eq(scheduledMessages.reminder_id, reminderId),
          eq(scheduledMessages.user_id, userId),
          eq(scheduledMessages.status, "scheduled"),
        ),
      )
      .returning();

    if (!scheduledMessage)
      throw new Error("Scheduled message not found or failed to cancel");

    return { reminder, scheduledMessage };
  });
}

export async function cancelReminderAndScheduledMessages({
  userId,
  reminderId,
}: {
  userId: string;
  reminderId: string;
}) {
  return await db.transaction(async (tx) => {
    const [reminder] = await tx
      .update(reminders)
      .set({ status: "cancelled", updated_at: new Date() })
      .where(
        and(
          eq(reminders.id, reminderId),
          eq(reminders.user_id, userId),
          eq(reminders.status, "active"),
        ),
      )
      .returning();

    if (!reminder) throw new Error("Reminder not found or failed to cancel");

    const scheduledMessagesResult = await tx
      .update(scheduledMessages)
      .set({ status: "cancelled", updated_at: new Date() })
      .where(
        and(
          eq(scheduledMessages.reminder_id, reminderId),
          eq(scheduledMessages.user_id, userId),
          eq(scheduledMessages.status, "scheduled"),
        ),
      )
      .returning();

    return { reminder, scheduledMessages: scheduledMessagesResult };
  });
}
