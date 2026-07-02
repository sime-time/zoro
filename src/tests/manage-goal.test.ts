import { beforeEach, describe, expect, mock, test } from "bun:test";

const createGoal = mock(async (input: Record<string, unknown>) => ({
  id: "goal-created",
  user_id: input.userId,
  title: input.title,
  description: input.description ?? null,
  motivation: input.motivation ?? null,
  deadline: input.deadline ?? null,
  status: "active",
  created_at: new Date("2026-07-02T00:00:00.000Z"),
  updated_at: new Date("2026-07-02T00:00:00.000Z"),
}));

const updateGoal = mock(async (input: Record<string, unknown>) => ({
  id: input.goalId,
  user_id: input.userId,
  title: input.title ?? "Existing goal",
  description: input.description ?? null,
  motivation: input.motivation ?? null,
  deadline: input.deadline ?? null,
  status: input.status ?? "active",
  created_at: new Date("2026-07-02T00:00:00.000Z"),
  updated_at: new Date("2026-07-02T00:00:00.000Z"),
}));

mock.module("../db/queries/goals", () => ({
  createGoal,
  updateGoal,
}));

const { manageGoal, manageGoalSchema } = await import(
  "../agent/workflows/manage-goal"
);

const context = {
  user: { id: "user-1" },
};

describe("manageGoal", () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  test("schema rejects invalid deadline format", () => {
    const result = manageGoalSchema.safeParse({
      action: "create",
      title: "Ship Zoro MVP",
      deadline: "tomorrow",
    });

    expect(result.success).toBe(false);
  });

  test("create requires a title", async () => {
    const result = await manageGoal({ action: "create" }, context as never);

    expect(result).toEqual({
      success: false,
      code: "invalid_goal",
      message: "Goal title is required for new goals",
    });
    expect(createGoal).not.toHaveBeenCalled();
  });

  test("create calls createGoal with goal details", async () => {
    const result = await manageGoal(
      {
        action: "create",
        title: "Ship Zoro MVP",
        description: "Finish memory and habits",
        motivation: "Prove text accountability works",
        deadline: "2026-07-15",
      },
      context as never,
    );

    expect(createGoal).toHaveBeenCalledWith({
      userId: "user-1",
      title: "Ship Zoro MVP",
      description: "Finish memory and habits",
      motivation: "Prove text accountability works",
      deadline: "2026-07-15",
    });
    expect(result.success).toBe(true);
    expect(result.newGoal.id).toBe("goal-created");
  });

  test("update requires a goalId", async () => {
    const result = await manageGoal(
      { action: "update", title: "Updated goal" },
      context as never,
    );

    expect(result).toEqual({
      success: false,
      code: "invalid_goal",
      message: "goalId is required for updates",
    });
    expect(updateGoal).not.toHaveBeenCalled();
  });

  test("update calls updateGoal with changed fields", async () => {
    const result = await manageGoal(
      {
        action: "update",
        goalId: "goal-1",
        title: "Updated goal",
        description: "Updated description",
      },
      context as never,
    );

    expect(updateGoal).toHaveBeenCalledWith({
      userId: "user-1",
      goalId: "goal-1",
      title: "Updated goal",
      description: "Updated description",
      motivation: undefined,
      deadline: undefined,
    });
    expect(result.success).toBe(true);
    expect(result.updatedGoal.id).toBe("goal-1");
  });

  test("complete calls updateGoal with completed status", async () => {
    const result = await manageGoal(
      { action: "complete", goalId: "goal-1" },
      context as never,
    );

    expect(updateGoal).toHaveBeenCalledWith({
      userId: "user-1",
      goalId: "goal-1",
      status: "completed",
    });
    expect(result.success).toBe(true);
    expect(result.completedGoal.status).toBe("completed");
  });

  test("archive calls updateGoal with archived status", async () => {
    const result = await manageGoal(
      { action: "archive", goalId: "goal-1" },
      context as never,
    );

    expect(updateGoal).toHaveBeenCalledWith({
      userId: "user-1",
      goalId: "goal-1",
      status: "archived",
    });
    expect(result.success).toBe(true);
    expect(result.archivedGoal.status).toBe("archived");
  });
});
