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
