import { Inngest } from "inngest";
import { renderCheckInMessage } from "../agent/workflows/render-check-in-message";
import { sendMessage } from "../blooio/api";
import { getCommitmentById } from "../db/queries/commitments";
import { getGoalById } from "../db/queries/goals";
import { createMessage, getRecentMessages } from "../db/queries/messages";
import {
  claimScheduledMessageById,
  markScheduledMessageFailed,
  markScheduledMessageSent,
} from "../db/queries/scheduled";
import { getThreadById } from "../db/queries/threads";
import { getUserById } from "../db/queries/users";

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
      if (!scheduledMessage.commitment_id) {
        throw new Error("Scheduled message has no commitment_id");
      }

      const [user, thread, commitment] = await Promise.all([
        getUserById(scheduledMessage.user_id),
        getThreadById(scheduledMessage.thread_id),
        getCommitmentById({
          userId: scheduledMessage.user_id,
          commitmentId: scheduledMessage.commitment_id,
        }),
      ]);

      const conversation = await getRecentMessages({
        userId: user.id,
        threadId: thread.id,
        limit: 30,
      });

      const goal = commitment.goal_id
        ? await getGoalById(commitment.goal_id)
        : null;

      if (!["pending", "in_progress"].includes(commitment.status)) {
        return { skipped: true, reason: "commitment_resolved" };
      }

      const text = await step.run("generate message", () =>
        renderCheckInMessage({
          scheduledMessage,
          commitment,
          goal,
          user,
          conversation,
          thread,
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
