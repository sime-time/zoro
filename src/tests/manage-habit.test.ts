import { beforeEach, describe, expect, mock, test } from "bun:test";

const createHabit = mock(async (input: Record<string, unknown>) => ({
  id: "habit-created",
  user_id: input.userId,
  name: input.name,
  description: input.description ?? null,
  target_count: input.targetCount ?? 1,
  target_period: input.targetPeriod ?? "day",
  scheduled_days: input.scheduledDays ?? null,
  status: "active",
  created_at: new Date("2026-07-02T00:00:00.000Z"),
  updated_at: new Date("2026-07-02T00:00:00.000Z"),
}));

const updateHabit = mock(async (input: Record<string, unknown>) => ({
  id: input.habitId,
  user_id: input.userId,
  name: input.name ?? "Existing habit",
  description: input.description ?? null,
  target_count: input.targetCount ?? 1,
  target_period: input.targetPeriod ?? "day",
  scheduled_days: input.scheduledDays ?? null,
  status: input.status ?? "active",
  created_at: new Date("2026-07-02T00:00:00.000Z"),
  updated_at: new Date("2026-07-02T00:00:00.000Z"),
}));

mock.module("../db/queries/habits", () => ({
  createHabit,
  updateHabit,
}));

const { manageHabit, manageHabitSchema } = await import(
  "../agent/workflows/manage-habit"
);

const context = {
  user: { id: "user-1" },
};

describe("manageHabit", () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  test("schema rejects invalid target count", () => {
    const result = manageHabitSchema.safeParse({
      action: "create",
      name: "Gym",
      targetCount: 0,
      targetPeriod: "week",
    });

    expect(result.success).toBe(false);
  });

  test("schema rejects invalid target period", () => {
    const result = manageHabitSchema.safeParse({
      action: "create",
      name: "Gym",
      targetCount: 4,
      targetPeriod: "year",
    });

    expect(result.success).toBe(false);
  });

  test("create requires a name", async () => {
    const result = await manageHabit({ action: "create" }, context as never);

    expect(result).toEqual({
      success: false,
      code: "invalid_habit",
      message: "Habit name is required for new habits",
    });
    expect(createHabit).not.toHaveBeenCalled();
  });

  test("create calls createHabit with habit details", async () => {
    const result = await manageHabit(
      {
        action: "create",
        name: "Gym",
        description: "Lift consistently",
        targetCount: 4,
        targetPeriod: "week",
        scheduledDays: ["monday", "wednesday", "friday", "saturday"],
      },
      context as never,
    );

    expect(createHabit).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Gym",
      description: "Lift consistently",
      targetCount: 4,
      targetPeriod: "week",
      scheduledDays: ["monday", "wednesday", "friday", "saturday"],
    });
    expect(result.success).toBe(true);
    expect(result.newHabit.id).toBe("habit-created");
    expect(result.newHabit.scheduled_days).toEqual([
      "monday",
      "wednesday",
      "friday",
      "saturday",
    ]);
  });

  test("update requires a habitId", async () => {
    const result = await manageHabit(
      { action: "update", name: "Updated habit" },
      context as never,
    );

    expect(result).toEqual({
      success: false,
      code: "invalid_habit",
      message: "habitId is required for updates",
    });
    expect(updateHabit).not.toHaveBeenCalled();
  });

  test("update calls updateHabit with changed fields", async () => {
    const result = await manageHabit(
      {
        action: "update",
        habitId: "habit-1",
        name: "Gym",
        description: "Updated description",
        targetCount: 3,
        targetPeriod: "week",
        scheduledDays: ["wednesday", "thursday", "saturday"],
      },
      context as never,
    );

    expect(updateHabit).toHaveBeenCalledWith({
      userId: "user-1",
      habitId: "habit-1",
      name: "Gym",
      description: "Updated description",
      targetCount: 3,
      targetPeriod: "week",
      scheduledDays: ["wednesday", "thursday", "saturday"],
    });
    expect(result.success).toBe(true);
    expect(result.updatedHabit.id).toBe("habit-1");
    expect(result.updatedHabit.scheduled_days).toEqual([
      "wednesday",
      "thursday",
      "saturday",
    ]);
  });

  test("pause calls updateHabit with paused status", async () => {
    const result = await manageHabit(
      { action: "pause", habitId: "habit-1" },
      context as never,
    );

    expect(updateHabit).toHaveBeenCalledWith({
      userId: "user-1",
      habitId: "habit-1",
      status: "paused",
    });
    expect(result.success).toBe(true);
    expect(result.pausedHabit.status).toBe("paused");
  });

  test("archive calls updateHabit with archived status", async () => {
    const result = await manageHabit(
      { action: "archive", habitId: "habit-1" },
      context as never,
    );

    expect(updateHabit).toHaveBeenCalledWith({
      userId: "user-1",
      habitId: "habit-1",
      status: "archived",
    });
    expect(result.success).toBe(true);
    expect(result.archivedHabit.status).toBe("archived");
  });
});
