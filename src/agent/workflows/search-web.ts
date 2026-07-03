import { createGoogle } from "@ai-sdk/google";
import { generateText } from "ai";
import Exa from "exa-js";
import env from "../../env";

const exa = new Exa(env.EXA_API_KEY);
const google = createGoogle({ apiKey: env.GEMINI_API_KEY });

export async function searchWeb(query: string) {
  try {
    console.log("[web] Search query:", query);

    // Get search results
    const search = await exa.search(query, {
      type: "auto",
      contents: { highlights: true },
    });

    const sources = search.results.map((result, index) => ({
      id: index + 1,
      title: result.title ?? "Untitled",
      url: result.url,
      publishedDate: result.publishedDate ?? null,
      author: result.author ?? null,
      highlights: result.highlights,
    }));

    // Interpret search results with fast model
    const { text: answer } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      system: `
You answer questions using only the provided web search results.

Rules:
- Do not use outside knowledge.
- If results disagree, say that clearly.
- Prefer official or high-authority sources.
- Include citations like [1], [2] after factual claims.
- If the answer is uncertain, say what is uncertain.
- Keep the answer readable and concise.
`,
      prompt: `
User query:
${query}

Search results:
${JSON.stringify(sources, null, 2)}

Write a helpful answer using the search results.
`,
    });

    console.log("[web] Search answer:", answer);
    return { success: true, answer };
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
