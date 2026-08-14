import env from "../env";
import { throwBlooioError } from "./error";
import type { Reaction } from "./types";

const BASE_URL = env.BLOOIO_BASE_URL;
const API_KEY = env.BLOOIO_API_KEY;

export async function sendMessage(blooioChatId: string, text: string) {
  const encodedChatId = encodeURIComponent(blooioChatId);
  const url = `${BASE_URL}/chats/${encodedChatId}/messages`;

  const messageContent: Record<string, unknown> = { text };

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

  const data = await response.json();
  console.log("[blooio] Chat marked as read");
  return data;
}

export async function startTyping(blooioChatId: string) {
  const encodedChatId = encodeURIComponent(blooioChatId);
  const url = `${BASE_URL}/chats/${encodedChatId}/typing`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state: "started" }),
  });

  if (!response.ok) {
    await throwBlooioError(response);
  }

  const data = await response.json();
  console.log("[blooio] Typing indicator started");
  return data;
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

  const data = await response.json();
  console.log("[blooio] Typing indicator stopped");
  return data;
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

  const data = await response.json();
  console.log(`[blooio] Reaction sent: ${prefix}${reaction}`);
  return data;
}
