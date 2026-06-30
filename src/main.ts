import { Hono } from "hono";
import { blooioWebhookHandler } from "./blooio/webhook";

const app = new Hono();

app.get("/", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() }, 200);
});

app.post("/webhook/blooio", async (c) => blooioWebhookHandler(c));

export default {
  port: 8000,
  fetch: app.fetch,
};
