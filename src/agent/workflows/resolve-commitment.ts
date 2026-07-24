import { z } from "zod";
import {
  createCommitmentEvent,
  resolveCommitment as resolveCommitmentRow,
} from "../../db/queries/commitments";
import { cancelScheduledMessagesForCommitment } from "../../db/queries/scheduled";
import type { ChatContext } from "../chat";

export const resolveCommitmentSchema = z.object({
  commitmentId: z
    .string()
    .describe("Commitment ID from unresolved commitments context."),
  status: z
    .enum(["completed", "missed", "blocked", "cancelled"])
    .describe("The outcome/status for the commitment."),
  note: z
    .string()
    .optional()
    .describe("Optional short note about the outcome or blocker."),
});

type ResolveCommitmentInput = z.infer<typeof resolveCommitmentSchema>;

export async function resolveCommitment(
  input: ResolveCommitmentInput,
  context: ChatContext,
) {
  const cancelledScheduledMessages =
    await cancelScheduledMessagesForCommitment({
      commitmentId: input.commitmentId,
    });

  const commitment = await resolveCommitmentRow({
    userId: context.user.id,
    commitmentId: input.commitmentId,
    status: input.status,
  });

  const event = await createCommitmentEvent({
    userId: context.user.id,
    commitmentId: commitment.id,
    type: input.status,
    note: input.note,
  });

  return {
    success: true,
    commitment,
    event,
    cancelledScheduledMessagesCount: cancelledScheduledMessages.length,
  };
}
