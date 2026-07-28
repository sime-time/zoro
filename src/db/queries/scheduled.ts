import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "../client";
import type { scheduledMessageStatus } from "../enums";
import { scheduledMessages } from "../schema";

export type ScheduledMessage = typeof scheduledMessages.$inferSelect;
export type ScheduledMessageStatus =
  (typeof scheduledMessageStatus.enumValues)[number];

export async function createScheduledMessage({
  userId,
  threadId,
  reminderId,
  scheduledFor,
  content,
}: {
  userId: string;
  threadId: string;
  reminderId: string;
  scheduledFor: Date;
  content?: string | null;
}): Promise<ScheduledMessage> {
  const [scheduledMessage] = await db
    .insert(scheduledMessages)
    .values({
      user_id: userId,
      thread_id: threadId,
      reminder_id: reminderId,
      scheduled_for: scheduledFor,
      content: content?.trim() || null,
    })
    .returning();

  if (!scheduledMessage) {
    throw new Error("Scheduled message failed to save");
  }

  return scheduledMessage;
}

export async function claimScheduledMessageById({
  scheduledMessageId,
  now = new Date(),
}: {
  scheduledMessageId: string;
  now?: Date;
}): Promise<ScheduledMessage | null> {
  const [scheduledMessage] = await db
    .update(scheduledMessages)
    .set({
      status: "processing",
      updated_at: new Date(),
    })
    .where(
      and(
        eq(scheduledMessages.id, scheduledMessageId),
        eq(scheduledMessages.status, "scheduled"),
        lte(scheduledMessages.scheduled_for, now),
      ),
    )
    .returning();

  if (!scheduledMessage) return null;

  return scheduledMessage;
}

export async function cancelProcessingScheduledMessage(
  scheduledMessageId: string,
) {
  const [cancelled] = await db
    .update(scheduledMessages)
    .set({ status: "cancelled", updated_at: new Date() })
    .where(
      and(
        eq(scheduledMessages.id, scheduledMessageId),
        eq(scheduledMessages.status, "processing"),
      ),
    )
    .returning();

  return cancelled;
}

export async function cancelScheduledMessagesForReminder(reminderId: string) {
  const cancelled = await db
    .update(scheduledMessages)
    .set({ status: "cancelled", updated_at: new Date() })
    .where(
      and(
        eq(scheduledMessages.reminder_id, reminderId),
        eq(scheduledMessages.status, "scheduled"),
      ),
    )
    .returning();

  return cancelled;
}

export async function markScheduledMessageSent({
  scheduledMessageId,
  messageId,
  sentAt = new Date(),
}: {
  scheduledMessageId: string;
  messageId?: string | null;
  sentAt?: Date;
}): Promise<ScheduledMessage> {
  const [scheduledMessage] = await db
    .update(scheduledMessages)
    .set({
      status: "sent",
      message_id: messageId ?? null,
      sent_at: sentAt,
      last_error: null,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(scheduledMessages.id, scheduledMessageId),
        eq(scheduledMessages.status, "processing"),
      ),
    )
    .returning();

  if (!scheduledMessage) {
    throw new Error("Scheduled message not found or failed to mark sent");
  }

  return scheduledMessage;
}

export async function markScheduledMessageFailed({
  scheduledMessageId,
  error,
}: {
  scheduledMessageId: string;
  error: unknown;
}): Promise<ScheduledMessage> {
  const message = error instanceof Error ? error.message : String(error);

  const [scheduledMessage] = await db
    .update(scheduledMessages)
    .set({
      status: "failed",
      last_error: message,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(scheduledMessages.id, scheduledMessageId),
        eq(scheduledMessages.status, "processing"),
      ),
    )
    .returning();

  if (!scheduledMessage) {
    throw new Error("Scheduled message not found or failed to mark failed");
  }

  return scheduledMessage;
}
