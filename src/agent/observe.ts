import type { GenerateTextResult, ToolSet } from "ai";
import type { Reaction } from "../blooio/types";

type GenerateTextType = Pick<GenerateTextResult<ToolSet, any, any>, "steps">;

// Return reaction if the tool sends a reaction side-effect
export function observeTools(response: GenerateTextType): {
  reaction: Reaction | null;
} {
  let reaction: Reaction | null = null;

  for (const [index, step] of response.steps.entries()) {
    const stepNumber = index + 1;

    for (const toolCall of step.toolCalls) {
      if (toolCall.dynamic) {
        console.log(
          `[tool] step ${stepNumber} dynamic call:`,
          toolCall.toolName,
        );
        continue;
      }

      console.log(`[tool] step ${stepNumber} called:`, {
        toolName: toolCall.toolName,
        input: toolCall.input,
      });

      if (toolCall.toolName === "sendReaction") {
        console.log(
          "[tool] agent wants to react with:",
          toolCall.input.reaction,
        );
        reaction = toolCall.input.reaction;
      }
    }

    for (const toolResult of step.toolResults) {
      if (toolResult.dynamic) {
        console.log(
          `[tool] step ${stepNumber} dynamic result:`,
          toolResult.toolName,
        );
        continue;
      }

      console.log(`[tool] step ${stepNumber} result:`, {
        toolName: toolResult.toolName,
        input: toolResult.input,
        output: toolResult.output,
      });
    }

    const toolErrors = step.content.filter(
      (part) => part.type === "tool-error",
    );

    for (const toolError of toolErrors) {
      console.error(`[tool] step ${stepNumber} error:`, {
        toolName: toolError.toolName,
        input: toolError.input,
        error: toolError.error,
      });
    }
  }
  return { reaction };
}
