import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { REACTIONS } from "../blooio/types";
import { updateTimezone, updateUserName } from "../db/queries/users";
import { normalizeTimeZone } from "../time";
import type { ChatContext } from "./chat";
import {
  createCommitmentAction,
  createCommitmentSchema,
} from "./workflows/create-commitment";
import { createGoalAction, createGoalSchema } from "./workflows/create-goal";
import {
  createRoutineAction,
  createRoutineSchema,
} from "./workflows/create-routine";
import { logMeal, logMealSchema } from "./workflows/log-meal";
import {
  manageCommitment,
  manageCommitmentSchema,
} from "./workflows/manage-commitment";
import { manageGoal, manageGoalSchema } from "./workflows/manage-goal";
import { manageRoutine, manageRoutineSchema } from "./workflows/manage-routine";
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

function toNonEmptyTuple(values: string[]): [string, ...string[]] | null {
  const first = values[0];
  if (!first) return null;

  return [first, ...values.slice(1)];
}

export function createTools(context: ChatContext): ToolSet | undefined {
  const goalIds = toNonEmptyTuple(context.goals?.map((goal) => goal.id) ?? []);
  const routineIds = toNonEmptyTuple(
    context.routines?.map((routine) => routine.id) ?? [],
  );

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
        context.user.name = user.name;
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
    description:
      "Update the user's timezone. Accepts IANA names or common timezone/city phrases like EST, Eastern, NYC, Chicago, LA.",
    inputSchema: z.object({
      timezone: z.string().describe("The user's timezone in IANA format."),
    }),
    execute: async ({ timezone }) => {
      const normalizedTZ = normalizeTimeZone(timezone);

      if (normalizedTZ) {
        const user = await updateTimezone(context.user.id, normalizedTZ);
        context.user.timezone = user.timezone;
        return { success: true, userTimezone: user.timezone };
      } else {
        return {
          success: false,
          code: "invalid_timezone",
          message:
            'Ask for their city or timezone, like "NYC", "Chicago", "LA", "Eastern", or "America/New_York".',
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

  const createGoalTool = tool({
    description:
      "Create a new goal when the user explicitly wants to save or track a direction/outcome. Do not use this for routines or one-off commitments.",
    inputSchema: createGoalSchema,
    execute: async (input) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      return await createGoalAction(input, context);
    },
  });

  const manageGoalTool = goalIds
    ? tool({
        description:
          "Update, complete, or archive an existing goal. Use only goal IDs from active goals context. Do not create new goals with this tool.",
        inputSchema: manageGoalSchema.extend({
          goalId: z
            .enum(goalIds)
            .describe("Goal ID from active goals context."),
        }),
        execute: async (input) => {
          const timezoneError = requireTimezone(context);
          if (timezoneError) return timezoneError;

          return await manageGoal(input, context);
        },
      })
    : undefined;

  const createCommitmentTool = tool({
    description:
      "Create a new concrete one-off commitment with a resolved due datetime. Use this for new promises/actions. Do not use manageCommitment for new commitments.",
    inputSchema: createCommitmentSchema,
    execute: async (input) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      return await createCommitmentAction(input, context);
    },
  });

  const manageCommitmentTool = tool({
    description:
      "Create, update, complete, miss, cancel, or reschedule a user's concrete commitment. Use this for specific promises/actions with a resolved due datetime, such as 'I'll submit the form by 6pm'. Use commitment IDs from unresolved commitments context for updates/resolution/reschedules. Resolve relative times using the user's saved timezone before calling. Do not use for vague intentions like 'I should work out more'; ask one clarifying question instead. Do not use for recurring quotas like 'gym 3x/week'; use routine management instead.",
    inputSchema: manageCommitmentSchema,
    execute: async (input) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      return await manageCommitment(input, context);
    },
  });

  const createRoutineTool = tool({
    description:
      "Create a new recurring routine that generates future commitments. Use this for recurring quotas or templates like 'gym 3x/week', 'write every day', or 'meal prep twice a week'. Do not use this for one-off commitments.",
    inputSchema: createRoutineSchema,
    execute: async (input) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      return await createRoutineAction(input, context);
    },
  });

  const existingRoutineTool = routineIds
    ? tool({
        description:
          "Update, pause, or archive an existing recurring routine. Use only routine IDs from active routines context. Do not create new routines with this tool.",
        inputSchema: manageRoutineSchema.extend({
          routineId: z
            .enum(routineIds)
            .describe("Routine ID from active routines context."),
        }),
        execute: async (input) => {
          const timezoneError = requireTimezone(context);
          if (timezoneError) return timezoneError;

          return await manageRoutine(input, context);
        },
      })
    : undefined;

  const tools = {
    setUserName,
    setUserTimezone,
    searchWeb: searchWebTool,
    logMeal: logMealTool,
    viewMeals: viewMealsTool,
    createGoal: createGoalTool,
    manageCommitment: manageCommitmentTool,
    createRoutine: createRoutineTool,
    createCommitment: createCommitmentTool,
    ...(manageGoalTool ? { manageGoal: manageGoalTool } : {}),
    ...(existingRoutineTool ? { manageRoutine: existingRoutineTool } : {}),
  };

  const conditionalTools =
    context.service === "iMessage" ? { sendReaction } : undefined;

  return { ...tools, ...conditionalTools };
}
