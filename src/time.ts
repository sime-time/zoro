import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import timezonePlugin from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export function formatMessageTimestamp({
  sentAt,
  timezone,
  now = new Date(),
}: {
  sentAt: Date;
  timezone: string | null;
  now?: Date;
}): string {
  if (!timezone || !isValidTimeZone(timezone)) {
    return "Sent at unknown local time";
  }

  const sent = dayjs(sentAt).tz(timezone);
  const current = dayjs(now).tz(timezone);

  return `Sent ${sent.from(current)}: ${sent.format("ddd MMM D, YYYY [at] h:mm A")}`;
}

export function isValidTimeZone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function getCurrentDateTimeInTimezone(timezone: string): string {
  if (!isValidTimeZone(timezone)) return "unknown";

  return dayjs().tz(timezone).format("ddd MMM D, YYYY [at] h:mm A");
}

const TIMEZONE_ALIASES: Record<string, string> = {
  est: "America/New_York",
  edt: "America/New_York",
  et: "America/New_York",
  eastern: "America/New_York",
  "eastern time": "America/New_York",
  nyc: "America/New_York",
  "new york": "America/New_York",

  cst: "America/Chicago",
  cdt: "America/Chicago",
  ct: "America/Chicago",
  central: "America/Chicago",
  "central time": "America/Chicago",
  chicago: "America/Chicago",

  mst: "America/Denver",
  mdt: "America/Denver",
  mt: "America/Denver",
  mountain: "America/Denver",
  "mountain time": "America/Denver",
  denver: "America/Denver",

  pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles",
  pt: "America/Los_Angeles",
  pacific: "America/Los_Angeles",
  "pacific time": "America/Los_Angeles",
  la: "America/Los_Angeles",
  "los angeles": "America/Los_Angeles",

  arizona: "America/Phoenix",
  phoenix: "America/Phoenix",
};

export function normalizeTimeZone(input: string): string | null {
  const timezone = input.trim();

  if (!timezone) return null;

  if (isValidTimeZone(timezone)) {
    return timezone;
  }

  const normalized = timezone
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");

  const alias = TIMEZONE_ALIASES[normalized];

  if (alias && isValidTimeZone(alias)) {
    return alias;
  }

  return null;
}
