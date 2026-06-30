// Blooio V2 Webhook Types
// Ref: https://backend.blooio.com/v2/api/openapi.json

export interface WebhookEvent {
  event: string;
  message_id: string;
  external_id: string;
  status: string;
  protocol: string | null;
  timestamp: number;
  internal_id: string | null;
  text: string | null;
  attachments: MediaAttachment[] | null;
  is_group: boolean;
  group_id: string | null;
  group_name: string | null;
  participants: ChatParticipant[] | null;
  sender: string | null;
  sent_at?: number | null;
  delivered_at?: number | null;
  read_at?: number | null;
  error_code?: string | null;
  error_message?: string | null;
}

export interface ChatParticipant {
  contact_id: string;
  identifier: string;
  name: string | null;
}

export type MessageService = "iMessage" | "SMS" | "RCS";

export interface MediaAttachment {
  url: string;
  name?: string;
}

export interface ExtractedMedia {
  url: string;
  mimeType: string;
}

export type MessageHandler = (
  chatId: string,
  from: string,
  text: string,
  messageId: string,
  images: ExtractedMedia[],
  audio: ExtractedMedia[],
  service?: MessageService,
) => Promise<void>;

export type Reaction =
  | "love"
  | "like"
  | "dislike"
  | "laugh"
  | "emphasize"
  | "question";

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".bmp",
  ".tiff",
];

const AUDIO_EXTENSIONS = [
  ".m4a",
  ".mp3",
  ".wav",
  ".aac",
  ".ogg",
  ".caf",
  ".amr",
];

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
    case "non-imessage":
      return "SMS";
    default:
      return undefined;
  }
}

// Infer MIME type from URL or filename.
function inferMimeType(url: string, name?: string | null): string {
  const source = (name || url).toLowerCase();

  // Images
  if (source.includes(".jpg") || source.includes(".jpeg")) return "image/jpeg";
  if (source.includes(".png")) return "image/png";
  if (source.includes(".gif")) return "image/gif";
  if (source.includes(".webp")) return "image/webp";
  if (source.includes(".heic")) return "image/heic";
  if (source.includes(".heif")) return "image/heif";
  if (source.includes(".bmp")) return "image/bmp";
  if (source.includes(".tiff")) return "image/tiff";

  // Audio
  if (source.includes(".m4a")) return "audio/mp4";
  if (source.includes(".mp3")) return "audio/mpeg";
  if (source.includes(".wav")) return "audio/wav";
  if (source.includes(".aac")) return "audio/aac";
  if (source.includes(".ogg")) return "audio/ogg";
  if (source.includes(".caf")) return "audio/x-caf";
  if (source.includes(".amr")) return "audio/amr";

  return "application/octet-stream";
}

function matchesExtensions(
  url: string,
  name: string | null | undefined,
  extensions: string[],
): boolean {
  const urlLower = url.toLowerCase();
  const nameLower = (name || "").toLowerCase();
  const matches = extensions.some(
    (ext) => urlLower.includes(ext) || nameLower.endsWith(ext),
  );
  return matches;
}

export function extractImageAttachments(
  attachments: MediaAttachment[] | null,
): ExtractedMedia[] {
  if (!attachments) return [];

  const extractedMedia = attachments
    .filter((a) => a.url && matchesExtensions(a.url, a.name, IMAGE_EXTENSIONS))
    .map((a) => ({
      url: a.url,
      mimeType: inferMimeType(a.url, a.name),
    }));

  return extractedMedia;
}

export function extractAudioAttachments(
  attachments: MediaAttachment[] | null,
): ExtractedMedia[] {
  if (!attachments) return [];

  const extractedMedia = attachments
    .filter((a) => a.url && matchesExtensions(a.url, a.name, AUDIO_EXTENSIONS))
    .map((a) => ({
      url: a.url,
      mimeType: inferMimeType(a.url, a.name),
    }));

  return extractedMedia;
}
