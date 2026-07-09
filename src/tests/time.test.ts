import { describe, expect, test } from "bun:test";
import {
  formatMessageTimestamp,
  getCurrentDateInTimezone,
  isValidTimeZone,
} from "../time";

describe("time utilities", () => {
  test("validates IANA timezones", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("not-a-timezone")).toBe(false);
  });

  test("returns unknown for invalid timezones", () => {
    expect(getCurrentDateInTimezone("not-a-timezone")).toBe("unknown");
  });

  test("returns YYYY-MM-DD for valid timezones", () => {
    const date = getCurrentDateInTimezone("America/New_York");

    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("formats message timestamps with relative and absolute local time", () => {
    const timestamp = formatMessageTimestamp({
      sentAt: new Date("2026-07-09T18:00:00.000Z"),
      now: new Date("2026-07-09T20:00:00.000Z"),
      timezone: "America/New_York",
    });

    expect(timestamp).toBe("Sent 2 hours ago: Thu Jul 9, 2026 at 2:00 PM");
  });

  test("formats week-old message timestamps", () => {
    const timestamp = formatMessageTimestamp({
      sentAt: new Date("2026-07-02T18:00:00.000Z"),
      now: new Date("2026-07-09T18:00:00.000Z"),
      timezone: "America/New_York",
    });

    expect(timestamp).toBe("Sent 7 days ago: Thu Jul 2, 2026 at 2:00 PM");
  });

  test("returns fallback for invalid timezone", () => {
    const timestamp = formatMessageTimestamp({
      sentAt: new Date("2026-07-09T18:00:00.000Z"),
      timezone: "not-a-timezone",
    });

    expect(timestamp).toBe("Sent at unknown local time");
  });
});
