import { getLocalSettingsPreferences } from "./settingsPreferences";

const KIGALI_TIME_ZONE = "Africa/Kigali";

type KigaliParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Calendar and clock values in Kigali, independent of the device timezone. */
export const getKigaliDateParts = (instant: Date = new Date()): KigaliParts => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: KIGALI_TIME_ZONE,
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
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

const pad = (value: number) => String(value).padStart(2, "0");

/** YYYY-MM-DD input value for the current (or supplied) Kigali calendar date. */
export const getKigaliDateInputValue = (instant: Date = new Date()): string => {
  const { year, month, day } = getKigaliDateParts(instant);
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** Month/year for a business operation that follows Kigali calendar time. */
export const getKigaliYearMonth = (instant: Date = new Date()) => {
  const { year, month } = getKigaliDateParts(instant);
  return { year, month };
};

const parseKigaliDisplayDate = (year: number, month: number, day: number) => {
  const format = getLocalSettingsPreferences().dateFormat;
  if (format === "MM/dd/yyyy") return `${pad(month)}/${pad(day)}/${year}`;
  if (format === "yyyy-MM-dd") return `${year}-${pad(month)}-${pad(day)}`;
  return `${pad(day)}/${pad(month)}/${year}`;
};

/**
 * Format date values for display in Kigali. SQL DATE values are returned as
 * YYYY-MM-DD and preserved as dates; timestamp instants are converted to Kigali.
 * For a timezone-naive DATETIME string, the app's convention is UTC.
 */
export const formatKigaliDate = (
  value: string | Date | null | undefined,
): string => {
  if (value == null || value === "") return "";

  if (typeof value === "string") {
    const dateOnly = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
    if (dateOnly) {
      return parseKigaliDisplayDate(
        Number(dateOnly[1]),
        Number(dateOnly[2]),
        Number(dateOnly[3]),
      );
    }
  }

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else {
    const sqlDateTime = /^([0-9]{4}-[0-9]{2}-[0-9]{2})[ ]([0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.([0-9]+))?$/.exec(value);
    const hasExplicitZone = /(?:Z|[+-][0-9]{2}:?[0-9]{2})$/i.test(value);
    const normalized = sqlDateTime && !hasExplicitZone
      ? `${sqlDateTime[1]}T${sqlDateTime[2]}${sqlDateTime[3] ? `.${sqlDateTime[3]}` : ""}Z`
      : value;
    date = new Date(normalized);
  }

  if (Number.isNaN(date.getTime())) return String(value);
  const { year, month, day } = getKigaliDateParts(date);
  return parseKigaliDisplayDate(year, month, day);
};

/** YYYY-MM-DD for a date/instant, interpreted/displayed using Kigali calendar time. */
export const getKigaliDateStringForValue = (
  value: string | Date | null | undefined,
): string => {
  if (value == null || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else {
    const sqlDateTime = /^(\d{4}-\d{2}-\d{2})[ ](\d{2}:\d{2}:\d{2})(?:\.([0-9]+))?$/.exec(value);
    const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    const normalized = sqlDateTime && !hasExplicitZone
      ? `${sqlDateTime[1]}T${sqlDateTime[2]}${sqlDateTime[3] ? `.${sqlDateTime[3]}` : ""}Z`
      : value;
    date = new Date(normalized);
  }
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return getKigaliDateInputValue(date);
};
