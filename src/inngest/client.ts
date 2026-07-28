import { Inngest } from "inngest";
import { generateReminderMessage } from "../agent/workflows/generate-reminder-message";
import { sendMessage } from "../blooio/api";
import { createMessage, getRecentMessages } from "../db/queries/messages";
import { completeReminder, getReminderById } from "../db/queries/reminders";
import {
  cancelProcessingScheduledMessage,
  claimScheduledMessageById,
  createScheduledMessage,
  markScheduledMessageFailed,
  markScheduledMessageSent,
} from "../db/queries/scheduled";
import { getThreadById } from "../db/queries/threads";
import { getUserById } from "../db/queries/users";
import { getNextReminderTime } from "../time";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "zoro" });

const sendScheduledMessage = inngest.createFunction(
  {
    id: "send-scheduled-message",
    triggers: [{ event: "scheduled-message/send" }],
  },
  async ({ event, step }) => {
    const { scheduledMessageId } = event.data;

    const scheduledMessage = await claimScheduledMessageById({
      scheduledMessageId,
    });

    if (scheduledMessage === null) {
      return { skipped: true, reason: "not_scheduled_or_due" };
    }

    try {
      if (!scheduledMessage.reminder_id) {
        throw new Error("Scheduled message has no reminder_id");
      }

      // Load context
      const [user, thread, reminder] = await Promise.all([
        getUserById(scheduledMessage.user_id),
        getThreadById(scheduledMessage.thread_id),
        getReminderById({
          userId: scheduledMessage.user_id,
          reminderId: scheduledMessage.reminder_id,
        }),
      ]);

      // Reminder could have been updated before
      if (reminder.status !== "active") {
        await step.run("mark scheduled message cancelled", () =>
          cancelProcessingScheduledMessage(scheduledMessage.id),
        );

        return { skipped: true, reason: "reminder_resolved" };
      }

      const conversation = await getRecentMessages({
        userId: user.id,
        threadId: thread.id,
        limit: 30,
      });

      const text = await step.run("generate message", () =>
        generateReminderMessage({
          user,
          thread,
          reminder,
          conversation,
        }),
      );

      await step.run("send blooio message", () =>
        sendMessage(thread.blooio_chat_id, text),
      );

      const messageId = await step.run("save assistant message", () =>
        createMessage({
          userId: scheduledMessage.user_id,
          threadId: thread.id,
          role: "assistant",
          content: text,
        }),
      );

      await step.run("mark scheduled message sent", () =>
        markScheduledMessageSent({
          scheduledMessageId,
          messageId,
        }),
      );

      // if recurring, schedule the next reminder message
      if (reminder.frequency !== "once") {
        if (!user.timezone) {
          throw new Error("Recurring reminder user has no timezone");
        }

        // compute next occurrence
        const nextScheduledFor: Date = getNextReminderTime({
          reminder,
          timezone: user.timezone,
          after: scheduledMessage.scheduled_for,
        });

        // create scheduled_messages row
        const nextScheduledMessage = await createScheduledMessage({
          userId: user.id,
          threadId: thread.id,
          reminderId: reminder.id,
          scheduledFor: nextScheduledFor,
        });

        await step.run("enqueue next scheduled message", () =>
          inngest.send({
            name: "scheduled-message/send",
            ts: nextScheduledMessage.scheduled_for.getTime(),
            data: { scheduledMessageId: nextScheduledMessage.id },
          }),
        );
      } else {
        await completeReminder({ userId: user.id, reminderId: reminder.id });
      }

      return { sent: true };
    } catch (err) {
      await step.run("mark scheduled message failed", () =>
        markScheduledMessageFailed({
          scheduledMessageId,
          error: err,
        }),
      );

      throw err;
    }
  },
);

export const functions = [sendScheduledMessage];
