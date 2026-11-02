import { isValidProductivityDate, isValidProductivityId } from "./productivityValidation.js";

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const validColor = (value) => typeof value === "string" && /^#(?:[0-9a-fA-F]{6})$/.test(value);
const validDateRange = (startDate, endDate, maxDays = 366) => {
  if (!isValidProductivityDate(startDate) || !isValidProductivityDate(endDate)) return false;
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return end >= start && (end - start) / 86400000 < maxDays;
};
const validIsoDateTime = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && isValidProductivityDate(value.slice(0, 10))
  && !Number.isNaN(Date.parse(value));

const HABIT_FIELDS = new Set(["name", "description", "category", "frequency", "daysOfWeek", "color", "status"]);

export const validateHabitInput = (input, { partial = false } = {}) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  Object.keys(input).forEach((key) => { if (!HABIT_FIELDS.has(key)) errors.push(`Unsupported habit field: ${key}.`); });
  const values = {};

  if (!partial || Object.hasOwn(input, "name")) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 120) errors.push("Habit name is required and must be 120 characters or fewer.");
    else values.name = name;
  }
  if (Object.hasOwn(input, "description")) {
    if (input.description !== null && (typeof input.description !== "string" || input.description.length > 5000)) errors.push("Habit description must be text of at most 5,000 characters.");
    else values.description = input.description === null ? null : input.description.trim() || null;
  } else if (!partial) values.description = null;

  if (Object.hasOwn(input, "category")) {
    if (input.category !== null && (typeof input.category !== "string" || input.category.trim().length > 60)) errors.push("Habit category must be text of at most 60 characters or null.");
    else values.category = input.category === null ? null : input.category.trim() || null;
  } else if (!partial) values.category = null;

  if (Object.hasOwn(input, "frequency")) {
    if (!["daily", "selected_days"].includes(input.frequency)) errors.push("Frequency must be daily or selected_days.");
    else values.frequency = input.frequency;
  } else if (!partial) values.frequency = "daily";

  if (Object.hasOwn(input, "daysOfWeek")) {
    if (!Array.isArray(input.daysOfWeek) || input.daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      errors.push("daysOfWeek must be an array of weekday numbers from 0 (Sunday) to 6 (Saturday).");
    } else {
      values.daysOfWeek = [...new Set(input.daysOfWeek)].sort((a, b) => a - b);
    }
  } else if (!partial) values.daysOfWeek = [];

  if (Object.hasOwn(input, "color")) {
    if (!validColor(input.color)) errors.push("Habit color must be a six-digit hexadecimal color such as #1976d2.");
    else values.color = input.color;
  } else if (!partial) values.color = "#1976d2";

  if (Object.hasOwn(input, "status")) {
    if (!["active", "archived"].includes(input.status)) errors.push("Habit status must be active or archived.");
    else values.status = input.status;
  } else if (!partial) values.status = "active";

  const frequency = values.frequency ?? input.frequency;
  const days = values.daysOfWeek ?? input.daysOfWeek;
  if (frequency === "selected_days" && (!Array.isArray(days) || days.length === 0)) {
    errors.push("Select at least one day for a selected-days habit.");
  }
  return { errors, values };
};

export const validateHabitLogInput = (input, { partial = false } = {}) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  const allowed = new Set(["logDate", "isCompleted", "notes"]);
  Object.keys(input).forEach((key) => { if (!allowed.has(key)) errors.push(`Unsupported habit log field: ${key}.`); });
  const values = {};
  if (!partial || Object.hasOwn(input, "logDate")) {
    if (!isValidProductivityDate(input.logDate)) errors.push("logDate must be a valid YYYY-MM-DD date.");
    else values.logDate = input.logDate;
  }
  if (!partial || Object.hasOwn(input, "isCompleted")) {
    if (typeof input.isCompleted !== "boolean") errors.push("isCompleted must be true or false.");
    else values.isCompleted = input.isCompleted;
  }
  if (Object.hasOwn(input, "notes")) {
    if (input.notes !== null && (typeof input.notes !== "string" || input.notes.length > 500)) errors.push("Habit log notes must be text of at most 500 characters or null.");
    else values.notes = input.notes === null ? null : input.notes.trim() || null;
  } else if (!partial) values.notes = null;
  return { errors, values };
};

export const validateFocusSessionInput = (input) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  const allowed = new Set(["sessionType", "status", "taskId", "plannedMinutes", "actualSeconds", "startedAt", "endedAt", "notes"]);
  Object.keys(input).forEach((key) => { if (!allowed.has(key)) errors.push(`Unsupported focus session field: ${key}.`); });
  const values = {};
  if (!["focus", "short_break", "long_break"].includes(input.sessionType)) errors.push("sessionType must be focus, short_break or long_break.");
  else values.sessionType = input.sessionType;
  if (!["completed", "cancelled"].includes(input.status)) errors.push("status must be completed or cancelled.");
  else values.status = input.status;
  if (input.taskId === undefined || input.taskId === null || input.taskId === "") values.taskId = null;
  else if (!isValidProductivityId(input.taskId)) errors.push("taskId must be a positive integer or null.");
  else values.taskId = Number(input.taskId);
  if (!Number.isInteger(Number(input.plannedMinutes)) || Number(input.plannedMinutes) < 1 || Number(input.plannedMinutes) > 240) errors.push("plannedMinutes must be an integer from 1 to 240.");
  else values.plannedMinutes = Number(input.plannedMinutes);
  if (!Number.isInteger(Number(input.actualSeconds)) || Number(input.actualSeconds) < 0 || Number(input.actualSeconds) > 86400) errors.push("actualSeconds must be an integer from 0 to 86,400.");
  else values.actualSeconds = Number(input.actualSeconds);
  if (!validIsoDateTime(input.startedAt)) errors.push("startedAt must be a valid ISO date-time.");
  else values.startedAt = new Date(input.startedAt).toISOString().slice(0, 19).replace("T", " ");
  if (!validIsoDateTime(input.endedAt)) errors.push("endedAt must be a valid ISO date-time.");
  else values.endedAt = new Date(input.endedAt).toISOString().slice(0, 19).replace("T", " ");
  if (input.startedAt && input.endedAt && validIsoDateTime(input.startedAt) && validIsoDateTime(input.endedAt)
      && Date.parse(input.endedAt) < Date.parse(input.startedAt)) errors.push("endedAt must be on or after startedAt.");
  if (Object.hasOwn(input, "notes")) {
    if (input.notes !== null && (typeof input.notes !== "string" || input.notes.length > 500)) errors.push("Focus notes must be text of at most 500 characters or null.");
    else values.notes = input.notes === null ? null : input.notes.trim() || null;
  } else values.notes = null;
  if (values.status === "completed" && values.actualSeconds < 1) errors.push("A completed session must contain at least one actual second.");
  if (Number.isInteger(values.plannedMinutes) && Number.isInteger(values.actualSeconds)
      && values.actualSeconds > values.plannedMinutes * 60) {
    errors.push("actualSeconds cannot exceed the planned session duration.");
  }
  if (values.sessionType && values.sessionType !== "focus" && values.taskId !== null) {
    errors.push("Break sessions cannot be linked to a task.");
  }
  return { errors, values };
};

export const isValidHabitDateRange = (startDate, endDate) => validDateRange(startDate, endDate, 367);
export const isValidFocusDateRange = (startDate, endDate) => validDateRange(startDate, endDate, 32);
export const isValidHabitId = isValidProductivityId;
