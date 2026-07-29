import { completeReminder, getReminderById } from "../../db/queries/reminders";
import {
  cancelScheduledMessage,
  cancelScheduledMessagesForReminder,
  createScheduledMessage,
} from "../../db/queries/scheduled";
import { inngest } from "../../inngest/client";
import { getNextReminderTime, isValidTimeZone } from "../../time";
import type { ChatContext } from "../chat";

export async function completeReminderAction(
  reminderId: string,
  context: ChatContext,
) {
  const reminder = await getReminderById({
    userId: context.user.id,
    reminderId,
  });

  if (reminder.status !== "active") {
    return {
      success: false,
      code: "inactive_reminder",
      message: "Only active reminders can be completed.",
    };
  }

  if (reminder.frequency === "once") {
    const completedReminder = await completeReminder({
      userId: context.user.id,
      reminderId: reminder.id,
    });

    await cancelScheduledMessagesForReminder({
      reminderId: completedReminder.id,
      userId: context.user.id,
    });

    return {
      success: true,
      completedReminder,
    };
  }

  if (!context.user.timezone || !isValidTimeZone(context.user.timezone)) {
    return {
      success: false,
      code: "timezone_required",
      message:
        "Ask the user for their city or timezone before setting reminders.",
    };
  }

  // Recurring reminders are still "active"
  // Not technically "completed" yet
  const cancelledScheduledMessages = await cancelScheduledMessagesForReminder({
    reminderId: reminder.id,
    userId: context.user.id,
  });

  const [currentOccurrence] = cancelledScheduledMessages.sort(
    (a, b) => a.scheduled_for.getTime() - b.scheduled_for.getTime(),
  );

  // If there was a scheduled row,
  // completion means “skip that occurrence and schedule the next one after it.”
  if (!currentOccurrence) {
    return {
      success: false,
      code: "no_pending_occurrence",
      message: "No pending occurrence found to complete.",
    };
  }

  const after = currentOccurrence.scheduled_for;

  const nextScheduledFor = getNextReminderTime({
    reminder,
    timezone: context.user.timezone,
    after,
  });

  const nextScheduledMessage = await createScheduledMessage({
    userId: context.user.id,
    threadId: context.thread.id,
    reminderId: reminder.id,
    scheduledFor: nextScheduledFor,
  });

  try {
    await inngest.send({
      name: "scheduled-message/send",
      ts: nextScheduledMessage.scheduled_for.getTime(),
      data: {
        scheduledMessageId: nextScheduledMessage.id,
      },
    });
  } catch (err) {
    await cancelScheduledMessage(nextScheduledMessage.id);

    const message = "failed to schedule the next reminder message";

    return {
      success: false,
      code: "scheduling_failed",
      message,
      error: err instanceof Error ? err.message : message,
    };
  }

  return {
    success: true,
    activeReminder: reminder,
    scheduledFor: nextScheduledMessage.scheduled_for,
  };
}
