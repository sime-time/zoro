import z from "zod";
import { createGoal, updateGoal } from "../../db/queries/goals";
import type { ChatContext } from "../chat";
import { optionalUuid } from "../uuid";

export const manageGoalSchema = z.object({
  action: z
    .enum(["create", "update", "complete", "archive"])
    .describe("The goal management action to perform."),
  goalId: optionalUuid(
    "Don't add goal ID if creating a new goal. New IDs are generated.",
  ),
  title: z
    .string()
    .optional()
    .describe(
      "Name for the goal, like 'run a half marathon' or 'finish my essay'. Required when creating a new goal.",
    ),
  description: z
    .string()
    .optional()
    .describe(
      "Optional details about what the goal means, what needs to happen, or what success looks like.",
    ),
  motivation: z
    .string()
    .optional()
    .describe(
      "The user's deeper reason for wanting this goal. Store this when the user explains why the goal matters.",
    ),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Use YYYY-MM-DD format"),
});

type ManageGoalInput = z.infer<typeof manageGoalSchema>;

export async function manageGoal(input: ManageGoalInput, context: ChatContext) {
  switch (input.action) {
    case "create": {
      if (input.title === undefined) {
        return {
          success: false,
          code: "invalid_goal",
          message: "Goal title is required for new goals",
        };
      }

      const newGoal = await createGoal({
        userId: context.user.id,
        title: input.title,
        description: input.description,
        motivation: input.motivation,
        deadline: input.deadline,
      });

      return { success: true, newGoal };
    }

    case "update": {
      if (input.goalId === undefined) {
        return {
          success: false,
          code: "invalid_goal",
          message: "goalId is required for updates",
        };
      }

      const updatedGoal = await updateGoal({
        userId: context.user.id,
        goalId: input.goalId,
        title: input.title,
        description: input.description,
        motivation: input.motivation,
        deadline: input.deadline,
      });

      return { success: true, updatedGoal };
    }
    case "complete": {
      if (input.goalId === undefined) {
        return {
          success: false,
          code: "invalid_goal",
          message: "goalId is required for completion",
        };
      }

      const completedGoal = await updateGoal({
        userId: context.user.id,
        goalId: input.goalId,
        status: "completed",
      });

      return { success: true, completedGoal };
    }

    case "archive": {
      if (input.goalId === undefined) {
        return {
          success: false,
          code: "invalid_goal",
          message: "goalId is required for archiving",
        };
      }

      const archivedGoal = await updateGoal({
        userId: context.user.id,
        goalId: input.goalId,
        status: "archived",
      });

      return { success: true, archivedGoal };
    }
  }
}
