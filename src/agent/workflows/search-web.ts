import OpenAI from "openai";
import env from "../../env";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function searchWeb(query: string, quality: "low" | "high") {
  const model = quality === "high" ? "gpt-5.5" : "gpt-5.4-mini";

  try {
    console.log("[web] Search query:", query);
    console.log("[web] Search model:", model);

    const response = await openai.responses.create({
      model,
      tools: [{ type: "web_search" }],
      input: query,
    });

    console.log("[web] Search answer:", response.output_text);

    return { success: true, answer: response.output_text };
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
