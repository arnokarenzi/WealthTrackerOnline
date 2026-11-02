const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

export const isValidReviewDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const normalizeText = (input, key, maxLength, errors) => {
  if (!Object.hasOwn(input, key) || input[key] === null) return "";
  if (typeof input[key] !== "string") {
    errors.push(`${key} must be text.`);
    return "";
  }
  const value = input[key].trim();
  if (value.length > maxLength) errors.push(`${key} must be ${maxLength} characters or fewer.`);
  return value;
};

const normalizeRating = (input, key, errors) => {
  if (!Object.hasOwn(input, key) || input[key] === null || input[key] === "") return null;
  const value = Number(input[key]);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    errors.push(`${key} must be an integer from 1 to 5 or null.`);
    return null;
  }
  return value;
};

const DAILY_TEXT_FIELDS = Object.freeze({
  wins: 4000,
  challenges: 4000,
  lessons: 4000,
  gratitude: 4000,
  tomorrowPriorities: 4000,
  notes: 6000,
});

const WEEKLY_TEXT_FIELDS = Object.freeze({
  wins: 6000,
  challenges: 6000,
  lessons: 6000,
  nextWeekPriorities: 6000,
  notes: 8000,
});

export const validateDailyReviewInput = (input) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  const allowed = new Set(["reviewDate", "moodRating", "energyRating", ...Object.keys(DAILY_TEXT_FIELDS)]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) errors.push(`Unsupported daily review field: ${key}.`);
  if (!isValidReviewDate(input.reviewDate)) errors.push("reviewDate must be a valid YYYY-MM-DD date.");
  const values = { reviewDate: input.reviewDate };
  values.moodRating = normalizeRating(input, "moodRating", errors);
  values.energyRating = normalizeRating(input, "energyRating", errors);
  for (const [key, maxLength] of Object.entries(DAILY_TEXT_FIELDS)) values[key] = normalizeText(input, key, maxLength, errors);
  return { errors, values };
};

export const validateWeeklyReviewInput = (input) => {
  const errors = [];
  if (!isRecord(input)) return { errors: ["Request body must be a JSON object."], values: {} };
  const allowed = new Set(["weekStart", "overallRating", ...Object.keys(WEEKLY_TEXT_FIELDS)]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) errors.push(`Unsupported weekly review field: ${key}.`);
  if (!isValidReviewDate(input.weekStart)) errors.push("weekStart must be a valid YYYY-MM-DD date.");
  const values = { weekStart: input.weekStart };
  values.overallRating = normalizeRating(input, "overallRating", errors);
  for (const [key, maxLength] of Object.entries(WEEKLY_TEXT_FIELDS)) values[key] = normalizeText(input, key, maxLength, errors);
  return { errors, values };
};

export const getReviewWeekEnd = (weekStart) => {
  if (!isValidReviewDate(weekStart)) return null;
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
};

export const isValidInsightsRange = (startDate, endDate, maxDays = 92) => {
  if (!isValidReviewDate(startDate) || !isValidReviewDate(endDate)) return false;
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  const span = Math.floor((end - start) / 86400000) + 1;
  return span >= 1 && span <= maxDays;
};
