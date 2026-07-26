import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type ModelMessage } from "ai";
import type { Commitment } from "../../db/queries/commitments";
import type { Goal } from "../../db/queries/goals";
import type { ScheduledMessage } from "../../db/queries/scheduled";
import type { Message, Thread } from "../../db/queries/threads";
import type { User } from "../../db/queries/users";
import env from "../../env";

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

function formatDateTime(date: Date, timezone: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone ?? "UTC",
  }).format(date);
}

function buildSystemPrompt({
  scheduledMessage,
  commitment,
  goal,
  user,
  thread,
  now,
}: {
  scheduledMessage: ScheduledMessage;
  commitment: Commitment;
  goal?: Goal | null;
  user: User;
  thread: Thread;
  now: Date;
}) {
  const lines = [
    "You are Zoro, a conversational accountability assistant texting the user.",
    "Write exactly one short check-in message about a commitment that recently became due.",
    "Tone: casual, warm, concise, and natural, like a friend remembered what they said they would do.",
    "Do not sound like a reminder app. Do not guilt-trip. Do not lecture. Do not use markdown.",
    "Ask one clear question. Keep it under 25 words.",
    "Do not mention internal IDs, database records, scheduled messages, or automation.",
    "Use the conversation history only to match tone and avoid sounding out of place.",
    "",
    "Context:",
    `- scheduled message type: ${scheduledMessage.type}`,
    `- current time: ${formatDateTime(now, user.timezone)}`,
    `- user name: ${user.name ?? "unknown"}`,
    `- user timezone: ${user.timezone ?? "unknown"}`,
    `- chat type: ${thread.is_group ? "group" : "one-on-one"}`,
    `- commitment title: ${commitment.title}`,
  ];

  if (commitment.details) {
    lines.push(`- commitment details: ${commitment.details}`);
  }

  if (commitment.success_criteria) {
    lines.push(`- success criteria: ${commitment.success_criteria}`);
  }

  if (commitment.motivation) {
    lines.push(`- motivation: ${commitment.motivation}`);
  }

  if (commitment.due_at) {
    lines.push(
      `- commitment due time: ${formatDateTime(commitment.due_at, user.timezone)}`,
    );
  }

  if (goal) {
    lines.push(`- related goal: ${goal.title}`);

    if (goal.description) {
      lines.push(`- related goal description: ${goal.description}`);
    }

    if (goal.motivation) {
      lines.push(`- related goal motivation: ${goal.motivation}`);
    }
  }

  return lines.join("\n");
}

export async function renderCheckInMessage({
  scheduledMessage,
  commitment,
  goal,
  user,
  thread,
  conversation,
  now = new Date(),
}: {
  scheduledMessage: ScheduledMessage;
  commitment: Commitment;
  goal?: Goal | null;
  user: User;
  thread: Thread;
  conversation: Message[];
  now?: Date;
}): Promise<string> {
  const systemPrompt = buildSystemPrompt({
    scheduledMessage,
    commitment,
    goal,
    user,
    thread,
    now,
  });

  const history: ModelMessage[] = conversation.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const checkIn = await generateText({
    model: openai("gpt-5.4"),
    system: systemPrompt,
    messages: [
      ...history,
      {
        role: "user",
        content:
          "Generate the check-in text now. Return only the message to send.",
      },
    ],
  });

  return checkIn.text.trim();
}
