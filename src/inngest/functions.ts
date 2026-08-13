import { inboundMessageReceived } from "./inbound";
import { scheduleNextMessage, sendScheduledMessage } from "./schedule";

export const functions = [
  sendScheduledMessage,
  scheduleNextMessage,
  inboundMessageReceived,
];
