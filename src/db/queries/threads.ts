import { and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { messages, participants, threads } from "../schema";
import { getUserId } from "./users";

export type Thread = typeof threads.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Participant = typeof participants.$inferSelect;

export async function findOrCreateThread(
  blooioChatId: string,
  isGroup = false,
): Promise<Thread> {
  const [inserted] = await db
    .insert(threads)
    .values({ blooio_chat_id: blooioChatId, is_group: isGroup })
    .onConflictDoNothing({ target: threads.blooio_chat_id })
    .returning();

  if (inserted) return inserted as Thread;

  const [found] = await db
    .select()
    .from(threads)
    .where(eq(threads.blooio_chat_id, blooioChatId));

  if (found) return found as Thread;

  throw new Error("Thread not found or created");
}

export async function findOrCreateParticipant({
  userId,
  threadId,
}: {
  userId: string;
  threadId: string;
}): Promise<Participant> {
  const [inserted] = await db
    .insert(participants)
    .values({ thread_id: threadId, user_id: userId })
    .onConflictDoNothing({
      target: [participants.user_id, participants.thread_id],
    })
    .returning();

  if (inserted) return inserted as Participant;

  const [found] = await db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.user_id, userId),
        eq(participants.thread_id, threadId),
      ),
    );

  if (found) return found as Participant;

  throw new Error("Participant not found or created");
}

export async function getConversation({
  phoneNumber,
  blooioChatId,
  isGroup = false,
  limit = 50,
}: {
  phoneNumber: string;
  blooioChatId: string;
  isGroup?: boolean;
  limit?: number;
}) {
  const userId = await getUserId(phoneNumber);
  const thread = await findOrCreateThread(blooioChatId, isGroup);
  await findOrCreateParticipant({ userId, threadId: thread.id });

  // Get list of messages, sorted by newest first (desc)
  // Must be reversed so conversation flows oldest to newest
  const conversation = (
    await db
      .select()
      .from(messages)
      .where(eq(messages.thread_id, thread.id))
      .orderBy(desc(messages.created_at))
      .limit(limit)
  ).reverse();

  return { conversation, thread };
}

export async function saveMessage({
  phoneNumber,
  blooioChatId,
  role,
  content,
  isGroup = false,
}: {
  phoneNumber: string;
  blooioChatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  isGroup?: boolean;
}) {
  // Authenticate user by phone number
  const userId = await getUserId(phoneNumber);

  // Find/create thread
  const thread = await findOrCreateThread(blooioChatId, isGroup);

  // Ensure participant exists in thread
  await findOrCreateParticipant({ userId, threadId: thread.id });

  const [inserted] = await db
    .insert(messages)
    .values({
      user_id: userId,
      thread_id: thread.id,
      role,
      content,
    })
    .returning();

  if (!inserted) {
    throw new Error("Message failed to save");
  }

  return inserted.id;
}
