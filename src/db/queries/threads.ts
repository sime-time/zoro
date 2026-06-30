import { eq } from "drizzle-orm";
import { db } from "../client";
import { type messages, type participants, threads } from "../schema";

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
