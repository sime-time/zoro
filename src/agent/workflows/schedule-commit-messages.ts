import {
  createScheduledMessage,
  type ScheduledMessage,
} from "../../db/queries/scheduled";
import { inngest } from "../../inngest/client";

const MIN_CHECK_IN_DELAY_MS = 5 * 60 * 1000;
const MAX_CHECK_IN_DELAY_MS = 60 * 60 * 1000;

// Schedule when the agent reminds the user of their commitments
export async function scheduleCommitmentMessages({
  userId,
  threadId,
  commitmentId,
  dueAt,
  now = new Date(),
}: {
  userId: string;
  threadId: string;
  commitmentId: string;
  dueAt: Date | null | undefined;
  now?: Date;
}): Promise<ScheduledMessage[]> {
  if (!dueAt) return [];

  // from 5 minutes up to, but not including, 60 minutes
  const delayMs =
    MIN_CHECK_IN_DELAY_MS +
    Math.floor(Math.random() * (MAX_CHECK_IN_DELAY_MS - MIN_CHECK_IN_DELAY_MS));

  const checkInTime = new Date(dueAt.getTime() + delayMs);

  if (checkInTime <= now) return [];

  const scheduledMessage = await createScheduledMessage({
    userId,
    threadId,
    commitmentId,
    type: "check_in",
    scheduledFor: checkInTime,
  });

  await inngest.send({
    name: "scheduled-message/send",
    ts: scheduledMessage.scheduled_for.getTime(),
    data: {
      scheduledMessageId: scheduledMessage.id,
    },
  });

  return [scheduledMessage];
}
