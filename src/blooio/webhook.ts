import type { Context } from "hono";
import { handleInboundMessage } from "./inbound";
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
    if (event.event !== "message.received") {
      console.log(
        `[webhook] Skip non-"message.received" event: ${event.event}`,
      );
      return c.json({ status: "ok" }, 200);
    }
  } catch (err) {
    console.warn("[webhook] Invalid JSON payload:", err);
    return c.json({ status: "bad_request" }, 400);
  }

  const sender = event.sender;
  if (!sender) {
    console.log("[webhook] Skip message with no sender");
    return c.json({ status: "ok" }, 200);
  }

  // Extract text and media attachments
  const text = event.text || "";
  const images = extractImageAttachments(event.attachments);
  const audio = extractAudioAttachments(event.attachments);

  // Message is empty when there is no text, images, or audio
  if (!text.trim() && images.length === 0 && audio.length === 0) {
    console.log("[webhook] Skip empty message");
    return c.json({ status: "ok" }, 200);
  }

  const blooioChatId =
    event.is_group && event.group_id ? event.group_id : event.external_id;

  console.log(
    `[webhook] Message from ${sender} in ${blooioChatId}: "${text.substring(0, 50)}"`,
  );

  // Pass the cleaned message to handler
  const service = mapProtocolToService(event.protocol);

  void handleInboundMessage({
    blooioChatId,
    blooioMessageId: event.message_id,
    blooioParticipants: event.participants ?? [],
    sender,
    text,
    images,
    audio,
    isGroup: event.is_group,
    service,
  }).catch((err) => {
    console.error("[webhook] Error handling inbound message:", err);
    return c.json({ status: "error" }, 500);
  });

  return c.json({ status: "ok" }, 200);
}
