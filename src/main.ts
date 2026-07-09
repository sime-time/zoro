import { Hono } from "hono";
import { serve } from "inngest/hono";
import { blooioWebhookHandler } from "./blooio/webhook";
import { functions, inngest } from "./inngest/client";

const app = new Hono();

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() }, 200);
});

app.post("/webhook/blooio", async (c) => blooioWebhookHandler(c));

app.on(
  ["GET", "PUT", "POST"],
  "/api/inngest",
  serve({ client: inngest, functions }),
);

app.get("/api/hello", async (c) => {
  const result = await inngest.send({
    name: "test/hello.world",
    data: {
      email: "testUser@example.com",
    },
  });

  return c.json({ status: "ok", result });
});

export default app;
