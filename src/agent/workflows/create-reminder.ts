import { z } from "zod";
import { weekdayName } from "../../db/enums";
import {
  cancelScheduledReminder,
  createScheduledReminder,
} from "../../db/queries/scheduled-reminders";
import { inngest } from "../../inngest/client";
import { getLocalTime, isValidTimeZone } from "../../time";
import type { ChatContext } from "../chat";

export const createReminderSchema = z.object({
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
  frequency: z
    .enum(["once", "daily", "weekly", "monthly"])
    .default("once")
    .describe("How often the reminder repeats."),
  weekdays: z
    .array(z.enum(weekdayName.enumValues))
    .optional()
    .describe("Required for weekly reminders."),
  dayOfMonth: z
    .number()
    .int()
    .min(1)
    .max(31)
    .optional()
    .describe("Required for monthly reminders."),
});

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

function validateRecurrence(input: CreateReminderInput) {
  if (input.frequency === "weekly" && !input.weekdays?.length) {
    return {
      success: false,
      code: "invalid_weekly_reminder",
      message: "Weekly reminders require at least one weekday.",
    };
  }

  if (input.frequency !== "weekly" && input.weekdays?.length) {
    return {
      success: false,
      code: "invalid_reminder",
      message: "weekdays can only be used for weekly reminders.",
    };
  }

  if (input.frequency === "monthly" && input.dayOfMonth === undefined) {
    return {
      success: false,
      code: "invalid_monthly_reminder",
      message: "Monthly reminders require dayOfMonth.",
    };
  }

  if (input.frequency !== "monthly" && input.dayOfMonth !== undefined) {
    return {
      success: false,
      code: "invalid_reminder",
      message: "dayOfMonth can only be used for monthly reminders.",
    };
  }

  return null;
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

  const recurrenceError = validateRecurrence(input);
  if (recurrenceError) return recurrenceError;

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

  const { reminder, scheduledMessage } = await createScheduledReminder({
    userId: context.user.id,
    threadId: context.thread.id,
    title: input.title,
    details: input.details,
    localTime,
    frequency: input.frequency,
    interval: 1,
    weekdays: input.weekdays,
    dayOfMonth: input.dayOfMonth,
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
