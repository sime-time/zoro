import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import timezonePlugin from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { Reminder, WeekdayName } from "./db/queries/reminders";

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezonePlugin);

const DAYJS_WEEKDAY_INDEX: Record<WeekdayName, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

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

export function getLocalTime(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;

  if (!hour || !minute) {
    throw new Error("Could not derive local reminder time");
  }

  return `${hour}:${minute}`;
}

function applyLocalTime(date: dayjs.Dayjs, localTime: string) {
  const [hour, minute] = localTime.split(":").map(Number);

  if (
    hour === undefined ||
    minute === undefined ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("localTime must be HH:mm");
  }

  return date.hour(hour).minute(minute).second(0).millisecond(0);
}

export function getNextReminderTime({
  reminder,
  timezone,
  after,
}: {
  reminder: Reminder;
  timezone: string;
  after: Date;
}): Date {
  if (!isValidTimeZone(timezone)) {
    throw new Error("Invalid timezone");
  }

  if (reminder.frequency === "once") {
    throw new Error("This reminder is not recurring");
  }

  if (!reminder.local_time) {
    throw new Error("Recurring reminders require local_time");
  }

  const localAfter = dayjs(after).tz(timezone);
  const localTime = reminder.local_time;
  const interval =
    reminder.interval && reminder.interval > 0 ? reminder.interval : 1;

  switch (reminder.frequency) {
    case "daily": {
      let candidate = applyLocalTime(localAfter, localTime);

      if (!candidate.isAfter(localAfter)) {
        candidate = candidate.add(interval, "day");
      }

      return candidate.toDate();
    }

    case "weekly": {
      if (!reminder.weekdays?.length) {
        throw new Error("Weekly reminders require weekdays");
      }

      const candidates = reminder.weekdays.map((weekday) => {
        const targetDay = DAYJS_WEEKDAY_INDEX[weekday];
        const currentDay = localAfter.day();
        const daysUntil = (targetDay - currentDay + 7) % 7;

        let candidate = applyLocalTime(
          localAfter.add(daysUntil, "day"),
          localTime,
        );

        if (!candidate.isAfter(localAfter)) {
          candidate = candidate.add(7 * interval, "day");
        }

        return candidate;
      });

      const [next] = candidates.sort((a, b) => a.valueOf() - b.valueOf());

      if (!next) {
        throw new Error("Could not compute next weekly reminder time");
      }

      return next.toDate();
    }

    case "monthly": {
      if (
        !reminder.day_of_month ||
        reminder.day_of_month < 1 ||
        reminder.day_of_month > 31
      ) {
        throw new Error(
          "Monthly reminders require day_of_month between 1 and 31",
        );
      }

      let candidateMonth = localAfter;

      let candidate = applyLocalTime(
        candidateMonth.date(
          Math.min(reminder.day_of_month, candidateMonth.daysInMonth()),
        ),
        localTime,
      );

      if (!candidate.isAfter(localAfter)) {
        candidateMonth = localAfter.add(interval, "month");
        candidate = applyLocalTime(
          candidateMonth.date(
            Math.min(reminder.day_of_month, candidateMonth.daysInMonth()),
          ),
          localTime,
        );
      }

      return candidate.toDate();
    }

    default: {
      throw new Error("Reminder frequency not set to daily/weekly/monthly");
    }
  }
}
