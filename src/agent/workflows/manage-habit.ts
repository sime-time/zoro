import z from "zod";
import { createHabit, updateHabit } from "../../db/queries/habits";
import { habitTargetPeriod } from "../../db/schema";
import type { ChatContext } from "../chat";

export const manageHabitSchema = z.object({
  action: z
    .enum(["create", "update", "pause", "archive"])
    .describe("The habit management action to perform."),
  habitId: z
    .string()
    .optional()
    .describe(
      "Do not include habit ID when creating a new habit. Use an existing habit ID for updates or archive actions.",
    ),
  name: z
    .string()
    .optional()
    .describe("Short habit name, like 'gym', 'meditation', or 'writing'."),
  description: z
    .string()
    .optional()
    .describe(
      "Optional extra context about the habit, like when or why the user wants to do it.",
    ),
  targetCount: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "How many times the user wants to complete this habit per target period. Example: for 'gym 4x/week', targetCount is 4.",
    ),
  targetPeriod: z
    .enum(habitTargetPeriod.enumValues)
    .optional()
    .describe(
      "The time window for the habit target. Example: for 'gym 4x/week', targetPeriod is 'week'; for 'meditate daily', targetPeriod is 'day'.",
    ),
});

type ManageHabitInput = z.infer<typeof manageHabitSchema>;

export async function manageHabit(
  input: ManageHabitInput,
  context: ChatContext,
) {
  switch (input.action) {
    case "create": {
      if (input.name === undefined) {
        return {
          success: false,
          code: "invalid_habit",
          message: "Habit name is required for new habits",
        };
      }

      const newHabit = await createHabit({
        userId: context.user.id,
        name: input.name,
        description: input.description,
        targetCount: input.targetCount,
        targetPeriod: input.targetPeriod,
      });

      return { success: true, newHabit };
    }

    case "update": {
      if (input.habitId === undefined) {
        return {
          success: false,
          code: "invalid_habit",
          message: "habitId is required for updates",
        };
      }

      const updatedHabit = await updateHabit({
        userId: context.user.id,
        habitId: input.habitId,
        name: input.name,
        description: input.description,
        targetCount: input.targetCount,
        targetPeriod: input.targetPeriod,
      });

      return { success: true, updatedHabit };
    }

    case "pause": {
      if (input.habitId === undefined) {
        return {
          success: false,
          code: "invalid_habit",
          message: "habitId is required for pausing",
        };
      }

      const pausedHabit = await updateHabit({
        userId: context.user.id,
        habitId: input.habitId,
        status: "paused",
      });

      return { success: true, pausedHabit };
    }

    case "archive": {
      if (input.habitId === undefined) {
        return {
          success: false,
          code: "invalid_habit",
          message: "habitId is required for archiving",
        };
      }

      const archivedHabit = await updateHabit({
        userId: context.user.id,
        habitId: input.habitId,
        status: "archived",
      });

      return { success: true, archivedHabit };
    }
  }
}
