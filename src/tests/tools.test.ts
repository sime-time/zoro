import { beforeEach, describe, expect, mock, test } from "bun:test";

const updateTimezone = mock(async (userId: string, timezone: string) => ({
  id: userId,
  timezone,
}));

const recordHabitCompletion = mock(async (input: Record<string, unknown>) => ({
  id: "habit-event-1",
  user_id: input.userId,
  habit_id: input.habitId,
  status: "completed",
  occurred: input.occurred,
  note: input.note ?? null,
  created_at: new Date("2026-07-02T00:00:00.000Z"),
  updated_at: new Date("2026-07-02T00:00:00.000Z"),
}));

const createGoal = mock(async () => ({ id: "goal-1" }));
const updateGoal = mock(async () => ({ id: "goal-1" }));
const createHabit = mock(async () => ({ id: "habit-1" }));
const updateHabit = mock(async () => ({ id: "habit-1" }));

mock.module("../db/queries/users", () => ({
  updateTimezone,
}));

mock.module("../db/queries/habits", () => ({
  createHabit,
  updateHabit,
  recordHabitCompletion,
}));

mock.module("../db/queries/goals", () => ({
  createGoal,
  updateGoal,
}));

const { createTools } = await import("../agent/tools");

type ExecutableTool<Input, Output = unknown> = {
  execute: (input: Input) => Promise<Output>;
};

function createContext(timezone: string | null) {
  return {
    user: {
      id: "user-1",
      phone: "+15555555555",
      name: "Simon",
      email: null,
      timezone,
      created_at: new Date("2026-07-02T00:00:00.000Z"),
      updated_at: new Date("2026-07-02T00:00:00.000Z"),
    },
    isGroupChat: false,
    service: "SMS",
  };
}

describe("createTools", () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  test("setUserTimezone saves valid IANA timezones", async () => {
    const tools = createTools(createContext(null) as never);
    const setUserTimezone = tools?.setUserTimezone as ExecutableTool<{
      timezone: string;
    }>;

    const result = await setUserTimezone.execute({
      timezone: "America/Los_Angeles",
    });

    expect(updateTimezone).toHaveBeenCalledWith(
      "user-1",
      "America/Los_Angeles",
    );
    expect(result).toEqual({
      success: true,
      userTimezone: "America/Los_Angeles",
    });
  });

  test("setUserTimezone rejects invalid timezones", async () => {
    const tools = createTools(createContext(null) as never);
    const setUserTimezone = tools?.setUserTimezone as ExecutableTool<{
      timezone: string;
    }>;

    const result = await setUserTimezone.execute({ timezone: "not-a-zone" });

    expect(updateTimezone).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      code: "invalid_timezone",
      message: "Timezone is not in IANA format",
    });
  });

  test("manageGoal returns timezone guard result when timezone is missing", async () => {
    const tools = createTools(createContext(null) as never);
    const manageGoalTool = tools?.manageGoal as ExecutableTool<{
      action: "create";
    }>;

    const result = await manageGoalTool.execute({ action: "create" });

    expect(createGoal).not.toHaveBeenCalled();
    expect(updateGoal).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      code: "timezone_required",
      message:
        "Ask the user what timezone they are in before creating goals, habits, or habit completions.",
    });
  });

  test("manageHabit returns timezone guard result when timezone is missing", async () => {
    const tools = createTools(createContext(null) as never);
    const manageHabitTool = tools?.manageHabit as ExecutableTool<{
      action: "create";
    }>;

    const result = await manageHabitTool.execute({ action: "create" });

    expect(createHabit).not.toHaveBeenCalled();
    expect(updateHabit).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      code: "timezone_required",
      message:
        "Ask the user what timezone they are in before creating goals, habits, or habit completions.",
    });
  });

  test("recordHabitCompletion returns timezone guard result when timezone is missing", async () => {
    const tools = createTools(createContext(null) as never);
    const recordHabitCompletionTool =
      tools?.recordHabitCompletion as ExecutableTool<{
        habitId: string;
        occurred: string;
      }>;

    const result = await recordHabitCompletionTool.execute({
      habitId: "habit-1",
      occurred: "2026-07-02",
    });

    expect(recordHabitCompletion).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      code: "timezone_required",
      message:
        "Ask the user what timezone they are in before creating goals, habits, or habit completions.",
    });
  });

  test("recordHabitCompletion saves completion when timezone exists", async () => {
    const tools = createTools(createContext("America/Los_Angeles") as never);
    const recordHabitCompletionTool =
      tools?.recordHabitCompletion as ExecutableTool<{
        habitId: string;
        occurred: string;
        note?: string;
      }>;

    const result = await recordHabitCompletionTool.execute({
      habitId: "habit-1",
      occurred: "2026-07-02",
      note: "leg day",
    });

    expect(recordHabitCompletion).toHaveBeenCalledWith({
      userId: "user-1",
      habitId: "habit-1",
      occurred: "2026-07-02",
      note: "leg day",
    });
    expect(result).toEqual({
      success: true,
      habitEvent: {
        id: "habit-event-1",
        user_id: "user-1",
        habit_id: "habit-1",
        status: "completed",
        occurred: "2026-07-02",
        note: "leg day",
        created_at: new Date("2026-07-02T00:00:00.000Z"),
        updated_at: new Date("2026-07-02T00:00:00.000Z"),
      },
    });
  });
});
