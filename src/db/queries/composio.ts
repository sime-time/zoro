import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { composioSessions } from "../schema";

export type ComposioSession = typeof composioSessions.$inferSelect;

export async function getComposioSession({
  userId,
  threadId,
}: {
  userId: string;
  threadId: string;
}): Promise<ComposioSession | null> {
  const [session] = await db
    .select()
    .from(composioSessions)
    .where(
      and(
        eq(composioSessions.user_id, userId),
        eq(composioSessions.thread_id, threadId),
      ),
    )
    .limit(1);

  return session ?? null;
}

export async function upsertComposioSession({
  userId,
  threadId,
  sessionId,
  toolkits,
}: {
  userId: string;
  threadId: string;
  sessionId: string;
  toolkits?: string[];
}): Promise<ComposioSession> {
  const [session] = await db
    .insert(composioSessions)
    .values({
      user_id: userId,
      thread_id: threadId,
      composio_session_id: sessionId,
      toolkits,
      last_error: null,
    })
    .onConflictDoUpdate({
      target: [composioSessions.user_id, composioSessions.thread_id],
      set: {
        composio_session_id: sessionId,
        toolkits,
        last_error: null,
        updated_at: new Date(),
      },
    })
    .returning();

  if (!session) {
    throw new Error("Composio session failed to save");
  }

  return session;
}

export async function deleteComposioSession({
  userId,
  threadId,
}: {
  userId: string;
  threadId: string;
}): Promise<void> {
  await db
    .delete(composioSessions)
    .where(
      and(
        eq(composioSessions.user_id, userId),
        eq(composioSessions.thread_id, threadId),
      ),
    );
}

export async function markComposioSessionError({
  userId,
  threadId,
  error,
}: {
  userId: string;
  threadId: string;
  error: unknown;
}): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);

  await db
    .update(composioSessions)
    .set({
      last_error: message,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(composioSessions.user_id, userId),
        eq(composioSessions.thread_id, threadId),
      ),
    );
}
