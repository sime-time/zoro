import Perplexity from "@perplexity-ai/perplexity_ai";
import env from "../../env";

const perplexity = new Perplexity({ apiKey: env.PERPLEXITY_API_KEY });

export async function searchWeb(query: string) {
  try {
    console.log("[web] Search query:", query);

    const completion = await perplexity.chat.completions.create({
      model: "sonar-pro",
      messages: [{ role: "user", content: query }],
    });

    const answer = completion.choices[0]?.message.content;

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
