import { z } from "zod";
import { weekdayName } from "../../db/enums";
import { getReminderById, updateReminder } from "../../db/queries/reminders";
import {
  cancelScheduledMessagesForReminder,
  createScheduledMessage,
} from "../../db/queries/scheduled";
import { inngest } from "../../inngest/client";
import { getLocalTime, isValidTimeZone } from "../../time";
import type { ChatContext } from "../chat";

const updateReminderBaseSchema = z.object({
  reminderId: z.uuid().describe("Internal reminder ID from Active Reminders"),
  title: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("New reminder title, if changing it"),
  details: z
    .string()
    .trim()
    .optional()
    .describe("New reminder details, if changing them"),
  scheduledFor: z.iso
    .datetime({ offset: true })
    .describe(
      "New first/next reminder time as a timezone-resolved ISO datetime with offset.",
    ),
});

export const updateReminderSchema = z.discriminatedUnion("frequency", [
  updateReminderBaseSchema.extend({
    frequency: z.literal("once").describe("One-time reminder."),
  }),
  updateReminderBaseSchema.extend({
    frequency: z.literal("daily").describe("Daily recurring reminder."),
  }),
  updateReminderBaseSchema.extend({
    frequency: z.literal("weekly").describe("Weekly recurring reminder."),
    weekdays: z
      .array(z.enum(weekdayName.enumValues))
      .min(1)
      .describe("Weekdays for the weekly reminder."),
  }),
  updateReminderBaseSchema.extend({
    frequency: z.literal("monthly").describe("Monthly recurring reminder."),
    dayOfMonth: z
      .number()
      .int()
      .min(1)
      .max(31)
      .describe("Day of the month for the monthly reminder."),
  }),
]);

type UpdateReminderInput = z.infer<typeof updateReminderSchema>;

export async function updateReminderAction(
  input: UpdateReminderInput,
  context: ChatContext,
) {
  if (!context.user.timezone || !isValidTimeZone(context.user.timezone)) {
    return {
      success: false,
      code: "timezone_required",
      message:
        "Ask the user for their city or timezone before updating reminders.",
    };
  }

  const scheduledFor = new Date(input.scheduledFor);

  if (Number.isNaN(scheduledFor.getTime())) {
    return {
      success: false,
      code: "invalid_scheduled_for",
      message: "scheduledFor must be a valid timezone-resolved ISO datetime.",
    };
  }

  if (scheduledFor <= new Date()) {
    return {
      success: false,
      code: "invalid_scheduled_for",
      message: "scheduledFor must be in the future.",
    };
  }

  const existingReminder = await getReminderById({
    userId: context.user.id,
    reminderId: input.reminderId,
  });

  if (existingReminder.status !== "active") {
    return {
      success: false,
      code: "inactive_reminder",
      message: "Only active reminders can be updated.",
    };
  }

  const localTime =
    input.frequency === "once"
      ? null
      : getLocalTime(scheduledFor, context.user.timezone);

  const weekdays = input.frequency === "weekly" ? input.weekdays : null;
  const dayOfMonth = input.frequency === "monthly" ? input.dayOfMonth : null;

  const reminder = await updateReminder({
    userId: context.user.id,
    reminderId: input.reminderId,
    title: input.title,
    details: input.details,
    localTime,
    frequency: input.frequency,
    interval: 1,
    weekdays,
    dayOfMonth,
  });

  await cancelScheduledMessagesForReminder({
    reminderId: reminder.id,
    userId: context.user.id,
  });

  const scheduledMessage = await createScheduledMessage({
    userId: context.user.id,
    threadId: context.thread.id,
    reminderId: reminder.id,
    scheduledFor,
  });

  try {
    await inngest.send({
      name: "scheduled-message/send",
      ts: scheduledMessage.scheduled_for.getTime(),
      data: {
        scheduledMessageId: scheduledMessage.id,
      },
    });
  } catch (err) {
    await cancelScheduledMessagesForReminder({
      reminderId: reminder.id,
      userId: context.user.id,
    });
    throw err;
  }

  return {
    success: true,
    reminder,
    scheduledFor: scheduledMessage.scheduled_for,
  };
}
