import { and, asc, eq, inArray, lte, type SQL, sql } from "drizzle-orm";
import { db } from "../client";
import type { scheduledMessageStatus, scheduledMessageType } from "../enums";
import { scheduledMessages } from "../schema";

export type ScheduledMessage = typeof scheduledMessages.$inferSelect;
export type ScheduledMessageType =
  (typeof scheduledMessageType.enumValues)[number];
export type ScheduledMessageStatus =
  (typeof scheduledMessageStatus.enumValues)[number];

export async function createScheduledMessage({
  userId,
  threadId,
  type,
  scheduledFor,
  content,
  commitmentId,
}: {
  userId: string;
  threadId: string;
  type: ScheduledMessageType;
  scheduledFor: Date;
  content?: string | null;
  commitmentId?: string | null;
}): Promise<ScheduledMessage> {
  const [scheduledMessage] = await db
    .insert(scheduledMessages)
    .values({
      user_id: userId,
      thread_id: threadId,
      commitment_id: commitmentId ?? null,
      type,
      scheduled_for: scheduledFor,
      content: content?.trim() || null,
    })
    .returning();

  if (!scheduledMessage) {
    throw new Error("Scheduled message failed to save");
  }

  return scheduledMessage;
}

export async function getPendingScheduledMessages({
  userId,
  threadId,
  commitmentId,
  limit = 20,
}: {
  userId: string;
  threadId?: string;
  commitmentId?: string;
  limit?: number;
}): Promise<ScheduledMessage[]> {
  const filters: SQL[] = [
    eq(scheduledMessages.user_id, userId),
    eq(scheduledMessages.status, "scheduled"),
  ];

  if (threadId !== undefined) {
    filters.push(eq(scheduledMessages.thread_id, threadId));
  }

  if (commitmentId !== undefined) {
    filters.push(eq(scheduledMessages.commitment_id, commitmentId));
  }

  return await db
    .select()
    .from(scheduledMessages)
    .where(and(...filters))
    .orderBy(
      asc(scheduledMessages.scheduled_for),
      asc(scheduledMessages.created_at),
    )
    .limit(limit);
}

export async function cancelScheduledMessagesForCommitment({
  commitmentId,
}: {
  commitmentId: string;
}): Promise<ScheduledMessage[]> {
  return await db
    .update(scheduledMessages)
    .set({
      status: "cancelled",
      updated_at: new Date(),
    })
    .where(
      and(
        eq(scheduledMessages.commitment_id, commitmentId),
        inArray(scheduledMessages.status, ["scheduled", "processing"]),
      ),
    )
    .returning();
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

export async function claimDueScheduledMessage({
  now = new Date(),
}: {
  now?: Date;
} = {}): Promise<ScheduledMessage | null> {
  const result = await db.execute<ScheduledMessage>(sql`
    update scheduled_messages
    set
      status = 'processing',
      updated_at = now()
    where id = (
      select id
      from scheduled_messages
      where status = 'scheduled'
        and scheduled_for <= ${now}
      order by scheduled_for asc, created_at asc
      for update skip locked
      limit 1
    )
    returning *
  `);

  return result.rows[0] ?? null;
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
    .where(eq(scheduledMessages.id, scheduledMessageId))
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
    .where(eq(scheduledMessages.id, scheduledMessageId))
    .returning();

  if (!scheduledMessage) {
    throw new Error("Scheduled message not found or failed to mark failed");
  }

  return scheduledMessage;
}
