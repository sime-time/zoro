import type { Context } from "hono";
import { inngest } from "../inngest/client";
import {
  extractAudioAttachments,
  extractImageAttachments,
  mapProtocolToService,
  type WebhookEvent,
} from "./types";
import { verifyBlooioSignature } from "./verify";

export async function blooioWebhookHandler(c: Context) {
  const signatureHeader = c.req.header("x-blooio-signature");
  if (!signatureHeader) {
    console.warn("[webhook] Missing Blooio signature");
    return c.json({ status: "unauthorized" }, 401);
  }

  const rawBody = await c.req.text();

  try {
    const isValid = verifyBlooioSignature(rawBody, signatureHeader);
    if (!isValid) {
      console.warn("[webhook] Invalid Blooio signature");
      return c.json({ status: "unauthorized" }, 401);
    }
  } catch (err) {
    console.warn("[webhook] Invalid Blooio signature:", err);
    return c.json({ status: "unauthorized" }, 401);
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody) as WebhookEvent;

    if (event.type !== "message.received") {
      return c.json({ status: "ok" }, 200);
    }

    if (
      typeof event.data.message_id !== "string" ||
      typeof event.data.chat_id !== "string" ||
      typeof event.data.sender !== "string"
    ) {
      return c.json({ status: "bad_request" }, 400);
    }
  } catch (err) {
    console.warn("[webhook] Invalid JSON payload:", err);
    return c.json({ status: "bad_request" }, 400);
  }

  const message = event.data;
  const sender = message.sender;
  if (!sender) {
    console.log("[webhook] Skip message with no sender");
    return c.json({ status: "ok" }, 200);
  }

  // Extract text and media attachments
  const text = message.text || "";
  const images = extractImageAttachments(message.attachments);
  const audio = extractAudioAttachments(message.attachments);

  // Message is empty when there is no text, images, or audio
  if (!text.trim() && images.length === 0 && audio.length === 0) {
    console.log("[webhook] Skip empty message");
    return c.json({ status: "ok" }, 200);
  }

  // v4 chat_id is the stable reply target for both 1:1 and group chats.
  const blooioChatId = message.chat_id;
  const isGroup = Boolean(message.is_group || message.group);
  const service = mapProtocolToService(message.protocol);

  console.log(
    `[webhook] Message from ${sender} in ${blooioChatId}: "${text.substring(0, 50)}"`,
  );

  await inngest.send({
    name: "inbound-message/received",
    data: {
      blooioChatId,
      blooioMessageId: message.message_id,
      sender,
      textMessage: text,
      images,
      audio,
      isGroup,
      service,
    },
  });

  return c.json({ status: "ok" }, 200);
}
