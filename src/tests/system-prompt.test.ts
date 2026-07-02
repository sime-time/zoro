import { describe, expect, test } from "bun:test";
import type { ChatContext } from "../agent/chat";
import { buildSystemPrompt } from "../agent/system-prompt";

const baseUser = {
  id: "user-1",
  phone: "+15555555555",
  name: "Simon",
  email: null,
  timezone: "America/Los_Angeles",
  created_at: new Date("2026-07-02T00:00:00.000Z"),
  updated_at: new Date("2026-07-02T00:00:00.000Z"),
};

describe("buildSystemPrompt", () => {
  test("includes user timezone and current local date", () => {
    const context = {
      user: baseUser,
      isGroupChat: false,
      service: "iMessage",
    } satisfies ChatContext;

    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain("Name: Simon");
    expect(prompt).toContain("Timezone: America/Los_Angeles");
    expect(prompt).toMatch(
      /Current date in user's timezone: \d{4}-\d{2}-\d{2}/,
    );
  });

  test("tells Zoro to ask for timezone when unknown", () => {
    const context = {
      user: { ...baseUser, timezone: null },
      isGroupChat: false,
      service: "SMS",
    } satisfies ChatContext;

    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain("Timezone: unknown");
    expect(prompt).toContain("ask for their timezone first");
    expect(prompt).toContain("Do not guess");
  });

  test("includes active goals with internal IDs", () => {
    const context = {
      user: baseUser,
      goals: [
        {
          id: "goal-1",
          user_id: "user-1",
          title: "Ship Zoro MVP",
          description: "Finish memory and habits",
          motivation: "Prove text accountability works",
          status: "active",
          deadline: "2026-07-15",
          created_at: new Date("2026-07-02T00:00:00.000Z"),
          updated_at: new Date("2026-07-02T00:00:00.000Z"),
        },
      ],
      isGroupChat: false,
      service: "iMessage",
    } satisfies ChatContext;

    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain("## Active Goals");
    expect(prompt).toContain("id: goal-1");
    expect(prompt).toContain("title: Ship Zoro MVP");
    expect(prompt).toContain("description: Finish memory and habits");
    expect(prompt).toContain("motivation: Prove text accountability works");
    expect(prompt).toContain("deadline: 2026-07-15");
    expect(prompt).toContain(
      "Use IDs only for tool calls. Never mention internal IDs to the user.",
    );
  });

  test("includes active habits with internal IDs and targets", () => {
    const context = {
      user: baseUser,
      habits: [
        {
          id: "habit-1",
          user_id: "user-1",
          name: "Gym",
          description: "Lift consistently",
          target_count: 4,
          target_period: "week",
          scheduled_days: ["monday", "wednesday", "friday", "saturday"],
          status: "active",
          created_at: new Date("2026-07-02T00:00:00.000Z"),
          updated_at: new Date("2026-07-02T00:00:00.000Z"),
        },
      ],
      isGroupChat: false,
      service: "iMessage",
    } satisfies ChatContext;

    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain("## Active Habits");
    expect(prompt).toContain("id: habit-1");
    expect(prompt).toContain("name: Gym");
    expect(prompt).toContain("target: 4 per week");
    expect(prompt).toContain(
      "scheduled days: monday, wednesday, friday, saturday",
    );
    expect(prompt).toContain("description: Lift consistently");
  });

  test("includes messaging platform reaction guidance", () => {
    const context = {
      user: baseUser,
      isGroupChat: false,
      service: "iMessage",
    } satisfies ChatContext;

    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain("This conversation is happening over iMessage.");
    expect(prompt).toContain("Reactions are available");
  });
});
