import { LinkupClient } from "linkup-sdk";
import { z } from "zod";
import env from "../../env";

const client = new LinkupClient({
  apiKey: env.LINKUP_API_KEY,
});

export const searchWebSchema = z.object({
  role: z
    .string()
    .describe(
      "The perspective Linkup should use, e.g. 'You are an expert sports researcher' or 'You are an expert GTM consultant'.",
    ),
  scope: z
    .string()
    .describe(
      "Where Linkup should look. Include domains, source types, time window, geography, or 'the live web' when broad search is needed.",
    ),
  method: z
    .string()
    .describe(
      "What Linkup should extract, verify, compare, or summarize. Be explicit about facts, fields, entities, or evidence needed.",
    ),
  format: z
    .string()
    .describe(
      "How Linkup should answer. Usually concise sourced prose for Zoro's final texting response. Ask for source URLs when useful.",
    ),
});

export async function searchWeb(query: string) {
  try {
    console.log("[web] Search query:", query);

    const searchResult = await client.search({
      query: query,
      depth: "standard",
      outputType: "sourcedAnswer",
    });

    console.log("[web] Search answer:", searchResult.answer);

    return { success: true, answer: searchResult.answer };
  } catch (err) {
    console.error("[web] Search failed:", err);
    return {
      success: false,
      code: "search_failed",
      message:
        "Web search failed. Answer without current web info or ask the user to try again.",
    };
  }
}
