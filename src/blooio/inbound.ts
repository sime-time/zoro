import { chat } from "../agent/chat";
import { getConversation, saveMessage } from "../db/queries/threads";
import { findOrCreateUser } from "../db/queries/users";
import { markAsRead, sendMessage, startTyping, stopTyping } from "./api";
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

    const { conversation, thread } = await getConversation({
      phoneNumber,
      blooioChatId,
      isGroup,
      limit: 20,
    });

    // Get agent's response
    const { text, reaction } = await chat({
      blooioChatId,
      userMessage: textMessage,
      images,
      audio,
      conversation,
      chatContext: {
        sender: user,
        isGroupChat: isGroup,
        service,
      },
    });

    if (text) {
      const agentText = cleanResponse(text);

      await Promise.all([
        sendMessage(blooioChatId, agentText),
        saveMessage({
          phoneNumber,
          blooioChatId,
          role: "assistant",
          content: agentText,
          isGroup,
        }),
      ]);
    }
  } catch (err) {
    console.error("[inbound] Error:", err);
  } finally {
    await stopTyping(blooioChatId);
  }
}
