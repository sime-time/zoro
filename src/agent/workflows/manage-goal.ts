import z from "zod";
import { updateGoal } from "../../db/queries/goals";
import type { ChatContext } from "../chat";

export const manageGoalSchema = z.object({
  action: z
    .enum(["update", "complete", "archive"])
    .describe("The goal management action to perform."),
  goalId: z.string().describe("Goal ID from active goals context."),
  title: z
    .string()
    .optional()
    .describe(
      "Updated name for the goal, like 'run a half marathon' or 'finish my essay'.",
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
    case "update": {
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
      const completedGoal = await updateGoal({
        userId: context.user.id,
        goalId: input.goalId,
        status: "completed",
      });

      return { success: true, completedGoal };
    }

    case "archive": {
      const archivedGoal = await updateGoal({
        userId: context.user.id,
        goalId: input.goalId,
        status: "archived",
      });

      return { success: true, archivedGoal };
    }
  }
}
