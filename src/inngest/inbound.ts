import { chat } from "../agent/chat";
import { extractAndSaveMemories } from "../agent/workflows/extract-memories";
import { getGroupChatAction } from "../agent/workflows/group-chat-action";
import {
  markAsRead,
  sendMessage,
  sendReaction,
  startTyping,
  stopTyping,
} from "../blooio/api";
import type { ExtractedMedia, MessageService } from "../blooio/types";
import { getActiveMemories } from "../db/queries/memories";
import { getActiveReminders } from "../db/queries/reminders";
import { getConversation, saveMessage } from "../db/queries/threads";
import { findOrCreateUser } from "../db/queries/users";
import { inngest } from "./client";

interface InboundMessageArgs {
  blooioChatId: string;
  blooioMessageId: string;
  sender: string;
  textMessage: string;
  images: ExtractedMedia[];
  audio: ExtractedMedia[];
  isGroup?: boolean;
  service?: MessageService;
}

// Clean up LLM response formatting quirks before sending
function cleanResponse(text: string): string {
  return (
    text
      // Turn newline-dash into inline dash (e.g., "foo\n - bar" → "foo - bar")
      .replace(/\n\s*-\s*/g, " - ")
      // Remove markdown underlines/italics (_text_ → text)
      .replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1")
      // Remove markdown bold (**text** → text)
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      // Remove stray asterisks used for emphasis
      .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, "$1")
      // Clean up multiple spaces
      .replace(/ {2,}/g, " ")
      // Clean up extra newlines (but preserve intentional double-newlines for --- splits)
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export const inboundMessageReceived = inngest.createFunction(
  {
    id: "inbound-message-received",
    triggers: [{ event: "inbound-message/received" }],
  },
  async ({ event, step }) => {
    const {
      blooioChatId,
      blooioMessageId,
      sender,
      textMessage,
      images = [],
      audio = [],
      isGroup = false,
      service,
    } = event.data as InboundMessageArgs;

    try {
      await step.run("acknowledge message", () =>
        Promise.all([markAsRead(blooioChatId), startTyping(blooioChatId)]),
      );

      const phoneNumber = sender;
      const user = await step.run("find or create user", () =>
        findOrCreateUser(phoneNumber),
      );

      const [reminders, memories] = await step.run("load user context", () =>
        Promise.all([
          getActiveReminders(user.id),
          getActiveMemories({ userId: user.id }),
        ]),
      );

      const { conversation, thread } = await step.run("load conversation", () =>
        getConversation({
          phoneNumber,
          blooioChatId,
          isGroup,
          limit: 20,
        }),
      );

      // Determine if agent should respond/react/ignore in group chat
      if (isGroup && images.length === 0 && audio.length === 0) {
        const { action, reaction: groupReaction } = await step.run(
          "get group chat action",
          () =>
            getGroupChatAction({
              message: textMessage,
              sender,
              conversation,
              service,
            }),
        );

        if (action === "ignore") {
          return;
        }

        if (action === "react") {
          if (groupReaction) {
            await step.run("send group reaction", () =>
              sendReaction({
                blooioChatId,
                blooioMessageId,
                reaction: groupReaction,
                action: "add",
              }),
            );

            await step.run("save group reaction as messages", async () => {
              await saveMessage({
                phoneNumber,
                blooioChatId,
                role: "user",
                content: textMessage,
                isGroup: true,
              });

              await saveMessage({
                phoneNumber,
                blooioChatId,
                role: "assistant",
                content: `[reacted with ${groupReaction}]`,
                isGroup: true,
              });
            });
          }

          // Reaction-only response; no full chat response needed.
          return;
        }
      }

      // Get agent's response
      const { text, reaction, userText } = await step.run(
        "generate chat response",
        () =>
          chat({
            blooioChatId,
            userMessage: textMessage,
            images,
            audio,
            conversation,
            chatContext: {
              user,
              thread,
              memories,
              reminders,
              isGroupChat: isGroup,
              senderHandle: sender,
              service,
            },
          }),
      );

      // Handle reaction first
      if (reaction) {
        await step.run("send reaction", () =>
          sendReaction({
            blooioChatId,
            blooioMessageId,
            reaction,
            action: "add",
          }),
        );
      }

      // Split text message by variants of "---"
      if (text) {
        const messages = text
          .replace(/\n\s*\n/g, " --- ") // Replace double-newlines with ---
          .split(/\s*-\s*-\s*-\s*/g) // Split by any combo of "---"
          .map((message) => cleanResponse(message))
          .filter((message) => message.length > 0);

        const fullMessage = messages.join(" ");

        await step.run("save assistant message", () =>
          saveMessage({
            phoneNumber,
            blooioChatId,
            role: "assistant",
            content: fullMessage,
            isGroup,
          }),
        );

        await step.run("extract and save memories", () =>
          extractAndSaveMemories({
            userId: user.id,
            userMessage: userText,
            existingMemories: memories,
          }),
        );

        // Send multiple text messages split by "---"
        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];
          if (!message) continue;
          await step.run(`send blooio message ${i + 1}`, () =>
            sendMessage(blooioChatId, message),
          );
        }
      }
    } finally {
      await step.run("stop typing", () => stopTyping(blooioChatId));
    }
  },
);
