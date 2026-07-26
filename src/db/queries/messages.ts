import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { messages } from "../schema";
import { findOrCreateParticipant } from "./threads";

export type Message = typeof messages.$inferSelect;

export async function createMessage({
  userId,
  threadId,
  role,
  content,
}: {
  userId: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
}) {
  // Ensure participant exists
  await findOrCreateParticipant({ userId, threadId });

  const [inserted] = await db
    .insert(messages)
    .values({
      user_id: userId,
      thread_id: threadId,
      role,
      content,
    })
    .returning();

  if (!inserted) {
    throw new Error("Message failed to save");
  }

  return inserted.id;
}

export async function getRecentMessages({
  userId,
  threadId,
  limit = 20,
}: {
  userId: string;
  threadId: string;
  limit?: number;
}): Promise<Message[]> {
  await findOrCreateParticipant({ userId, threadId });

  // Get list of messages, sorted by newest first (desc)
  // Must be reversed so conversation flows oldest to newest
  const conversation = (
    await db
      .select()
      .from(messages)
      .where(eq(messages.thread_id, threadId))
      .orderBy(desc(messages.created_at))
      .limit(limit)
  ).reverse();

  return conversation;
}
