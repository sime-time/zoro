import { z } from "zod";
import {
  createCommitment,
  createCommitmentEvent,
} from "../../db/queries/commitments";
import type { ChatContext } from "../chat";
import { scheduleCommitmentMessages } from "./schedule-commit-messages";

export const createCommitmentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Short concrete promise/action, like 'Submit tax form'. Required when action is create.",
    ),
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
    .optional()
    .describe(
      "Timezone-resolved ISO datetime with offset, e.g. 2026-07-24T18:00:00-07:00. Resolve relative times using the user's saved timezone before calling.",
    ),
  note: z
    .string()
    .optional()
    .describe(
      "Optional short note about the change, outcome, or reschedule reason.",
    ),
});

type CreateCommitmentInput = z.infer<typeof createCommitmentSchema>;

function parseDueAt(dueAt: string | undefined) {
  if (dueAt === undefined) return { dueAt: undefined };

  const parsed = new Date(dueAt);

  if (Number.isNaN(parsed.getTime())) {
    return {
      error: {
        success: false,
        code: "invalid_due_at",
        message: "dueAt must be a valid timezone-resolved ISO datetime.",
      },
    };
  }

  return { dueAt: parsed };
}

export async function createCommitmentAction(
  input: CreateCommitmentInput,
  context: ChatContext,
) {
  if (input.title === undefined) {
    return {
      success: false,
      code: "invalid_commitment",
      message: "title is required when creating a commitment.",
    };
  }

  if (input.dueAt === undefined) {
    return {
      success: false,
      code: "invalid_commitment",
      message: "dueAt is required when creating a commitment.",
    };
  }

  const parsed = parseDueAt(input.dueAt);
  if (parsed.error) return parsed.error;

  const commitment = await createCommitment({
    userId: context.user.id,
    threadId: context.thread.id,
    title: input.title,
    details: input.details,
    motivation: input.motivation,
    successCriteria: input.successCriteria,
    dueAt: parsed.dueAt,
  });

  const event = await createCommitmentEvent({
    userId: context.user.id,
    commitmentId: commitment.id,
    type: "created",
    note: input.note ?? "Created from conversation",
  });

  const scheduledMessages = await scheduleCommitmentMessages({
    userId: context.user.id,
    threadId: commitment.thread_id,
    commitmentId: commitment.id,
    dueAt: parsed.dueAt,
  });

  return {
    success: true,
    commitment,
    event,
    scheduledMessages,
  };
}
