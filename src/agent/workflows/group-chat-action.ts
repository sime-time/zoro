// Should the agent respond/react/ignore a message in a group chat

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { Jsonify } from "inngest/types";
import type { MessageService, Reaction } from "../../blooio/types";
import type { ThreadMessage } from "../../db/queries/threads";
import env from "../../env";

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

export type GroupChatAction = "respond" | "react" | "ignore";

export async function getGroupChatAction({
  message,
  sender,
  conversation,
  service,
}: {
  message: string;
  sender: string;
  conversation: Jsonify<ThreadMessage[]>;
  service?: MessageService;
}): Promise<{ action: GroupChatAction; reaction?: Reaction }> {
  const recentMessages = conversation.slice(-4);

  const contextBlock =
    recentMessages.length > 0
      ? recentMessages
          .map((msg) => {
            if (msg.role === "assistant") {
              return `Zoro: ${msg.content}`;
            }

            const sender = msg.sender_name || msg.sender_phone || "Someone";
            return `${sender}: ${msg.content}`;
          })
          .join("\n")
      : "No recent conversation.";

  const canReact = service === "iMessage";

  const reactionOptions = canReact
    ? `- "react:love", "react:like", "react:dislike", "react:laugh", "react:emphasize", or "react:question" - Zoro should only send an iMessage reaction.`
    : "";

  const system = `You classify how Zoro should handle a message in a group chat.

Answer with exactly one of these:
- "respond" - Zoro should send a text reply.
${reactionOptions}
- "ignore" - The humans are talking to each other and Zoro should stay quiet.

Use "respond" when:
- someone mentions Zoro
- someone asks Zoro a question
- someone asks for reminders, web search, scheduling, help, or assistant behavior
- the message is clearly directed at Zoro
- it follows up on something Zoro just said

Use "ignore" when:
- the message is just human-to-human conversation
- Zoro is not being addressed
- responding would interrupt the group

${canReact ? `Use "react:*" when a tapback is enough and no text reply is needed.` : ""}

Return only the classification.`;

  try {
    const response = await generateText({
      model: openai("gpt-5.4"),
      system,
      messages: [
        {
          role: "user",
          content: `Recent conversation:\n${contextBlock}\n\nNew message from ${sender}: "${message}"\n\nHow should Zoro handle this?`,
        },
      ],
    });
    const answer = response.text.toLowerCase().trim();

    if (answer.includes("respond")) {
      return { action: "respond" };
    }

    if (canReact && answer.includes("react")) {
      switch (true) {
        case answer.includes("love"):
          return { action: "react", reaction: "love" };
        case answer.includes("dislike"):
          return { action: "react", reaction: "dislike" };
        case answer.includes("laugh"):
          return { action: "react", reaction: "laugh" };
        case answer.includes("emphasize"):
          return { action: "react", reaction: "emphasize" };
        case answer.includes("question"):
          return { action: "react", reaction: "question" };
        default:
          return { action: "react", reaction: "like" };
      }
    }

    return { action: "ignore" };
  } catch (err) {
    console.error("[group-chat-action] Failed classification:", err);
    return { action: "ignore" };
  }
}
