import { z } from "zod";
import { routineTargetPeriod } from "../../db/enums";
import { createRoutine } from "../../db/queries/routines";
import type { ChatContext } from "../chat";

export const createRoutineSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .describe("Short recurring intention/template, like 'Gym' or 'Write'."),
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

type CreateRoutineInput = z.infer<typeof createRoutineSchema>;

export async function createRoutineAction(
  input: CreateRoutineInput,
  context: ChatContext,
) {
  const routine = await createRoutine({
    userId: context.user.id,
    threadId: context.thread.id,
    title: input.title,
    description: input.description,
    targetCount: input.targetCount,
    targetPeriod: input.targetPeriod,
  });

  return { success: true, routine };
}
