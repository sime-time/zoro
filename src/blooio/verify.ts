import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import env from "../env";

const MAX_WEBHOOK_AGE_SECONDS = 300;

function parseBlooioSignature(header: string) {
  const parts = header.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const signature = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

  if (!timestamp || !signature) {
    throw new Error("Invalid Blooio signature header");
  }

  return { timestamp, signature };
}

export function verifyBlooioSignature(rawBody: string, header: string) {
  const secret = env.BLOOIO_WEBHOOK_SECRET;

  const { timestamp, signature } = parseBlooioSignature(header);

  // Reject webhooks older than 5 minutes (replay protection)
  const timestampSeconds = Number.parseInt(timestamp, 10);
  const age = Math.floor(Date.now() / 1000) - timestampSeconds;
  if (age > MAX_WEBHOOK_AGE_SECONDS) {
    throw new Error("Webhook timestamp too old");
  }
  if (age < -MAX_WEBHOOK_AGE_SECONDS) {
    throw new Error("Webhook timestamp too far in future");
  }

  // Compute expected signature
  const expectedSignature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  // Buffer length check before timingSafeEqual, otherwise malformed signatures can throw
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "hex");
  if (signatureBuffer.length !== expectedSignatureBuffer.length) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(signatureBuffer, expectedSignatureBuffer);
}
