import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { REACTIONS } from "../blooio/types";
import { updateTimezone, updateUserName } from "../db/queries/users";
import { isValidTimeZone } from "../time";
import type { ChatContext } from "./chat";
import { logMeal, logMealSchema } from "./workflows/log-meal";
import { manageGoal, manageGoalSchema } from "./workflows/manage-goal";
import {
  recordCommitment,
  recordCommitmentSchema,
} from "./workflows/record-commitment";
import {
  resolveCommitment,
  resolveCommitmentSchema,
} from "./workflows/resolve-commitment";
import { searchWeb } from "./workflows/search-web";
import { viewMealSchema, viewMeals } from "./workflows/view-meals";

// Every time-related tool starts with this guard
function requireTimezone(context: ChatContext) {
  if (!context.user.timezone) {
    return {
      success: false,
      code: "timezone_required",
      message:
        "Ask the user what timezone they are in before managing goals, routines, commitments, or meal logs.",
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
      "Search the web for current or external information. Use this for recent, unknown, location-specific, or verifiable public information. Do not use it for private user data already available in context.",
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
      if (name.trim() !== "") {
        const user = await updateUserName(context.user.id, name.trim());
        return { success: true, userName: user.name };
      } else {
        return {
          success: false,
          code: "invalid_name",
          message: "Must use a valid name",
        };
      }
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

  const viewMealsTool = tool({
    description:
      "View a user's saved meal logs and macro totals for a specific local date range. Use this when the user asks what they ate, asks for past meal logs, or asks for calories, protein, carbs, or fat totals over a day, week, month, or custom period. Requires the user's timezone before use. Resolve relative dates like today, yesterday, this week, or last month into YYYY-MM-DD dates using the user's timezone. If the requested period is unclear, ask a clarifying question before calling this tool.",
    inputSchema: viewMealSchema,
    execute: async ({ from, to }) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      if (from > to) {
        return {
          success: false,
          code: "invalid_date_range",
          message: "from must be before or equal to to",
        };
      }

      return await viewMeals({
        userId: context.user.id,
        from,
        to,
      });
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

  const recordCommitmentTool = tool({
    description:
      "Record a concrete user commitment with a resolved due datetime. Use only when the user has made a clear promise/action and the due time has been resolved using the user's saved timezone. For vague intentions like 'I should work out more', ask one clarifying question instead of calling this tool. Use create/update routine instead for recurring quotas like 'gym 3x/week'.",
    inputSchema: recordCommitmentSchema,
    execute: async (input) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      return await recordCommitment(input, context);
    },
  });

  const resolveCommitmentTool = tool({
    description:
      "Resolve an existing commitment when the user clearly says it was completed, missed, blocked, or cancelled. Use the commitment ID from unresolved commitments context. If the outcome is unclear, ask one clarifying question instead of calling this tool.",
    inputSchema: resolveCommitmentSchema,
    execute: async (input) => {
      return await resolveCommitment(input, context);
    },
  });

  const tools = {
    setUserName,
    setUserTimezone,
    searchWeb: searchWebTool,
    logMeal: logMealTool,
    viewMeals: viewMealsTool,
    manageGoal: manageGoalTool,
    recordCommitment: recordCommitmentTool,
    resolveCommitment: resolveCommitmentTool,
  };

  const conditionalTools =
    context.service === "iMessage" ? { sendReaction } : undefined;

  return { ...tools, ...conditionalTools };
}
