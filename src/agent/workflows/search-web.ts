import { LinkupClient } from "linkup-sdk";
import env from "../../env";

const client = new LinkupClient({
  apiKey: env.LINKUP_API_KEY,
});

export async function searchWeb(query: string) {
  try {
    console.log("[web] Search query:", query);

    const searchResult = await client.search({
      query: query,
      depth: "standard",
      outputType: "sourcedAnswer",
    });

    console.log("[web] Search result:", searchResult.answer);

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
