import { z } from "zod";
import {
  createCommitment,
  createCommitmentEvent,
  updateCommitment,
} from "../../db/queries/commitments";
import {
  cancelScheduledMessagesForCommitment,
  type ScheduledMessage,
} from "../../db/queries/scheduled";
import type { ChatContext } from "../chat";
import { scheduleCommitmentMessages } from "./schedule-commit-messages";

export const manageCommitmentSchema = z.object({
  action: z
    .enum(["create", "update", "complete", "miss", "cancel", "reschedule"])
    .describe("The commitment management action to perform."),
  commitmentId: z
    .string()
    .optional()
    .describe(
      "Commitment ID from unresolved commitments context. Required except when action is create.",
    ),
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
  goalId: z
    .string()
    .optional()
    .describe("Optional goal ID from active goals context, if clearly linked."),
  note: z
    .string()
    .optional()
    .describe(
      "Optional short note about the change, outcome, or reschedule reason.",
    ),
});

type ManageCommitmentInput = z.infer<typeof manageCommitmentSchema>;

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

export async function manageCommitment(
  input: ManageCommitmentInput,
  context: ChatContext,
) {
  switch (input.action) {
    case "create": {
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
        goalId: input.goalId,
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

    case "update": {
      if (!input.commitmentId) {
        return {
          success: false,
          code: "invalid_commitment",
          message: "commitmentId is required for this action.",
        };
      }

      const parsed = parseDueAt(input.dueAt);
      if (parsed.error) return parsed.error;

      if (
        input.title === undefined &&
        input.details === undefined &&
        input.motivation === undefined &&
        input.successCriteria === undefined &&
        input.dueAt === undefined &&
        input.goalId === undefined
      ) {
        return {
          success: false,
          code: "invalid_commitment_update",
          message: "At least one commitment field must be provided to update.",
        };
      }

      const cancelledScheduledMessages = parsed.dueAt
        ? await cancelScheduledMessagesForCommitment({
            commitmentId: input.commitmentId,
          })
        : [];

      const commitment = await updateCommitment({
        userId: context.user.id,
        commitmentId: input.commitmentId,
        goalId: input.goalId,
        title: input.title,
        details: input.details,
        motivation: input.motivation,
        successCriteria: input.successCriteria,
        dueAt: parsed.dueAt,
      });

      const event = await createCommitmentEvent({
        userId: context.user.id,
        commitmentId: commitment.id,
        type: "updated",
        note: input.note,
        metadata: parsed.dueAt
          ? {
              dueAt: parsed.dueAt.toISOString(),
            }
          : undefined,
      });

      const scheduledMessages = parsed.dueAt
        ? await scheduleCommitmentMessages({
            userId: context.user.id,
            threadId: commitment.thread_id,
            commitmentId: commitment.id,
            dueAt: parsed.dueAt,
          })
        : [];

      return {
        success: true,
        commitment,
        event,
        cancelledScheduledMessagesCount: cancelledScheduledMessages.length,
        scheduledMessages,
      };
    }

    case "reschedule": {
      if (!input.commitmentId) {
        return {
          success: false,
          code: "invalid_commitment",
          message: "commitmentId is required for this action.",
        };
      }

      if (input.dueAt === undefined) {
        return {
          success: false,
          code: "invalid_reschedule",
          message: "dueAt is required when rescheduling a commitment.",
        };
      }

      const parsed = parseDueAt(input.dueAt);
      if (parsed.error) return parsed.error;

      const cancelledScheduledMessages =
        await cancelScheduledMessagesForCommitment({
          commitmentId: input.commitmentId,
        });

      const commitment = await updateCommitment({
        userId: context.user.id,
        commitmentId: input.commitmentId,
        dueAt: parsed.dueAt,
        status: "pending",
        resolvedAt: null,
      });

      const event = await createCommitmentEvent({
        userId: context.user.id,
        commitmentId: commitment.id,
        type: "rescheduled",
        note: input.note,
        metadata: {
          dueAt: parsed.dueAt?.toISOString(),
        },
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
        cancelledScheduledMessagesCount: cancelledScheduledMessages.length,
        scheduledMessages,
      };
    }

    case "complete":
    case "miss":
    case "cancel": {
      if (!input.commitmentId) {
        return {
          success: false,
          code: "invalid_commitment",
          message: "commitmentId is required for this action.",
        };
      }

      const status =
        input.action === "complete"
          ? "completed"
          : input.action === "miss"
            ? "missed"
            : "cancelled";

      const eventType =
        input.action === "complete"
          ? "completed"
          : input.action === "miss"
            ? "missed"
            : "cancelled";

      const cancelledScheduledMessages =
        await cancelScheduledMessagesForCommitment({
          commitmentId: input.commitmentId,
        });

      const commitment = await updateCommitment({
        userId: context.user.id,
        commitmentId: input.commitmentId,
        status,
        resolvedAt: new Date(),
      });

      const event = await createCommitmentEvent({
        userId: context.user.id,
        commitmentId: commitment.id,
        type: eventType,
        note: input.note,
      });

      return {
        success: true,
        commitment,
        event,
        cancelledScheduledMessagesCount: cancelledScheduledMessages.length,
        scheduledMessages: [] as ScheduledMessage[],
      };
    }
  }
}
