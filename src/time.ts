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
