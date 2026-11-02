import {
  getDailyReview,
  getWeeklyReview,
  listDailyReviewHistory,
  listWeeklyReviewHistory,
  saveDailyReview,
  saveWeeklyReview,
} from "../../services/productivity/productivityReviewsService.js";
import { getKigaliDateString } from "../../utils/kigaliTime.js";
import {
  getReviewWeekEnd,
  isValidReviewDate,
  validateDailyReviewInput,
  validateWeeklyReviewInput,
} from "../../utils/productivityReviewsValidation.js";

const sendError = (res, error, operation) => {
  if (error?.code === "ER_NO_SUCH_TABLE") {
    return res.status(503).json({
      error: "Daily and weekly review storage is not initialized. Apply Backend/migrations/20261107_productivity_reviews_insights.sql.",
      code: "PRODUCTIVITY_REVIEWS_MIGRATION_REQUIRED",
    });
  }
  console.error(`${operation} productivity review error:`, error);
  return res.status(500).json({ error: `Could not ${operation} productivity review data.` });
};

const parseLimit = (value, fallback, maximum) => {
  if (value === undefined) return fallback;
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 1 && limit <= maximum ? limit : null;
};

export const getProductivityDailyReviewController = async (req, res) => {
  const date = req.query.date || getKigaliDateString();
  if (!isValidReviewDate(date)) return res.status(400).json({ error: "date must be a valid YYYY-MM-DD date." });
  try {
    return res.json({ reviewDate: date, review: await getDailyReview(date) });
  } catch (error) { return sendError(res, error, "retrieve daily"); }
};

export const saveProductivityDailyReviewController = async (req, res) => {
  const validation = validateDailyReviewInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const review = await saveDailyReview(validation.values);
    return res.json({ message: "Daily review saved successfully.", review });
  } catch (error) { return sendError(res, error, "save daily"); }
};

export const listProductivityDailyReviewHistoryController = async (req, res) => {
  const limit = parseLimit(req.query.limit, 30, 90);
  if (limit === null) return res.status(400).json({ error: "limit must be an integer from 1 to 90." });
  try {
    return res.json({ reviews: await listDailyReviewHistory(limit) });
  } catch (error) { return sendError(res, error, "retrieve daily history"); }
};

export const getProductivityWeeklyReviewController = async (req, res) => {
  const weekStart = req.query.weekStart;
  if (!isValidReviewDate(weekStart)) return res.status(400).json({ error: "weekStart must be a valid YYYY-MM-DD date." });
  try {
    return res.json({ weekStart, weekEnd: getReviewWeekEnd(weekStart), review: await getWeeklyReview(weekStart) });
  } catch (error) { return sendError(res, error, "retrieve weekly"); }
};

export const saveProductivityWeeklyReviewController = async (req, res) => {
  const validation = validateWeeklyReviewInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const review = await saveWeeklyReview(validation.values);
    return res.json({ message: "Weekly review saved successfully.", review });
  } catch (error) { return sendError(res, error, "save weekly"); }
};

export const listProductivityWeeklyReviewHistoryController = async (req, res) => {
  const limit = parseLimit(req.query.limit, 20, 60);
  if (limit === null) return res.status(400).json({ error: "limit must be an integer from 1 to 60." });
  try {
    return res.json({ reviews: await listWeeklyReviewHistory(limit) });
  } catch (error) { return sendError(res, error, "retrieve weekly history"); }
};
