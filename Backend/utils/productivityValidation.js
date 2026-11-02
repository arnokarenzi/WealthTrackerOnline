const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const validTime = (value) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);

const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const validColor = (value) => typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

const TASK_FIELDS = new Set([
  "title", "description", "projectId", "status", "priority", "dueDate", "dueTime",
  "scheduledDate", "scheduledStartTime", "estimatedMinutes", "isImportant", "isUrgent", "sortOrder",
]);

const PROJECT_FIELDS = new Set(["name", "description", "color", "status", "targetDate"]);

export const validateTaskInput = (input, { partial = false } = {}) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };

  for (const key of Object.keys(input)) {
    if (!TASK_FIELDS.has(key)) errors.push(`Unsupported task field: ${key}.`);
  }

  const values = {};
  if (!partial || Object.hasOwn(input, "title")) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title || title.length > 200) errors.push("Task title is required and must be 200 characters or fewer.");
    else values.title = title;
  }

  const textFields = ["description"];
  for (const field of textFields) {
    if (Object.hasOwn(input, field)) {
      const value = input[field];
      if (value !== null && (typeof value !== "string" || value.length > 10000)) {
        errors.push("Task description must be text with at most 10,000 characters.");
      } else {
        values[field] = value === null ? null : value.trim() || null;
      }
    }
  }

  if (Object.hasOwn(input, "projectId")) {
    if (input.projectId === null || input.projectId === "") values.projectId = null;
    else if (!validId(input.projectId)) errors.push("Project ID must be a positive integer.");
    else values.projectId = Number(input.projectId);
  } else if (!partial) values.projectId = null;

  if (Object.hasOwn(input, "status")) {
    if (!["todo", "in_progress", "completed", "cancelled"].includes(input.status)) errors.push("Invalid task status.");
    else values.status = input.status;
  } else if (!partial) values.status = "todo";

  if (Object.hasOwn(input, "priority")) {
    if (!["none", "low", "medium", "high"].includes(input.priority)) errors.push("Invalid task priority.");
    else values.priority = input.priority;
  } else if (!partial) values.priority = "medium";

  for (const [field, column] of [["dueDate", "dueDate"], ["scheduledDate", "scheduledDate"]]) {
    if (Object.hasOwn(input, field)) {
      const value = input[field];
      if (value !== null && value !== "" && !validDate(value)) errors.push(`${field} must be a valid YYYY-MM-DD date or null.`);
      else values[column] = value || null;
    } else if (!partial) values[column] = null;
  }

  for (const field of ["dueTime", "scheduledStartTime"]) {
    if (Object.hasOwn(input, field)) {
      const value = input[field];
      if (value !== null && value !== "" && !validTime(value)) errors.push(`${field} must use HH:MM or HH:MM:SS format, or null.`);
      else values[field] = value || null;
    } else if (!partial) values[field] = null;
  }

  if (Object.hasOwn(input, "estimatedMinutes")) {
    const value = input.estimatedMinutes;
    if (value !== null && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 1440)) {
      errors.push("Estimated minutes must be an integer from 1 to 1440, or null.");
    } else values.estimatedMinutes = value === null ? null : Number(value);
  } else if (!partial) values.estimatedMinutes = null;

  for (const field of ["isImportant", "isUrgent"]) {
    if (Object.hasOwn(input, field)) {
      if (typeof input[field] !== "boolean") errors.push(`${field} must be true or false.`);
      else values[field] = input[field];
    } else if (!partial) values[field] = false;
  }

  if (Object.hasOwn(input, "sortOrder")) {
    if (!Number.isInteger(Number(input.sortOrder)) || Math.abs(Number(input.sortOrder)) > 1000000) errors.push("sortOrder must be a valid integer.");
    else values.sortOrder = Number(input.sortOrder);
  } else if (!partial) values.sortOrder = 0;

  return { errors, values };
};

export const validateProjectInput = (input, { partial = false } = {}) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  for (const key of Object.keys(input)) {
    if (!PROJECT_FIELDS.has(key)) errors.push(`Unsupported project field: ${key}.`);
  }

  const values = {};
  if (!partial || Object.hasOwn(input, "name")) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 120) errors.push("Project name is required and must be 120 characters or fewer.");
    else values.name = name;
  }

  if (Object.hasOwn(input, "description")) {
    const value = input.description;
    if (value !== null && (typeof value !== "string" || value.length > 10000)) errors.push("Project description must be text with at most 10,000 characters.");
    else values.description = value === null ? null : value.trim() || null;
  } else if (!partial) values.description = null;

  if (Object.hasOwn(input, "color")) {
    if (!validColor(input.color)) errors.push("Project color must be a hexadecimal color such as #1976d2.");
    else values.color = input.color;
  } else if (!partial) values.color = "#1976d2";

  if (Object.hasOwn(input, "status")) {
    if (!["active", "completed", "archived"].includes(input.status)) errors.push("Invalid project status.");
    else values.status = input.status;
  } else if (!partial) values.status = "active";

  if (Object.hasOwn(input, "targetDate")) {
    if (input.targetDate !== null && input.targetDate !== "" && !validDate(input.targetDate)) errors.push("targetDate must be a valid YYYY-MM-DD date or null.");
    else values.targetDate = input.targetDate || null;
  } else if (!partial) values.targetDate = null;

  return { errors, values };
};

export const validateSubtaskInput = (input, { partial = false } = {}) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  for (const key of Object.keys(input)) {
    if (!["title", "isCompleted", "sortOrder"].includes(key)) errors.push(`Unsupported subtask field: ${key}.`);
  }
  const values = {};
  if (!partial || Object.hasOwn(input, "title")) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title || title.length > 200) errors.push("Subtask title is required and must be 200 characters or fewer.");
    else values.title = title;
  }
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

export const isValidProductivityDate = validDate;
export const isValidProductivityId = validId;
