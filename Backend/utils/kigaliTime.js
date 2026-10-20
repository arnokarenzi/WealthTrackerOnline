const TIME_ZONE = "Africa/Kigali";
const pad = (value) => String(value).padStart(2, "0");

/**
 * Read an instant as Kigali calendar/clock components. The optional Date makes
 * rollover behavior deterministic in tests and never depends on the server TZ.
 */
export const getKigaliTime = (instant = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const dateString = `${year}-${pad(month)}-${pad(day)}`;
  const dateTimeString = `${dateString} ${pad(hour)}:${pad(minute)}:${pad(second)}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateString,
    dateTimeString,
    lastDayOfMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
  };
};

export const getKigaliDateString = (instant = new Date()) =>
  getKigaliTime(instant).dateString;

/**
 * Convert a Kigali wall-clock date/time to its corresponding UTC instant.
 * This uses Intl's IANA timezone data rather than assuming the backend host TZ.
 */
const kigaliWallTimeToUtc = ({ year, month, day, hour = 0, minute = 0, second = 0 }) => {
  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const guess = new Date(wallAsUtcMs);
  const zoned = getKigaliTime(guess);
  const zonedAsUtcMs = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
  );
  const offsetMs = zonedAsUtcMs - guess.getTime();
  return new Date(wallAsUtcMs - offsetMs);
};

const parseDateInput = (value, label) => {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(value || ""));
  if (!match) throw new Error(`${label} must use YYYY-MM-DD format.`);
  const [, y, m, d] = match;
  const parts = { year: Number(y), month: Number(m), day: Number(d) };
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() + 1 !== parts.month ||
    check.getUTCDate() !== parts.day
  ) {
    throw new Error(`${label} is not a valid calendar date.`);
  }
  return parts;
};

const toUtcSqlDateTime = (date) => {
  const padUtc = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${padUtc(date.getUTCMonth() + 1)}-${padUtc(date.getUTCDate())} ${padUtc(date.getUTCHours())}:${padUtc(date.getUTCMinutes())}:${padUtc(date.getUTCSeconds())}`;
};

/**
 * Half-open UTC timestamp range for a date filter entered in Kigali dates.
 * Useful for DATETIME columns stored as UTC wall times: [start, endExclusive).
 */
export const getKigaliDateRangeUtc = (startDate, endDate) => {
  const start = parseDateInput(startDate, "startDate");
  const end = parseDateInput(endDate, "endDate");
  if (Date.UTC(end.year, end.month - 1, end.day) < Date.UTC(start.year, start.month - 1, start.day)) {
    throw new Error("endDate must be on or after startDate.");
  }
  const endNextDay = new Date(Date.UTC(end.year, end.month - 1, end.day + 1));
  const startUtc = kigaliWallTimeToUtc(start);
  const endUtc = kigaliWallTimeToUtc({
    year: endNextDay.getUTCFullYear(),
    month: endNextDay.getUTCMonth() + 1,
    day: endNextDay.getUTCDate(),
  });
  return [toUtcSqlDateTime(startUtc), toUtcSqlDateTime(endUtc)];
};
