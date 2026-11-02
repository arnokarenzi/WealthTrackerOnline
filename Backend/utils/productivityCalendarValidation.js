const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const validTime = (value) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);

const validColor = (value) =>
  typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

const EVENT_FIELDS = new Set([
  "title", "description", "eventDate", "startTime", "endTime", "isAllDay", "color",
]);

const timeSeconds = (value) => {
  if (!value) return null;
  const [hours, minutes, seconds = 0] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

export const validateCalendarEventInput = (input, { partial = false } = {}) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };

  for (const key of Object.keys(input)) {
    if (!EVENT_FIELDS.has(key)) errors.push(`Unsupported calendar event field: ${key}.`);
  }

  const values = {};

  if (!partial || Object.hasOwn(input, "title")) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title || title.length > 200) errors.push("Event title is required and must be 200 characters or fewer.");
    else values.title = title;
  }

  if (!partial || Object.hasOwn(input, "eventDate")) {
    if (!validDate(input.eventDate)) errors.push("eventDate must be a valid YYYY-MM-DD date.");
    else values.eventDate = input.eventDate;
  }

  if (Object.hasOwn(input, "description")) {
    const value = input.description;
    if (value !== null && (typeof value !== "string" || value.length > 10000)) {
      errors.push("Event description must be text with at most 10,000 characters.");
    } else {
      values.description = value === null ? null : value.trim() || null;
    }
  } else if (!partial) values.description = null;

  for (const field of ["startTime", "endTime"]) {
    if (Object.hasOwn(input, field)) {
      const value = input[field];
      if (value !== null && value !== "" && !validTime(value)) {
        errors.push(`${field} must use HH:MM or HH:MM:SS format, or be null.`);
      } else {
        values[field] = value || null;
      }
    } else if (!partial) values[field] = null;
  }

  if (Object.hasOwn(input, "isAllDay")) {
    if (typeof input.isAllDay !== "boolean") errors.push("isAllDay must be true or false.");
    else values.isAllDay = input.isAllDay;
  } else if (!partial) values.isAllDay = false;

  if (Object.hasOwn(input, "color")) {
    if (!validColor(input.color)) errors.push("Event color must be a hexadecimal color such as #1976d2.");
    else values.color = input.color;
  } else if (!partial) values.color = "#1976d2";

  const nextStart = Object.hasOwn(values, "startTime") ? values.startTime : input.startTime;
  const nextEnd = Object.hasOwn(values, "endTime") ? values.endTime : input.endTime;
  if (nextStart && nextEnd && timeSeconds(nextEnd) <= timeSeconds(nextStart)) {
    errors.push("Event end time must be later than its start time.");
  }
  if (values.isAllDay === true) {
    values.startTime = null;
    values.endTime = null;
  }

  return { errors, values };
};

export const isValidCalendarDateRange = (startDate, endDate, maxDays = 93) => {
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) return false;
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return (end - start) / 86400000 <= maxDays;
};

export const isValidCalendarId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
