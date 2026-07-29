import { getReminderById } from "../../db/queries/reminders";
import { cancelReminderAndScheduledMessages } from "../../db/queries/scheduled-reminders";
import type { ChatContext } from "../chat";

export async function cancelReminderAction(
  reminderId: string,
  context: ChatContext,
) {
  const existingReminder = await getReminderById({
    userId: context.user.id,
    reminderId,
  });

  if (existingReminder.status !== "active") {
    return {
      success: false,
      code: "inactive_reminder",
      message: "Only active reminders can be completed.",
    };
  }

  const { reminder, scheduledMessages } =
    await cancelReminderAndScheduledMessages({
      userId: context.user.id,
      reminderId: existingReminder.id,
    });

  return {
    success: true,
    cancelledReminder: reminder,
    cancelledScheduledMessages: scheduledMessages,
  };
}
