import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "../client";
import type { memoryImportance, memoryType } from "../enums";
import { memories } from "../schema";

export type Memory = typeof memories.$inferSelect;
export type MemoryType = (typeof memoryType.enumValues)[number];
export type MemoryImportance = (typeof memoryImportance.enumValues)[number];

export async function getActiveMemories({
  userId,
  type,
  limit = 20,
}: {
  userId: string;
  type?: MemoryType;
  limit?: number;
}): Promise<Memory[]> {
  const filters: SQL[] = [
    eq(memories.user_id, userId),
    eq(memories.is_active, true),
  ];

  if (type !== undefined) {
    filters.push(eq(memories.type, type));
  }

  return await db
    .select()
    .from(memories)
    .where(and(...filters))
    .orderBy(asc(memories.created_at))
    .limit(limit);
}

export async function createMemory({
  userId,
  sourceMessageId,
  type,
  subject,
  content,
  importance = "normal",
}: {
  userId: string;
  sourceMessageId?: string | null;
  type: MemoryType;
  subject: string;
  content: string;
  importance?: MemoryImportance;
}): Promise<Memory> {
  if (subject.trim() === "") throw new Error("Memory subject is required");
  if (content.trim() === "") throw new Error("Memory content is required");

  const [memory] = await db
    .insert(memories)
    .values({
      user_id: userId,
      source_message_id: sourceMessageId ?? null,
      type,
      subject: subject.trim(),
      content: content.trim(),
      importance,
    })
    .returning();

  if (!memory) throw new Error("Memory failed to save");

  return memory;
}

export async function updateMemory({
  userId,
  memoryId,
  type,
  subject,
  content,
  importance,
  isActive,
}: {
  userId: string;
  memoryId: string;
  type?: MemoryType;
  subject?: string;
  content?: string;
  importance?: MemoryImportance;
  isActive?: boolean;
}): Promise<Memory> {
  const updates: Partial<typeof memories.$inferInsert> = {
    updated_at: new Date(),
  };

  if (type !== undefined) updates.type = type;

  if (subject !== undefined) {
    if (subject.trim() === "") throw new Error("Memory subject is required");
    updates.subject = subject.trim();
  }

  if (content !== undefined) {
    if (content.trim() === "") throw new Error("Memory content is required");
    updates.content = content.trim();
  }

  if (importance !== undefined) updates.importance = importance;
  if (isActive !== undefined) updates.is_active = isActive;

  const [memory] = await db
    .update(memories)
    .set(updates)
    .where(and(eq(memories.id, memoryId), eq(memories.user_id, userId)))
    .returning();

  if (!memory) throw new Error("Memory not found or failed to update");

  return memory;
}

export async function deactivateMemory({
  userId,
  memoryId,
}: {
  userId: string;
  memoryId: string;
}): Promise<Memory> {
  return await updateMemory({
    userId,
    memoryId,
    isActive: false,
  });
}
