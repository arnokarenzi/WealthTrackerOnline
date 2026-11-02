const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const validColor = (value) => typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
const nullableText = (value, maxLength, field, errors) => {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > maxLength) {
    errors.push(`${field} must be text with at most ${maxLength} characters.`);
    return undefined;
  }
  return value.trim() || null;
};

const rejectUnknownFields = (input, supported, errors) => {
  for (const key of Object.keys(input)) {
    if (!supported.has(key)) errors.push(`Unsupported field: ${key}.`);
  }
};

const GOAL_FIELDS = new Set(["name", "description", "category", "status", "startDate", "targetDate", "progressMode", "manualProgress"]);
export const validateGoalInput = (input, { partial = false } = {}) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  rejectUnknownFields(input, GOAL_FIELDS, errors);
  const values = {};

  if (!partial || Object.hasOwn(input, "name")) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 150) errors.push("Goal name is required and must be 150 characters or fewer.");
    else values.name = name;
  }

  for (const [field, max] of [["description", 10000], ["category", 60]]) {
    if (Object.hasOwn(input, field)) {
      const value = nullableText(input[field], max, field, errors);
      if (value !== undefined) values[field] = value;
    } else if (!partial && field === "description") values.description = null;
    else if (!partial && field === "category") values.category = null;
  }

  for (const field of ["startDate", "targetDate"]) {
    if (Object.hasOwn(input, field)) {
      const value = input[field];
      if (value === null || value === "") values[field] = null;
      else if (!validDate(value)) errors.push(`${field} must be a valid YYYY-MM-DD date or null.`);
      else values[field] = value;
    } else if (!partial) values[field] = null;
  }

  if (Object.hasOwn(input, "status")) {
    if (!["active", "completed", "archived"].includes(input.status)) errors.push("Invalid goal status.");
    else values.status = input.status;
  } else if (!partial) values.status = "active";

  if (Object.hasOwn(input, "progressMode")) {
    if (!["milestones", "manual"].includes(input.progressMode)) errors.push("progressMode must be milestones or manual.");
    else values.progressMode = input.progressMode;
  } else if (!partial) values.progressMode = "milestones";

  if (Object.hasOwn(input, "manualProgress")) {
    const value = Number(input.manualProgress);
    if (!Number.isInteger(value) || value < 0 || value > 100) errors.push("manualProgress must be a whole number from 0 to 100.");
    else values.manualProgress = value;
  } else if (!partial) values.manualProgress = 0;

  const startDate = Object.hasOwn(values, "startDate") ? values.startDate : input.startDate;
  const targetDate = Object.hasOwn(values, "targetDate") ? values.targetDate : input.targetDate;
  if (startDate && targetDate && targetDate < startDate) errors.push("targetDate cannot be earlier than startDate.");

  return { errors, values };
};

const MILESTONE_FIELDS = new Set(["title", "description", "dueDate", "isCompleted", "sortOrder"]);
export const validateMilestoneInput = (input, { partial = false } = {}) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  rejectUnknownFields(input, MILESTONE_FIELDS, errors);
  const values = {};
  if (!partial || Object.hasOwn(input, "title")) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title || title.length > 200) errors.push("Milestone title is required and must be 200 characters or fewer.");
    else values.title = title;
  }
  if (Object.hasOwn(input, "description")) {
    const value = nullableText(input.description, 10000, "description", errors);
    if (value !== undefined) values.description = value;
  } else if (!partial) values.description = null;
  if (Object.hasOwn(input, "dueDate")) {
    if (input.dueDate === null || input.dueDate === "") values.dueDate = null;
    else if (!validDate(input.dueDate)) errors.push("dueDate must be a valid YYYY-MM-DD date or null.");
    else values.dueDate = input.dueDate;
  } else if (!partial) values.dueDate = null;
  if (Object.hasOwn(input, "isCompleted")) {
    if (typeof input.isCompleted !== "boolean") errors.push("isCompleted must be true or false.");
    else values.isCompleted = input.isCompleted;
  } else if (!partial) values.isCompleted = false;
  if (Object.hasOwn(input, "sortOrder")) {
    if (!Number.isInteger(Number(input.sortOrder))) errors.push("sortOrder must be an integer.");
    else values.sortOrder = Number(input.sortOrder);
  } else if (!partial) values.sortOrder = 0;
  return { errors, values };
};

