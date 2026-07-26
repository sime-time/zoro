import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import type { goalStatus } from "../enums";
import { goals } from "../schema";

export type Goal = typeof goals.$inferSelect;
export type GoalStatus = (typeof goalStatus.enumValues)[number];

export async function getGoalById(goalId: string): Promise<Goal> {
  const [goal] = await db.select().from(goals).where(eq(goals.id, goalId));

  if (!goal) throw new Error("Goal not found");

  return goal;
}

export async function getActiveGoals(userId: string): Promise<Goal[]> {
  return await db
    .select()
    .from(goals)
    .where(and(eq(goals.user_id, userId), eq(goals.status, "active")))
    .orderBy(asc(goals.created_at));
}

export async function createGoal({
  userId,
  title,
  description,
  motivation,
  deadline,
}: {
  userId: string;
  title: string;
  description?: string;
  motivation?: string;
  deadline?: string; // YYYY-MM-DD
}): Promise<Goal> {
  if (title.trim() === "") throw new Error("Goal title is required");

  const [goal] = await db
    .insert(goals)
    .values({
      user_id: userId,
      title: title.trim(),
      description: description?.trim() || null,
      motivation: motivation?.trim() || null,
      deadline: deadline?.trim() || null,
    })
    .returning();

  if (!goal) throw new Error("Goal failed to save");

  return goal;
}

export async function updateGoal({
  userId,
  goalId,
  title,
  description,
  motivation,
  deadline,
  status,
}: {
  userId: string;
  goalId: string;
  title?: string;
  description?: string | null;
  motivation?: string | null;
  deadline?: string | null; // YYYY-MM-DD
  status?: GoalStatus;
}): Promise<Goal> {
  const updates: Partial<typeof goals.$inferInsert> = {
    updated_at: new Date(),
  };

  if (title !== undefined && title.trim() !== "") updates.title = title;
  if (deadline !== undefined) updates.deadline = deadline;
  if (status !== undefined) updates.status = status;

  if (description !== undefined) {
    updates.description = description?.trim() || null;
  }
  if (motivation !== undefined) {
    updates.motivation = motivation?.trim() || null;
  }

  const [goal] = await db
    .update(goals)
    .set(updates)
    .where(and(eq(goals.id, goalId), eq(goals.user_id, userId)))
    .returning();

  if (!goal) throw new Error("Goal not found or failed to update");

  return goal;
}
