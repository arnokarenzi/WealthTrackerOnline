import { getProductivityInsights } from "../../services/productivity/productivityInsightsService.js";
import { getKigaliDateString } from "../../utils/kigaliTime.js";
import { isValidInsightsRange, isValidReviewDate } from "../../utils/productivityReviewsValidation.js";

const shiftDate = (dateString, offset) => {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const getProductivityInsightsController = async (req, res) => {
  const endDate = req.query.endDate || getKigaliDateString();
  if (!isValidReviewDate(endDate)) {
    return res.status(400).json({ error: "endDate must be a valid YYYY-MM-DD date." });
  }
  const startDate = req.query.startDate || shiftDate(endDate, -29);
  if (!isValidInsightsRange(startDate, endDate, 92)) {
    return res.status(400).json({ error: "Provide valid startDate and endDate values in YYYY-MM-DD format. The range must be 1 to 92 days, and startDate cannot be after endDate." });
  }
  try {
    return res.json(await getProductivityInsights(startDate, endDate));
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return res.status(503).json({
        error: "Productivity storage is not fully initialized. Apply all productivity migrations through Backend/migrations/20261107_productivity_reviews_insights.sql.",
        code: "PRODUCTIVITY_INSIGHTS_MIGRATION_REQUIRED",
      });
    }
    console.error("Retrieve productivity insights error:", error);
    return res.status(500).json({ error: "Could not calculate productivity insights." });
  }
};
