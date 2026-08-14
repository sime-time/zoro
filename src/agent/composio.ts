import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import {
  getComposioSession,
  markComposioSessionError,
  upsertComposioSession,
} from "../db/queries/composio";
import env from "../env";

const composio = new Composio({
  apiKey: env.COMPOSIO_API_KEY,
  provider: new VercelProvider(),
});

const COMPOSIO_TOOLKITS = ["gmail", "googlecalendar", "notion"] as const;

export type ComposioToolkit = (typeof COMPOSIO_TOOLKITS)[number];

const TOOLKIT_LABELS: Record<ComposioToolkit, string> = {
  gmail: "Gmail",
  googlecalendar: "Google Calendar",
  notion: "Notion",
};

export async function findOrCreateComposioSession({
  userId,
  threadId,
}: {
  userId: string;
  threadId: string;
}) {
  const existing = await getComposioSession({ userId, threadId });

  if (existing) {
    try {
      return await composio.use(existing.composio_session_id);
    } catch (err) {
      console.error("[composio] Failed to reuse stored session", err);
    }
  }

  const session = await composio.create(userId, {
    toolkits: [...COMPOSIO_TOOLKITS],
    sandbox: { enable: false },
    manageConnections: false,
  });

  await upsertComposioSession({
    userId,
    threadId,
    sessionId: session.sessionId,
    toolkits: [...COMPOSIO_TOOLKITS],
  });

  return session;
}

export async function getComposioTools({
  userId,
  threadId,
}: {
  userId: string;
  threadId: string;
}) {
  try {
    const session = await findOrCreateComposioSession({ userId, threadId });
    return await session.tools();
  } catch (err) {
    console.error("[composio] Failed to load tools", err);
    await markComposioSessionError({ userId, threadId, error: err });
    return {};
  }
}

export async function createComposioConnectLink({
  userId,
  threadId,
  toolkit,
}: {
  userId: string;
  threadId: string;
  toolkit: ComposioToolkit;
}) {
  const session = await findOrCreateComposioSession({ userId, threadId });

  const connectionRequest = await session.authorize(toolkit);

  return {
    toolkit,
    toolkitName: TOOLKIT_LABELS[toolkit],
    redirectUrl: connectionRequest.redirectUrl,
  };
}

export async function listComposioConnectedApps({
  userId,
  threadId,
}: {
  userId: string;
  threadId: string;
}) {
  const session = await findOrCreateComposioSession({ userId, threadId });
  const toolkits = await session.toolkits({ limit: 50 });

  return toolkits.items
    .filter((toolkit) =>
      COMPOSIO_TOOLKITS.includes(toolkit.slug as ComposioToolkit),
    )
    .map((toolkit) => ({
      slug: toolkit.slug,
      name: toolkit.name,
      isConnected: toolkit.connection?.isActive ?? false,
      connectedAccountId: toolkit.connection?.connectedAccount?.id ?? null,
    }));
}
