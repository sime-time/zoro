import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type ModelMessage } from "ai";
import type { Message } from "../../db/queries/messages";
import type { Reminder } from "../../db/queries/reminders";
import type { Thread } from "../../db/queries/threads";
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
  user,
  thread,
  reminder,
  now,
}: {
  user: User;
  thread: Thread;
  reminder: Reminder;
  now: Date;
}) {
  const lines = [
    "You are Zoro, a conversational reminder assistant that is texting the user.",
    "Write exactly one short reminder message about a reminder the user set earlier.",
    "Tone: casual, warm, concise, and natural, like a friend remembered what they said they should do.",
    "Do not sound like a reminder app. Do not guilt-trip. Do not lecture. Do not use markdown.",
    "Do not use em dashes",
    "Do not mention internal IDs, database records, scheduled messages, or automation.",
    "Use the conversation history only to match tone and avoid sounding out of place.",
    "Keep it under 25 words",
    "Return only the reminder text. No quotes.",
    "",
    "Context:",
    `- current time: ${formatDateTime(now, user.timezone)}`,
    `- user name: ${user.name ?? "unknown"}`,
    `- user timezone: ${user.timezone ?? "unknown"}`,
    `- chat type: ${thread.is_group ? "group" : "one-on-one"}`,
    `- reminder title: ${reminder.title}`,
  ];

  if (reminder.details) {
    lines.push(`- details: ${reminder.details}`);
  }

  return lines.join("\n");
}

export async function generateReminderMessage({
  user,
  thread,
  reminder,
  conversation,
  now = new Date(),
}: {
  user: User;
  thread: Thread;
  reminder: Reminder;
  conversation: Message[];
  now?: Date;
}): Promise<string> {
  const systemPrompt = buildSystemPrompt({
    user,
    thread,
    reminder,
    now,
  });

  const history: ModelMessage[] = conversation.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const message = await generateText({
    model: openai("gpt-5.4"),
    system: systemPrompt,
    messages: [
      ...history,
      {
        role: "user",
        content:
          "Generate the reminder text now. Return only the message to send.",
      },
    ],
  });

  return message.text.trim();
}
