import { z } from "zod";
import { routineTargetPeriod } from "../../db/enums";
import { createRoutine, updateRoutine } from "../../db/queries/routines";
import type { ChatContext } from "../chat";

export const manageRoutineSchema = z.object({
  action: z
    .enum(["create", "update", "pause", "archive"])
    .describe("The routine management action to perform."),
  routineId: z
    .string()
    .optional()
    .describe(
      "Do not include routine ID when creating a new routine. Use an existing routine ID for updates or archive actions.",
    ),
  title: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Short recurring intention/template, like 'Gym' or 'Write'. Required when action is create.",
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
  goalId: z
    .string()
    .optional()
    .describe("Optional goal ID from active goals context, if clearly linked."),
});

type ManageRoutineInput = z.infer<typeof manageRoutineSchema>;

export async function manageRoutine(
  input: ManageRoutineInput,
  context: ChatContext,
) {
  switch (input.action) {
    case "create": {
      if (input.title === undefined) {
        return {
          success: false,
          code: "invalid_routine",
          message: "Title is required when creating a routine.",
        };
      }

      const routine = await createRoutine({
        userId: context.user.id,
        threadId: context.thread.id,
        goalId: input.goalId,
        title: input.title,
        description: input.description,
        targetCount: input.targetCount,
        targetPeriod: input.targetPeriod,
      });

      return { success: true, routine };
    }

    case "update": {
      if (input.routineId === undefined) {
        return {
          success: false,
          code: "invalid_routine",
          message: "routineId is required for updates",
        };
      }

      const updated = await updateRoutine({
        userId: context.user.id,
        routineId: input.routineId,
        goalId: input.goalId,
        title: input.title,
        description: input.description,
        targetCount: input.targetCount,
        targetPeriod: input.targetPeriod,
      });

      return { success: true, updated };
    }

    case "archive":
    case "pause": {
      if (!input.routineId) {
        return {
          success: false,
          code: "invalid_routine",
          message: "routineId is required for this action.",
        };
      }

      const routine = await updateRoutine({
        userId: context.user.id,
        routineId: input.routineId,
        isActive: false,
      });

      return { success: true, routine };
    }
  }
}
