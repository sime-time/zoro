import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import type { routineTargetPeriod } from "../enums";
import { routines } from "../schema";

export type Routine = typeof routines.$inferSelect;
export type TargetPeriod = (typeof routineTargetPeriod.enumValues)[number];

export async function getActiveRoutines(userId: string): Promise<Routine[]> {
  return await db
    .select()
    .from(routines)
    .where(and(eq(routines.user_id, userId), eq(routines.is_active, true)))
    .orderBy(asc(routines.created_at));
}

export async function createRoutine({
  title,
  userId,
  goalId,
  description,
  targetCount = 1,
  targetPeriod = "week",
}: {
  title: string;
  userId: string;
  goalId?: string;
  description?: string;
  targetCount?: number;
  targetPeriod?: TargetPeriod;
}): Promise<Routine> {
  if (title.trim() === "") throw new Error("Routine title is required");

  if (targetCount < 1) {
    throw new Error("Target count must be at least 1");
  }

  const [routine] = await db
    .insert(routines)
    .values({
      title: title.trim(),
      user_id: userId,
      goal_id: goalId ?? null,
      description: description?.trim() || null,
      target_count: targetCount,
      target_period: targetPeriod,
      is_active: true,
    })
    .returning();

  if (!routine) throw new Error("Routine failed to save");

  return routine;
}

export async function updateRoutine({
  userId,
  routineId,
  goalId,
  title,
  description,
  targetCount,
  targetPeriod,
  isActive,
}: {
  userId: string;
  routineId: string;
  goalId?: string;
  title?: string;
  description?: string | null;
  targetCount?: number;
  targetPeriod?: TargetPeriod;
  isActive?: boolean;
}): Promise<Routine> {
  const updates: Partial<typeof routines.$inferInsert> = {
    updated_at: new Date(),
  };

  if (title !== undefined && title.trim() !== "") updates.title = title.trim();

  if (description !== undefined) {
    updates.description = description?.trim() || null;
  }

  if (targetCount !== undefined) {
    if (targetCount < 1) {
      throw new Error("Target count must be at least 1");
    }
    if (!Number.isInteger(targetCount)) {
      throw new Error("Target count must be an integer");
    }
    updates.target_count = targetCount;
  }

  if (targetPeriod !== undefined) updates.target_period = targetPeriod;
  if (isActive !== undefined) updates.is_active = isActive;
  if (goalId !== undefined) updates.goal_id = goalId;

  const [routine] = await db
    .update(routines)
    .set(updates)
    .where(and(eq(routines.id, routineId), eq(routines.user_id, userId)))
    .returning();

  if (!routine) throw new Error("Routine not found or failed to update");

  return routine;
}
