import { createOpenAI } from "@ai-sdk/openai";
import {
  generateText,
  type ModelMessage,
  stepCountIs,
  type UserContent,
} from "ai";
import type { MessageService, Reaction } from "../blooio/types";
import type { Goal } from "../db/queries/goals";
import type { Habit } from "../db/queries/habits";
import { type Message, saveMessage } from "../db/queries/threads";
import type { UserFact } from "../db/queries/user-facts";
import type { User } from "../db/queries/users";
import env from "../env";
import { buildSystemPrompt } from "./system-prompt";
import { createTools } from "./tools";
import { type AudioInput, transcribeAudio } from "./workflows/transcribe-audio";

export interface ChatContext {
  user: User;
  facts?: UserFact[];
  goals?: Goal[];
  habits?: Habit[];
  isGroupChat: boolean;
  // participantNames: string[];
  service?: MessageService;
}

export interface ChatResponse {
  text: string | null;
  reaction: Reaction | null;
  userText: string | null;
}

export interface ImageInput {
  url: string;
  mimeType: string;
}

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

export async function chat({
  blooioChatId,
  userMessage,
  images = [],
  audio = [],
  conversation = [],
  chatContext,
}: {
  blooioChatId: string;
  userMessage: string;
  images: ImageInput[];
  audio: AudioInput[];
  conversation: Message[];
  chatContext: ChatContext;
}): Promise<ChatResponse> {
  // Build message content (text + images + audio)
  const messageContent: UserContent = [];

  // Handle images
  for (const image of images) {
    messageContent.push({
      type: "file",
      mediaType: "image",
      data: image.url,
    });
  }

  // Build the text from user
  let text = userMessage.trim();

  // Handle audio
  const { success, transcripts } = await transcribeAudio(audio);
  if (success && transcripts.length > 0) {
    // Prepend full transcription to user text
    const fullTranscript = transcripts.join("\n");
    text = `${fullTranscript}\n\n${text}`;
  } else if (!success && audio.length > 0) {
    // Transcription failed - let agent know
    text += `[Someone sent a voice memo but transcription failed. Let them know you couldn't hear it and ask them to try again or type their message.]`;
  } else if (!text && images.length > 0) {
    // Default prompt for images only (no audio, no text)
    text = "[Image attached]";
  }

  if (text) {
    messageContent.push({ type: "text", text });

    // Capture user message before generating response
    await saveMessage({
      phoneNumber: chatContext.user.phone,
      blooioChatId,
      role: "user",
      content: text,
      isGroup: chatContext.isGroupChat,
    });
  }

  // Generate system prompt & tools
  const systemPrompt = buildSystemPrompt(chatContext);
  const tools = createTools(chatContext);

  // Format conversation history with timestamps
  const history: ModelMessage[] = conversation.map((c) => ({
    role: c.role,
    content: c.content,
  }));

  try {
    // Generate AI response
    const response = await generateText({
      model: openai("gpt-5.4"),
      system: systemPrompt,
      tools: tools,
      messages: [
        ...history,
        {
          role: "user",
          content: messageContent,
        },
      ],
      stopWhen: stepCountIs(5),
    });

    // Monitor tool calls to initiate side effects
    let reaction: Reaction | null = null;

    for (const toolCall of response.toolCalls) {
      if (toolCall.dynamic) continue;

      switch (toolCall.toolName) {
        case "sendReaction":
          console.log(
            "[tool] agent wants to react with:",
            toolCall.input.reaction,
          );
          reaction = toolCall.input.reaction;
          break;
      }
    }

    console.log("[chat] AI response:", response.text);

    return { text: response.text, reaction, userText: text };
  } catch (err) {
    console.error("[chat] Failed AI response generation", err);
    throw new Error("Failed to generate AI response");
  }
}
