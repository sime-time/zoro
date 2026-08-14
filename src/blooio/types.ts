// Blooio V4 Webhook Types

export interface WebhookEvent {
  id: string;
  type: string;
  created_at: number;
  organization_id: string;
  data: MessageEventData;
}

export interface GroupData {
  group_id: string;
  name: string | null;
  icon_url: string | null;
  chat_id: string;
  channel_id: string;
  channel_type: string;
  member_count: number;
}

export interface MessageEventData {
  message_id: string;
  chat_id: string;
  channel_id: string;
  channel_type: string;
  kind: string;
  direction: "inbound" | "outbound";
  text: string | null;
  status: string;
  protocol: string | null;
  provider_message_id?: string | null;
  message_type: string;
  sender: string;
  recipient: string;
  contact: {
    identifier: string;
  } | null;
  channel_address: string;
  attachments: MediaAttachment[];
  is_group?: boolean;
  group?: GroupData | null;
}

export type MessageService = "iMessage" | "SMS" | "RCS";

export interface MediaAttachment {
  url: string;
  size?: number;
  media_type?: string | null;
  caption?: string | null;
}

export interface ExtractedMedia {
  url: string;
  mimeType: string;
}

export const REACTIONS = [
  "love",
  "like",
  "dislike",
  "laugh",
  "emphasize",
  "question",
] as const;

export type Reaction = (typeof REACTIONS)[number];

export function mapProtocolToService(
  protocol: string | null,
): MessageService | undefined {
  if (!protocol) return undefined;

  switch (protocol.toLowerCase()) {
    case "imessage":
      return "iMessage";
    case "sms":
      return "SMS";
    case "rcs":
      return "RCS";
    default:
      return undefined;
  }
}

function inferMimeTypeFromUrl(url: string): string | null {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".heic")) return "image/heic";
  if (pathname.endsWith(".heif")) return "image/heif";
  if (pathname.endsWith(".bmp")) return "image/bmp";
  if (pathname.endsWith(".tiff")) return "image/tiff";
  if (pathname.endsWith(".avif")) return "image/avif";

  if (pathname.endsWith(".m4a")) return "audio/mp4";
  if (pathname.endsWith(".mp3")) return "audio/mpeg";
  if (pathname.endsWith(".wav")) return "audio/wav";
  if (pathname.endsWith(".aac")) return "audio/aac";
  if (pathname.endsWith(".ogg")) return "audio/ogg";
  if (pathname.endsWith(".caf")) return "audio/x-caf";
  if (pathname.endsWith(".amr")) return "audio/amr";

  return null;
}

function getMimeType(attachment: MediaAttachment): string | null {
  return attachment.media_type || inferMimeTypeFromUrl(attachment.url);
}

export function extractImageAttachments(
  attachments: MediaAttachment[],
): ExtractedMedia[] {
  console.log("Extract image attachments:", attachments);
  return attachments
    .map((attachment) => ({
      attachment,
      mimeType: getMimeType(attachment),
    }))
    .filter(({ mimeType }) => mimeType?.startsWith("image/"))
    .map(({ attachment, mimeType }) => ({
      url: attachment.url,
      mimeType: mimeType as string,
    }));
}

export function extractAudioAttachments(
  attachments: MediaAttachment[],
): ExtractedMedia[] {
  console.log("Extract audio attachments:", attachments);
  return attachments
    .map((attachment) => ({
      attachment,
      mimeType: getMimeType(attachment),
    }))
    .filter(({ mimeType }) => mimeType?.startsWith("audio/"))
    .map(({ attachment, mimeType }) => ({
      url: attachment.url,
      mimeType: mimeType as string,
    }));
}
