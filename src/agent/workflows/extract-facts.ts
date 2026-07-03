import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { type UserFact, upsertUserFact } from "../../db/queries/user-facts";
import env from "../../env";

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

const FACT_EXTRACTOR_SYSTEM_PROMPT = `You extract durable user profile facts from a text conversation.

Your job is to decide whether the latest exchange contains stable information that will help Zoro personalize future conversations.

Extract ONLY durable facts about the user.

Good facts include:
- communication style preferences
- accountability preferences
- stable personal/work context
- recurring constraints
- stable schedule context
- long-term preferences
- corrections to existing facts

Do NOT extract:
- goals
- habits
- habit completions
- one-off tasks
- temporary plans
- transient emotions
- secrets, passwords, API keys, credentials
- sensitive legal, financial, or identity details
- anything speculative or inferred too aggressively
- timezone facts, because timezone is stored separately

Use concise snake_case keys.
Use concise values.
Prefer updating an existing key over creating a near-duplicate key.
Return an empty facts array when there is nothing durable worth saving.
Return at most 3 facts.`;

const extractedFactsSchema = z.object({
  facts: z
    .array(
      z.object({
        key: z
          .string()
          .describe("Stable snake_case key, like communication_style."),
        value: z.string().describe("Concise durable fact value."),
      }),
    )
    .max(3),
});

export async function extractAndSaveUserFacts({
  userId,
  assistantMessage,
  userMessage,
  existingFacts,
}: {
  userId: string;
  userMessage: string | null;
  assistantMessage: string;
  existingFacts?: UserFact[];
}) {
  if (!userMessage || userMessage.trim() === "") return [];

  const factsText =
    existingFacts && existingFacts.length > 0
      ? existingFacts.map((fact) => `- ${fact.key}: ${fact.value}`).join("\n")
      : "None";

  const prompt = `Existing user facts:
${factsText}

Latest user message:
${userMessage}

Latest assistant response:
${assistantMessage}

Extract any durable user facts from the latest exchange.`;

  const { output } = await generateText({
    model: openai("gpt-5.4-mini"),
    output: Output.object({
      schema: extractedFactsSchema,
    }),
    system: FACT_EXTRACTOR_SYSTEM_PROMPT,
    prompt: prompt,
  });

  const savedFacts: UserFact[] = [];

  // Normalize before saving
  for (const fact of output.facts) {
    const key = fact.key.trim().toLowerCase();
    const value = fact.value.trim();

    if (!key || !value) continue;

    const saved = await upsertUserFact({ userId, key, value });
    savedFacts.push(saved);
  }

  return savedFacts;
}
