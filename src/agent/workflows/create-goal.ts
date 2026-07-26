import z from "zod";
import { createGoal } from "../../db/queries/goals";
import type { ChatContext } from "../chat";

export const createGoalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .describe("Name for the goal, like 'run a half marathon'."),
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
    .describe("Use YYYY-MM-DD format."),
});

type CreateGoalInput = z.infer<typeof createGoalSchema>;

export async function createGoalAction(
  input: CreateGoalInput,
  context: ChatContext,
) {
  const goal = await createGoal({
    userId: context.user.id,
    title: input.title,
    description: input.description,
    motivation: input.motivation,
    deadline: input.deadline,
  });

  return { success: true, goal };
}
