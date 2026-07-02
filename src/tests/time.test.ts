import { describe, expect, test } from "bun:test";
import { getCurrentDateInTimezone, isValidTimeZone } from "../time";

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
});
