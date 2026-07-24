import { chat } from "../agent/chat";
import { extractAndSaveMemories } from "../agent/workflows/extract-memories";
import { getUnresolvedCommitments } from "../db/queries/commitments";
import { getActiveGoals } from "../db/queries/goals";
import { getActiveMemories } from "../db/queries/memories";
import { getActiveRoutines } from "../db/queries/routines";
import { getPendingScheduledMessages } from "../db/queries/scheduled";
import { getConversation, saveMessage } from "../db/queries/threads";
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

    const [memories, goals, routines, commitments] = await Promise.all([
      getActiveMemories({ userId: user.id }),
      getActiveGoals(user.id),
      getActiveRoutines(user.id),
      getUnresolvedCommitments(user.id),
    ]);

    const { conversation, thread } = await getConversation({
      phoneNumber,
      blooioChatId,
      isGroup,
      limit: 20,
    });

    const scheduledMessages = await getPendingScheduledMessages({
      userId: user.id,
      threadId: thread.id,
    });

    // Get agent's response
    const { text, reaction, userText } = await chat({
      blooioChatId,
      userMessage: textMessage,
      images,
      audio,
      conversation,
      chatContext: {
        user,
        thread,
        memories,
        goals,
        routines,
        commitments,
        scheduledMessages,
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
        .replace(/\n\s*\n/g, " --- ") // Replace double-newlines with ---
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

      void extractAndSaveMemories({
        userId: user.id,
        userMessage: userText,
        existingMemories: memories,
      }).catch((err) => {
        console.error("[memory] Failed memory extraction:", err);
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
