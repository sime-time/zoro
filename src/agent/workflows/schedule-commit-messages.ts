import {
  createScheduledMessage,
  type ScheduledMessage,
} from "../../db/queries/scheduled";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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
  dueAt: Date;
  now?: Date;
}): Promise<ScheduledMessage[]> {
  // Randomize times within a range
  const schedule = [
    {
      type: "reminder" as const,
      scheduledFor: new Date(dueAt.getTime() - HOUR_MS),
    },
    {
      type: "check_in" as const,
      scheduledFor: new Date(dueAt.getTime() + HOUR_MS),
    },
    {
      type: "follow_up" as const,
      scheduledFor: new Date(dueAt.getTime() + DAY_MS),
    },
  ];

  const scheduledMessages: ScheduledMessage[] = [];

  for (const item of schedule) {
    if (item.scheduledFor <= now) continue;

    const scheduledMessage = await createScheduledMessage({
      userId,
      threadId,
      commitmentId,
      type: item.type,
      scheduledFor: item.scheduledFor,
    });

    scheduledMessages.push(scheduledMessage);
  }

  return scheduledMessages;
}
