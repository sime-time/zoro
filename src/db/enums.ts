import { pgEnum } from "drizzle-orm/pg-core";

export const messageRole = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

export const weekdayName = pgEnum("weekday_name", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const reminderFrequency = pgEnum("reminder_frequency", [
  "once",
  "daily",
  "weekly",
  "monthly",
]);

export const reminderStatus = pgEnum("reminder_status", [
  "active",
  "completed",
  "cancelled",
]);

export const scheduledMessageStatus = pgEnum("scheduled_message_status", [
  "scheduled",
  "processing",
  "sent",
  "cancelled",
  "failed",
]);

export const memoryType = pgEnum("memory_type", [
  "fact",
  "preference",
  "constraint",
  "motivation",
  "behavior_pattern",
  "relationship",
  "strategy",
]);

export const memoryImportance = pgEnum("memory_importance", [
  "low",
  "normal",
  "high",
]);
