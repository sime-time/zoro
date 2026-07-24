import { z } from "zod";
import {
  createCommitment,
  createCommitmentEvent,
} from "../../db/queries/commitments";
import type { ChatContext } from "../chat";
import { scheduleCommitmentMessages } from "./schedule-commit-messages";

export const recordCommitmentSchema = z.object({
  title: z
    .string()
    .min(1)
    .describe("Short concrete promise/action, like 'Submit tax form'."),
  details: z
    .string()
    .optional()
    .describe("Optional context or specifics about the commitment."),
  motivation: z
    .string()
    .optional()
    .describe("Why this commitment matters to the user, if they said it."),
  successCriteria: z
    .string()
    .optional()
    .describe("What counts as done, if clear from the conversation."),
  dueAt: z.iso
    .datetime({ offset: true })
    .describe(
      "Timezone-resolved ISO datetime with offset, e.g. 2026-07-24T18:00:00-07:00. Resolve relative times using the user's saved timezone before calling.",
    ),
  goalId: z
    .string()
    .optional()
    .describe("Optional goal ID from active goals context, if clearly linked."),
});

type RecordCommitmentInput = z.infer<typeof recordCommitmentSchema>;

export async function recordCommitment(
  input: RecordCommitmentInput,
  context: ChatContext,
) {
  const dueAt = new Date(input.dueAt);

  if (Number.isNaN(dueAt.getTime())) {
    return {
      success: false,
      code: "invalid_due_at",
      message: "dueAt must be a valid timezone-resolved ISO datetime.",
    };
  }

  const commitment = await createCommitment({
    userId: context.user.id,
    threadId: context.thread.id,
    goalId: input.goalId,
    title: input.title,
    details: input.details,
    motivation: input.motivation,
    successCriteria: input.successCriteria,
    dueAt,
  });

  await createCommitmentEvent({
    userId: context.user.id,
    commitmentId: commitment.id,
    type: "created",
    note: "Created from conversation",
  });

  const scheduledMessages = await scheduleCommitmentMessages({
    userId: context.user.id,
    threadId: commitment.thread_id,
    commitmentId: commitment.id,
    dueAt,
  });

  return {
    success: true,
    commitment,
    scheduledMessages,
  };
}
