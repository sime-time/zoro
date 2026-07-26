import { z } from "zod";
import { routineTargetPeriod } from "../../db/enums";
import { updateRoutine } from "../../db/queries/routines";
import type { ChatContext } from "../chat";

export const manageRoutineSchema = z.object({
  action: z
    .enum(["update", "pause", "archive"])
    .describe("The routine management action to perform."),
  routineId: z.string().describe("Routine ID from active routines context."),
  title: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Updated short recurring intention/template, like 'Gym' or 'Write'.",
    ),
  description: z
    .string()
    .optional()
    .describe("Optional details about the recurring intention."),
  targetCount: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      "How many commitments should be generated per target period. Example: 3 for 'gym 3x/week'.",
    ),
  targetPeriod: z
    .enum(routineTargetPeriod.enumValues)
    .optional()
    .describe("The period for the recurring quota: day, week, or month."),
});

type ManageRoutineInput = z.infer<typeof manageRoutineSchema>;

export async function manageRoutine(
  input: ManageRoutineInput,
  context: ChatContext,
) {
  switch (input.action) {
    case "update": {
      const updated = await updateRoutine({
        userId: context.user.id,
        routineId: input.routineId,
        title: input.title,
        description: input.description,
        targetCount: input.targetCount,
        targetPeriod: input.targetPeriod,
      });

      return { success: true, updated };
    }

    case "archive":
    case "pause": {
      const routine = await updateRoutine({
        userId: context.user.id,
        routineId: input.routineId,
        isActive: false,
      });

      return { success: true, routine };
    }
  }
}
