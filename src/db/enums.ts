import { pgEnum } from "drizzle-orm/pg-core";

export const messageRole = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

export const goalStatus = pgEnum("goal_status", [
  "active",
  "paused",
  "completed",
  "archived",
]);

export const routineTargetPeriod = pgEnum("routine_target_period", [
  "day",
  "week",
  "month",
]);

export const commitmentStatus = pgEnum("commitment_status", [
  "pending",
  "in_progress",
  "completed",
  "missed",
  "blocked",
  "rescheduled",
  "cancelled",
]);

export const commitmentEventType = pgEnum("commitment_event_type", [
  "created",
  "updated",
  "started",
  "completed",
  "missed",
  "blocked", // obstacle prevents it, needs recovery plan
  "rescheduled",
  "cancelled",
  "reopened",
]);

export const scheduledMessageType = pgEnum("scheduled_message_type", [
  "reminder",
  "check_in", // ask for outcome around due time
  "follow_up", // continue unresolved loop after check-in/miss/silence
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
