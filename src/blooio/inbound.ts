import { findOrCreateUser } from "../db/queries/users";
import { markAsRead, startTyping } from "./api";
import type { ChatParticipant, ExtractedMedia, MessageService } from "./types";

interface InboundMessageArgs {
  blooioChatId: string;
  blooioMessageId: string;
  blooioParticipants: ChatParticipant[];
  sender: string;
  text: string;
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
  text,
  images = [],
  audio = [],
  isGroup = false,
  service,
}: InboundMessageArgs) {
  const phoneNumber = sender;

  // Acknowledge message
  await Promise.all([markAsRead(blooioChatId), startTyping(blooioChatId)]);

  try {
    const user = await findOrCreateUser(phoneNumber);
  } catch (err) {}
}
