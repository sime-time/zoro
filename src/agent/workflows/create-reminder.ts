import { z } from "zod";
import { weekdayName } from "../../db/enums";
import {
  cancelScheduledReminder,
  createScheduledReminder,
} from "../../db/queries/scheduled-reminders";
import { inngest } from "../../inngest/client";
import { getLocalTime, isValidTimeZone } from "../../time";
import type { ChatContext } from "../chat";

const reminderBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .describe("Short reminder title, like 'Take medication' or 'Call Mom'."),
  details: z
    .string()
    .optional()
    .describe("Optional extra reminder details from the user."),
  scheduledFor: z.iso
    .datetime({ offset: true })
    .describe(
      "First reminder time as a timezone-resolved ISO datetime with offset, e.g. 2026-07-29T09:00:00-07:00.",
    ),
});

export const createReminderSchema = z.discriminatedUnion("frequency", [
  reminderBaseSchema.extend({
    frequency: z.literal("once").describe("One-time reminder."),
  }),
  reminderBaseSchema.extend({
    frequency: z.literal("daily").describe("Daily recurring reminder."),
  }),
  reminderBaseSchema.extend({
    frequency: z.literal("weekly").describe("Weekly recurring reminder."),
    weekdays: z
      .array(z.enum(weekdayName.enumValues))
      .min(1)
      .describe("Weekdays for the weekly reminder."),
  }),
  reminderBaseSchema.extend({
    frequency: z.literal("monthly").describe("Monthly recurring reminder."),
    dayOfMonth: z
      .number()
      .int()
      .min(1)
      .max(31)
      .describe("Day of the month for the monthly reminder."),
  }),
]);

type CreateReminderInput = z.infer<typeof createReminderSchema>;

function parseScheduledFor(scheduledFor: string) {
  const parsed = new Date(scheduledFor);

  if (Number.isNaN(parsed.getTime())) {
    return {
      error: {
        success: false,
        code: "invalid_scheduled_for",
        message: "scheduledFor must be a valid timezone-resolved ISO datetime.",
      },
    };
  }

  return { scheduledFor: parsed };
}

export async function createReminderAction(
  input: CreateReminderInput,
  context: ChatContext,
) {
  if (!context.user.timezone || !isValidTimeZone(context.user.timezone)) {
    return {
      success: false,
      code: "timezone_required",
      message:
        "Ask the user for their city or timezone before setting reminders.",
    };
  }

  const parsed = parseScheduledFor(input.scheduledFor);
  if (parsed.error) return parsed.error;

  const scheduledFor = parsed.scheduledFor;

  if (scheduledFor <= new Date()) {
    return {
      success: false,
      code: "invalid_scheduled_for",
      message: "scheduledFor must be in the future.",
    };
  }

  const localTime =
    input.frequency === "once"
      ? null
      : getLocalTime(scheduledFor, context.user.timezone);

  const weekdays = input.frequency === "weekly" ? input.weekdays : undefined;
  const dayOfMonth =
    input.frequency === "monthly" ? input.dayOfMonth : undefined;

  const { reminder, scheduledMessage } = await createScheduledReminder({
    userId: context.user.id,
    threadId: context.thread.id,
    title: input.title,
    details: input.details,
    localTime,
    frequency: input.frequency,
    interval: 1,
    weekdays,
    dayOfMonth,
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
    // transaction to cleanup the scheduled message and reminder
    await cancelScheduledReminder({
      userId: context.user.id,
      reminderId: reminder.id,
      scheduledMessageId: scheduledMessage.id,
    });

    throw err;
  }

  return {
    success: true,
    reminder,
    scheduledFor: scheduledMessage.scheduled_for,
  };
}
