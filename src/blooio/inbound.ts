import { chat } from "../agent/chat";
import { extractAndSaveUserFacts } from "../agent/workflows/extract-facts";
import { getActiveGoals } from "../db/queries/goals";
import { getActiveHabits } from "../db/queries/habits";
import { getConversation, saveMessage } from "../db/queries/threads";
import { getUserFacts } from "../db/queries/user-facts";
import { findOrCreateUser } from "../db/queries/users";
import {
  markAsRead,
  sendMessage,
  sendReaction,
  startTyping,
  stopTyping,
} from "./api";
import type { ChatParticipant, ExtractedMedia, MessageService } from "./types";

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

interface InboundMessageArgs {
  blooioChatId: string;
  blooioMessageId: string;
  blooioParticipants: ChatParticipant[];
  sender: string;
  textMessage: string;
  images: ExtractedMedia[];
  audio: ExtractedMedia[];
  isGroup?: boolean;
  service?: MessageService;
}

export async function handleInboundMessage({
  blooioChatId,
  blooioMessageId,
  blooioParticipants = [],
  sender,
  textMessage,
  images = [],
  audio = [],
  isGroup = false,
  service,
}: InboundMessageArgs) {
  // Acknowledge message
  await Promise.all([markAsRead(blooioChatId), startTyping(blooioChatId)]);

  try {
    const phoneNumber = sender;

    const user = await findOrCreateUser(phoneNumber);
    const facts = await getUserFacts(user.id);

    // Get active goals and habits
    const goals = await getActiveGoals(user.id);
    const habits = await getActiveHabits(user.id);

    const { conversation, thread } = await getConversation({
      phoneNumber,
      blooioChatId,
      isGroup,
      limit: 20,
    });

    // Get agent's response
    const { text, reaction, userText } = await chat({
      blooioChatId,
      userMessage: textMessage,
      images,
      audio,
      conversation,
      chatContext: {
        user: user,
        facts,
        goals,
        habits,
        isGroupChat: isGroup,
        service,
      },
    });

    // Handle reaction first
    if (reaction) {
      await sendReaction({
        blooioChatId,
        blooioMessageId,
        reaction,
        action: "add",
      });
    }

    // Split text message by variants of "---"
    if (text) {
      const messages = text
        .replace(/\n\s*\n\s*\n/g, " --- ") // Replace \n\n\n with ---
        .split(/\s*-\s*-\s*-\s*/g) // Split by any combo of "---"
        .map((message) => cleanResponse(message))
        .filter((message) => message.length > 0);

      const fullMessage = messages.join(" ");

      await saveMessage({
        phoneNumber,
        blooioChatId,
        role: "assistant",
        content: fullMessage,
        isGroup,
      });

      void extractAndSaveUserFacts({
        userId: user.id,
        userMessage: userText,
        assistantMessage: text,
        existingFacts: facts,
      }).catch((err) => {
        console.error("[facts] Failed fact extraction:", err);
      });

      // Send multiple text messages split by "---"
      for (let i = 0; i < messages.length; i++) {
        await sendMessage(blooioChatId, messages[i] || "");
      }
    }
  } catch (err) {
    console.error("[inbound] Error:", err);
  } finally {
    await stopTyping(blooioChatId);
  }
}