const NOTE_FIELDS = new Set(["title", "content", "category", "color", "isPinned", "status"]);
export const validateNoteInput = (input, { partial = false } = {}) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  rejectUnknownFields(input, NOTE_FIELDS, errors);
  const values = {};
  if (Object.hasOwn(input, "title")) {
    const value = nullableText(input.title, 200, "title", errors);
    if (value !== undefined) values.title = value;
  } else if (!partial) values.title = null;
  if (!partial || Object.hasOwn(input, "content")) {
    if (typeof input.content !== "string" || input.content.trim().length === 0 || input.content.length > 100000) {
      errors.push("Note content is required and must contain at most 100,000 characters.");
    } else values.content = input.content.trim();
  }
  if (Object.hasOwn(input, "category")) {
    const value = nullableText(input.category, 60, "category", errors);
    if (value !== undefined) values.category = value;
  } else if (!partial) values.category = null;
  if (Object.hasOwn(input, "color")) {
    if (!validColor(input.color)) errors.push("color must be a hexadecimal colour such as #fff4cc.");
    else values.color = input.color;
  } else if (!partial) values.color = "#fff4cc";
  if (Object.hasOwn(input, "isPinned")) {
    if (typeof input.isPinned !== "boolean") errors.push("isPinned must be true or false.");
    else values.isPinned = input.isPinned;
  } else if (!partial) values.isPinned = false;
  if (Object.hasOwn(input, "status")) {
    if (!["active", "archived"].includes(input.status)) errors.push("Invalid note status.");
    else values.status = input.status;
  } else if (!partial) values.status = "active";
  return { errors, values };
};

const COUNTDOWN_FIELDS = new Set(["title", "description", "eventDate", "eventTime", "category", "color", "recurrence", "status"]);
export const validateCountdownInput = (input, { partial = false } = {}) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  rejectUnknownFields(input, COUNTDOWN_FIELDS, errors);
  const values = {};
  if (!partial || Object.hasOwn(input, "title")) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title || title.length > 150) errors.push("Countdown title is required and must be 150 characters or fewer.");
    else values.title = title;
  }
  if (Object.hasOwn(input, "description")) {
    const value = nullableText(input.description, 10000, "description", errors);
    if (value !== undefined) values.description = value;
  } else if (!partial) values.description = null;
  if (!partial || Object.hasOwn(input, "eventDate")) {
    if (!validDate(input.eventDate)) errors.push("eventDate must be a valid YYYY-MM-DD date.");
    else values.eventDate = input.eventDate;
  }
  if (Object.hasOwn(input, "eventTime")) {
    if (input.eventTime === null || input.eventTime === "") values.eventTime = null;
    else if (!validTime(input.eventTime)) errors.push("eventTime must use HH:MM or HH:MM:SS format, or null.");
    else values.eventTime = input.eventTime;
  } else if (!partial) values.eventTime = null;
  if (Object.hasOwn(input, "category")) {
    const value = nullableText(input.category, 60, "category", errors);
    if (value !== undefined) values.category = value;
  } else if (!partial) values.category = null;
  if (Object.hasOwn(input, "color")) {
    if (!validColor(input.color)) errors.push("color must be a hexadecimal colour such as #1976d2.");
    else values.color = input.color;
  } else if (!partial) values.color = "#1976d2";
  if (Object.hasOwn(input, "recurrence")) {
    if (!["none", "yearly"].includes(input.recurrence)) errors.push("recurrence must be none or yearly.");
    else values.recurrence = input.recurrence;
  } else if (!partial) values.recurrence = "none";
  if (Object.hasOwn(input, "status")) {
    if (!["active", "archived"].includes(input.status)) errors.push("Invalid countdown status.");
    else values.status = input.status;
  } else if (!partial) values.status = "active";
  return { errors, values };
};

export const isValidPlanningId = validId;
export const isValidPlanningDate = validDate;
