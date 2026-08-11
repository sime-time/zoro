import { Inngest } from "inngest";
import { inboundMessageReceived } from "./inbound";
import { scheduleNextMessage, sendScheduledMessage } from "./schedule";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "zoro" });

export const functions = [
  sendScheduledMessage,
  scheduleNextMessage,
  inboundMessageReceived,
];
