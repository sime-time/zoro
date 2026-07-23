import { and, asc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { db } from "../client";
import type { commitmentEventType, commitmentStatus } from "../enums";
import { commitmentEvents, commitments } from "../schema";

export type Commitment = typeof commitments.$inferSelect;
export type CommitmentStatus = (typeof commitmentStatus.enumValues)[number];
export type CommitmentEvent = typeof commitmentEvents.$inferSelect;
export type CommitmentEventType =
  (typeof commitmentEventType.enumValues)[number];

export async function createCommitment({
  title,
  userId,
  threadId,
  goalId,
  routineId,
  sourceMessageId,
  details,
  motivation,
  successCriteria,
  dueAt,
  routinePeriodStart,
  routinePeriodEnd,
  routineSlot,
}: {
  title: string;
  userId: string;
  threadId: string;
  goalId?: string | null;
  routineId?: string | null;
  sourceMessageId?: string | null;
  details?: string | null;
  motivation?: string | null;
  successCriteria?: string | null;
  dueAt?: Date | null;
  routinePeriodStart?: string | null;
  routinePeriodEnd?: string | null;
  routineSlot?: number | null;
}): Promise<Commitment> {
  if (title.trim() === "") throw new Error("Commitment title is required");

  if (routineSlot && routineSlot < 1) {
    throw new Error("Routine slot must be at least 1");
  }

  const [commitment] = await db
    .insert(commitments)
    .values({
      user_id: userId,
      thread_id: threadId,
      goal_id: goalId ?? null,
      routine_id: routineId ?? null,
      source_message_id: sourceMessageId ?? null,
      title: title.trim(),
      details: details?.trim() || null,
      motivation: motivation?.trim() || null,
      success_criteria: successCriteria?.trim() || null,
      due_at: dueAt ?? null,
      routine_period_start: routinePeriodStart ?? null,
      routine_period_end: routinePeriodEnd ?? null,
      routine_slot: routineSlot ?? null,
    })
    .returning();

  if (!commitment) throw new Error("Commitment failed to save");

  return commitment;
}

export async function updateCommitment({
  userId,
  commitmentId,
  goalId,
  title,
  details,
  motivation,
  successCriteria,
  dueAt,
  status,
  resolvedAt,
}: {
  userId: string;
  commitmentId: string;
  goalId?: string | null;
  title?: string;
  details?: string | null;
  motivation?: string | null;
  successCriteria?: string | null;
  dueAt?: Date | null;
  status?: CommitmentStatus;
  resolvedAt?: Date | null;
}): Promise<Commitment> {
  type CommitmentInsert = typeof commitments.$inferInsert;

  const updates: Partial<CommitmentInsert> = {
    updated_at: new Date(),
  };

  if (title !== undefined) {
    if (title.trim() === "") throw new Error("Commitment title is required");
    updates.title = title.trim();
  }

  if (goalId !== undefined) updates.goal_id = goalId;
  if (details !== undefined) updates.details = details?.trim() || null;
  if (motivation !== undefined) updates.motivation = motivation?.trim() || null;
  if (successCriteria !== undefined) {
    updates.success_criteria = successCriteria?.trim() || null;
  }
  if (dueAt !== undefined) updates.due_at = dueAt;
  if (status !== undefined) updates.status = status;
  if (resolvedAt !== undefined) updates.resolved_at = resolvedAt;

  const [commitment] = await db
    .update(commitments)
    .set(updates)
    .where(
      and(eq(commitments.id, commitmentId), eq(commitments.user_id, userId)),
    )
    .returning();

  if (!commitment) throw new Error("Commitment not found or failed to update");

  return commitment;
}

export async function getUnresolvedCommitments(
  userId: string,
): Promise<Commitment[]> {
  return await db
    .select()
    .from(commitments)
    .where(
      and(
        eq(commitments.user_id, userId),
        inArray(commitments.status, ["pending", "blocked", "in_progress"]),
      ),
    )
    .orderBy(asc(commitments.due_at), asc(commitments.created_at));
}

export async function resolveCommitment({
  userId,
  commitmentId,
  status,
  resolvedAt = new Date(),
}: {
  userId: string;
  commitmentId: string;
  status: CommitmentStatus;
  resolvedAt?: Date;
}): Promise<Commitment> {
  return await updateCommitment({
    userId,
    commitmentId,
    status,
    resolvedAt,
  });
}

export async function getCommitmentsForRoutinePeriod({
  userId,
  routineId,
  periodStart,
  periodEnd,
}: {
  userId: string;
  routineId: string;
  periodStart: string;
  periodEnd: string;
}) {
  return await db
    .select()
    .from(commitments)
    .where(
      and(
        eq(commitments.user_id, userId),
        eq(commitments.routine_id, routineId),
        eq(commitments.routine_period_start, periodStart),
        eq(commitments.routine_period_end, periodEnd),
      ),
    )
    .orderBy(asc(commitments.routine_slot), asc(commitments.created_at));
}

// === COMMITMENT EVENTS ===

export async function createCommitmentEvent({
  userId,
  commitmentId,
  type,
  note,
  metadata,
  occurredAt,
  messageId,
}: {
  userId: string;
  commitmentId: string;
  type: CommitmentEventType;
  note?: string | null;
  metadata?: unknown;
  occurredAt?: Date;
  messageId?: string | null;
}): Promise<CommitmentEvent> {
  const [event] = await db
    .insert(commitmentEvents)
    .values({
      user_id: userId,
      commitment_id: commitmentId,
      source_message_id: messageId ?? null,
      type,
      note: note?.trim() || null,
      metadata,
      occurred_at: occurredAt ?? new Date(),
    })
    .returning();

  if (!event) throw new Error("Commitment event failed to save");

  return event;
}

export async function getCommitmentEvents({
  userId,
  commitmentId,
  from,
  to,
}: {
  userId: string;
  commitmentId?: string;
  from?: Date;
  to?: Date;
}): Promise<CommitmentEvent[]> {
  const filters: SQL[] = [eq(commitmentEvents.user_id, userId)];

  if (commitmentId !== undefined) {
    filters.push(eq(commitmentEvents.commitment_id, commitmentId));
  }

  if (from !== undefined) {
    filters.push(gte(commitmentEvents.occurred_at, from));
  }

  if (to !== undefined) {
    filters.push(lte(commitmentEvents.occurred_at, to));
  }

  const events = await db
    .select()
    .from(commitmentEvents)
    .where(and(...filters))
    .orderBy(
      asc(commitmentEvents.occurred_at),
      asc(commitmentEvents.created_at),
    );

  return events;
}
