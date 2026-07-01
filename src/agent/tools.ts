import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { REACTIONS } from "../blooio/types";
import type { ChatContext } from "./chat";

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

  const tools = context.service === "iMessage" ? { sendReaction } : undefined;
  return tools;
}
