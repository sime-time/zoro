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

const scheduleNextMessage = inngest.createFunction(
  {
    id: "schedule-next-message",
    triggers: [{ event: "scheduled-message/next" }],
  },
  async ({ event, step }) => {
    const { reminderId, userId, threadId, timezone } = event.data;
    const after = new Date(event.data.after);

    if (Number.isNaN(after.getTime())) {
      throw new Error("Invalid after timestamp");
    }

    const [user, thread, reminder] = await Promise.all([
      getUserById(userId),
      getThreadById(threadId),
      getReminderById({
        userId,
        reminderId,
      }),
    ]);

    if (reminder.status !== "active") {
      return { skipped: true, reason: "reminder_not_active" };
    }
    if (reminder.frequency === "once") {
      return { skipped: true, reason: "not_recurring" };
    }

    const reminderTimezone = user.timezone ?? timezone;
    if (!reminderTimezone) {
      throw new Error("Recurring reminder user has no timezone");
    }

    // compute next occurrence
    const nextScheduledFor: Date = getNextReminderTime({
      reminder,
      timezone: reminderTimezone,
      after,
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

    return { scheduled: true };
  },
);

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

    let sent = false;

    try {
      if (scheduledMessage === null) {
        return { skipped: true, reason: "not_scheduled_or_due" };
      }

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

      // Reminder could have been resolved before
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

      sent = true;

      // if recurring, schedule the next reminder message
      if (reminder.frequency !== "once") {
        if (!user.timezone) {
          throw new Error("Recurring reminder user has no timezone");
        }

        await step.run("schedule next reminder", () =>
          inngest.send({
            name: "scheduled-message/next",
            data: {
              reminderId: reminder.id,
              userId: user.id,
              threadId: thread.id,
              timezone: user.timezone,
              after: scheduledMessage.scheduled_for.toISOString(),
            },
          }),
        );
      } else {
        await completeReminder({ userId: user.id, reminderId: reminder.id });
      }
    } catch (err) {
      if (sent) {
        console.error("[reminder] Post-send follow-up failed", err);
        return { sent: true, followUpFailed: true };
      }

      await step.run("scheduled message failed to send", () =>
        markScheduledMessageFailed({
          scheduledMessageId,
          error: err,
        }),
      );

      throw err;
    }

    return { sent };
  },
);

export const functions = [sendScheduledMessage, scheduleNextMessage];
