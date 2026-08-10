import { and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { messages, participants, threads, users } from "../schema";
import type { Message } from "./messages";
import { getUserId } from "./users";

export type Thread = typeof threads.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type ThreadMessage = Message & {
  sender_name: string | null;
  sender_phone: string | null;
};

export async function getThreadById(threadId: string): Promise<Thread> {
  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId));

  if (!thread) {
    throw new Error("Thread not found");
  }

  return thread as Thread;
}

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
  limit = 20,
}: {
  phoneNumber: string;
  blooioChatId: string;
  isGroup?: boolean;
  limit?: number;
}): Promise<{ conversation: ThreadMessage[]; thread: Thread }> {
  const userId = await getUserId(phoneNumber);
  const thread = await findOrCreateThread(blooioChatId, isGroup);
  await findOrCreateParticipant({ userId, threadId: thread.id });

  // Get list of messages, sorted by newest first (desc)
  // Must be reversed so conversation flows oldest to newest
  const conversation = (
    await db
      .select({
        id: messages.id,
        user_id: messages.user_id,
        thread_id: messages.thread_id,
        role: messages.role,
        content: messages.content,
        created_at: messages.created_at,
        updated_at: messages.updated_at,
        sender_name: users.name,
        sender_phone: users.phone,
      })
      .from(messages)
      .innerJoin(users, eq(messages.user_id, users.id))
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
