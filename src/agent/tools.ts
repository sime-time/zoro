import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { REACTIONS } from "../blooio/types";
import { updateTimezone, updateUserName } from "../db/queries/users";
import { getCurrentDateTimeInTimezone, normalizeTimeZone } from "../time";
import type { ChatContext } from "./chat";
import {
  createReminderAction,
  createReminderSchema,
} from "./workflows/create-reminder";
import { searchWeb } from "./workflows/search-web";

// Every time-related tool starts with this guard
function requireTimezone(context: ChatContext) {
  if (!context.user.timezone) {
    return {
      success: false,
      code: "timezone_required",
      message:
        "Ask the user what city or timezone they are in before setting reminders.",
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
        const userCurrentLocalDateTime =
          getCurrentDateTimeInTimezone(normalizedTZ);

        context.user.timezone = user.timezone;

        return {
          success: true,
          userTimezone: user.timezone,
          userCurrentLocalDateTime,
        };
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

  const createReminderTool = tool({
    description:
      'Create a one-off or simple recurring SMS reminder. Requires the user\'s saved timezone. Resolve relative dates/times into scheduledFor as a timezone-resolved ISO datetime with offset. Use frequency "once" for one-time reminders, "daily" for daily reminders, "weekly" with weekdays, and "monthly" with dayOfMonth. Ask a clarifying question if the reminder time is unclear. Only confirm the reminder after this tool returns success true.',
    inputSchema: createReminderSchema,
    execute: async (input) => {
      const timezoneError = requireTimezone(context);
      if (timezoneError) return timezoneError;

      return await createReminderAction(input, context);
    },
  });

  const tools = {
    setUserName,
    setUserTimezone,
    searchWeb: searchWebTool,
    createReminder: createReminderTool,
  };

  const conditionalTools =
    context.service === "iMessage" ? { sendReaction } : undefined;

  return { ...tools, ...conditionalTools };
}
