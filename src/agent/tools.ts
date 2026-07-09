import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { REACTIONS } from "../blooio/types";
import { recordHabitCompletion } from "../db/queries/habits";
import { updateTimezone, updateUserName } from "../db/queries/users";
import { isValidTimeZone } from "../time";
import type { ChatContext } from "./chat";
import { logMeal, logMealSchema } from "./workflows/log-meal";
import { manageGoal, manageGoalSchema } from "./workflows/manage-goal";
import { manageHabit, manageHabitSchema } from "./workflows/manage-habit";
import { searchWeb } from "./workflows/search-web";

// Every time-related tool starts with this guard
function requireTimezone(context: ChatContext) {
  if (!context.user.timezone) {
    return {
      success: false,
      code: "timezone_required",
      message:
        "Ask the user what timezone they are in before creating goals, habits, habit completions, or meal logs.",
    };
  }
  return null;
}

export function createTools(context: ChatContext): ToolSet | undefined {
  const sendReaction = tool({
    description:
      "Send an iMessage reaction (tapback) to the user's message. Use sparingly - text responses are preferred.",
    inputSchema: z.object({
      reaction: z
        .enum(REACTIONS)
        .describe("The iMessage tapback reaction to send."),
    }),
    execute: async ({ reaction }) => ({ reaction }),
  });

  const searchWebTool = tool({
    description:
      "Search the web for current or external information. Use this for facts that may be recent, unknown, location-specific, or not available from conversation context. Do not use it for private user data, goals, habits, or meals already available in context.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Focused web search query for current or external information. Include key entities, dates, locations, or constraints from the user's request.",
        ),
    }),
    execute: async ({ query }) => {
      return await searchWeb(query);
    },
  });

  const setUserName = tool({
    description: "Update the user's name.",
    inputSchema: z.object({
      name: z.string().min(1),
    }),
    execute: async ({ name }) => {
      const user = await updateUserName(context.user.id, name);
      return { success: true, userName: user.name };
    },
  });

  const setUserTimezone = tool({
    description: "Update the user's timezone in IANA format.",
    inputSchema: z.object({
      timezone: z.string().describe("The user's timezone in IANA format."),
    }),
    execute: async ({ timezone }) => {
      if (isValidTimeZone(timezone)) {
        const user = await updateTimezone(context.user.id, timezone);
        return { success: true, userTimezone: user.timezone };
      } else {
        return {
          success: false,
          code: "invalid_timezone",
          message: "Timezone is not in IANA format",
        };
      }
    },
  });

  const logMealTool = tool({
    description:
      "Log a user's meal macros after the user explicitly confirms they want to save/log it. Use this for meals described in text or estimated from photos. Requires the user's timezone before use. Do not call this tool after only estimating macros; first summarize the estimate, ask if they want to log it, allow edits, and only call this tool after confirmation. Use the latest corrected meal details from the conversation history.",
    inputSchema: logMealSchema,
    execute: async (input) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      return await logMeal(context.user.id, input);
    },
  });

  const manageGoalTool = tool({
    description:
      "Create or update a user's goal. Use this when the user explicitly wants to start tracking a goal, change goal details, mark a goal complete, or archive a goal. Requires the user's timezone before use. For updates, completions, or archives, use the goal ID from the active goals listed in context. Do not guess if the goal is ambiguous; ask a clarifying question instead.",
    inputSchema: manageGoalSchema,
    execute: async (input) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      return await manageGoal(input, context);
    },
  });

  const manageHabitTool = tool({
    description:
      "Create or update a user's habit definition. Use this when the user explicitly wants to track a recurring behavior, change its target, pause/archive it, or edit its name/description. Requires the user's timezone before use. For updates or archives, use the habit ID from the active habits listed in context. Do not use this to record a completed habit; use recordHabitCompletion for that.",
    inputSchema: manageHabitSchema,
    execute: async (input) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      return await manageHabit(input, context);
    },
  });

  const recordHabitCompletionTool = tool({
    description:
      "Record that the user completed an existing habit on a specific local date. Use this when the user clearly says they completed a tracked habit, such as 'went to the gym today' or 'meditated this morning'. Requires the user's timezone before use. Use the habit ID from the active habits listed in context. If the habit or date is ambiguous, ask a clarifying question instead of calling this tool.",
    inputSchema: z.object({
      habitId: z
        .string()
        .describe(
          "The ID of the existing habit that was completed. Use an active habit ID from context.",
        ),
      occurred: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe(
          "The user's local calendar date when the habit was completed, in YYYY-MM-DD format. For 'today' or 'yesterday', resolve using the user's timezone.",
        ),
      note: z
        .string()
        .optional()
        .describe(
          "Optional short note about the completion, like 'leg day', '10 minutes', or 'morning session'.",
        ),
    }),
    execute: async (input) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      const event = await recordHabitCompletion({
        userId: context.user.id,
        habitId: input.habitId,
        occurred: input.occurred,
        note: input.note,
      });

      return { success: true, habitEvent: event };
    },
  });

  const tools = {
    setUserName,
    setUserTimezone,
    logMeal: logMealTool,
    manageGoal: manageGoalTool,
    manageHabit: manageHabitTool,
    recordHabitCompletion: recordHabitCompletionTool,
    searchWeb: searchWebTool,
  };

  const conditionalTools =
    context.service === "iMessage" ? { sendReaction } : undefined;

  return { ...tools, ...conditionalTools };
}
