import env from "../env";
import { throwBlooioError } from "./error";
import type { ChatParticipant, MediaAttachment, Reaction } from "./types";

const BASE_URL = env.BLOOIO_BASE_URL;
const API_KEY = env.BLOOIO_API_KEY;

export async function sendMessage(
  blooioChatId: string,
  text: string,
  media?: MediaAttachment[],
) {
  const encodedChatId = encodeURIComponent(blooioChatId);
  const url = `${BASE_URL}/chats/${encodedChatId}/messages`;

  const messageContent: Record<string, unknown> = { text: text };

  if (media && media.length > 0) {
    messageContent.attachments = media.map((m) =>
      m.name ? { url: m.url, name: m.name } : m.url,
    );
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messageContent),
  });

  if (!response.ok) {
    await throwBlooioError(response);
  }

  const data = await response.json();
  console.log(`[blooio] Message sent!`);
  return data;
}

export async function getChatInfo(blooioChatId: string) {
  const encodedChatId = encodeURIComponent(blooioChatId);
  const url = `${BASE_URL}/chats/${encodedChatId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    await throwBlooioError(response);
  }

  const data = (await response.json()) as {
    id: string;
    type: string;
    is_group: boolean;
    group_id: string | null;
    group_name: string | null;
    member_count: number;
    contact: {
      contact_id: string;
      name: string | null;
      identifier: string;
    } | null;
  };

  let participants: ChatParticipant[] = [];

  if (data.is_group && data.group_id) {
    // Fetch group members for participants list
    try {
      const membersUrl = `${BASE_URL}/groups/${data.group_id}/members?limit=200`;
      const membersResponse = await fetch(membersUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      if (membersResponse.ok) {
        const membersData = (await membersResponse.json()) as {
          members: ChatParticipant[];
        };

        participants = membersData.members.map((m) => ({
          contact_id: m.contact_id,
          identifier: m.identifier,
          name: m.name,
        }));
      }
    } catch (err) {
      console.error("[blooio] Failed to fetch group members:", err);
    }
  } else if (data.contact) {
    // 1:1 conversation
    participants = [
      {
        contact_id: data.contact.contact_id,
        identifier: data.contact.identifier,
        name: data.contact.name,
      },
    ];
  }

  return {
    id: data.id,
    participants,
    displayName: data.group_name || null,
    isGroup: data.is_group,
    groupId: data.group_id,
  };
}

export async function markAsRead(blooioChatId: string) {
  const encodedChatId = encodeURIComponent(blooioChatId);
  const url = `${BASE_URL}/chats/${encodedChatId}/read`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    await throwBlooioError(response);
  }

  console.log("[blooio] Chat marked as read");
  return null;
}

export async function startTyping(blooioChatId: string) {
  const encodedChatId = encodeURIComponent(blooioChatId);
  const url = `${BASE_URL}/chats/${encodedChatId}/typing`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    await throwBlooioError(response);
  }

  console.log("[blooio] Typing indicator started");
  return null;
}

export async function stopTyping(blooioChatId: string) {
  const encodedChatId = encodeURIComponent(blooioChatId);
  const url = `${BASE_URL}/chats/${encodedChatId}/typing`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    await throwBlooioError(response);
  }

  console.log("[blooio] Typing indicator stopped");
  return null;
}

export async function sendReaction({
  blooioChatId,
  blooioMessageId,
  reaction,
  action,
}: {
  blooioChatId: string;
  blooioMessageId: string;
  reaction: Reaction;
  action: "add" | "remove";
}) {
  const encodedChatId = encodeURIComponent(blooioChatId);
  const url = `${BASE_URL}/chats/${encodedChatId}/messages/${blooioMessageId}/reactions`;

  // Prefix (+/-) required in Blooio REST API to add/remove
  const prefix = action === "add" ? "+" : "-";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reaction: `${prefix}${reaction}`,
    }),
  });

  if (!response.ok) {
    await throwBlooioError(response);
  }

  console.log(`[blooio] Reaction sent: ${prefix}${reaction}`);
  return await response.json();
}
