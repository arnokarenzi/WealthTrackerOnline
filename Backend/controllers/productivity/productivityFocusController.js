import { createFocusSession, getFocusSummary, listFocusSessions } from "../../services/productivity/productivityFocusService.js";
import { getKigaliDateString } from "../../utils/kigaliTime.js";
import { isValidFocusDateRange, validateFocusSessionInput } from "../../utils/productivityHabitsValidation.js";
import { sendCategoryPushNotification } from "../../services/appPushNotificationService.js";

const addDays = (date, amount) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "")
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const sendError = (res, error, operation) => {
  if (error?.code === "ER_NO_SUCH_TABLE") {
    return res.status(503).json({ error: "Focus session storage is not initialized. Apply Backend/migrations/20261105_productivity_habits_focus.sql.", code: "PRODUCTIVITY_HABITS_FOCUS_MIGRATION_REQUIRED" });
  }
  if (error?.code === "PRODUCTIVITY_TASK_NOT_FOUND") return res.status(404).json({ error: error.message });
  console.error(`${operation} productivity focus error:`, error);
  return res.status(500).json({ error: `Could not ${operation} focus session data.` });
};

export const listProductivityFocusSessionsController = async (req, res) => {
  const endDate = req.query.endDate || getKigaliDateString();
  const startDate = req.query.startDate || addDays(endDate, -13);
  if (!isValidFocusDateRange(startDate, endDate)) return res.status(400).json({ error: "Provide valid startDate and endDate values in YYYY-MM-DD format; the range must not exceed 31 days." });
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ error: "limit must be an integer from 1 to 100." });
  try {
    return res.json({ startDate, endDate, sessions: await listFocusSessions({ startDate, endDate, limit }) });
  } catch (error) {
    return sendError(res, error, "retrieve");
  }
};

export const getProductivityFocusSummaryController = async (req, res) => {
  const date = req.query.date || getKigaliDateString();
  if (!validDate(date)) return res.status(400).json({ error: "date must be a valid YYYY-MM-DD date." });
  try {
    return res.json(await getFocusSummary(date));
  } catch (error) {
    return sendError(res, error, "retrieve summary");
  }
};

export const createProductivityFocusSessionController = async (req, res) => {
  const validation = validateFocusSessionInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const session = await createFocusSession(validation.values);
    if (session.status === "completed") {
      try {
        const duration = Math.max(1, Math.round(Number(session.actualSeconds || 0) / 60));
        await sendCategoryPushNotification({
          category: "focusTimer",
          eventKey: `focus-session-completed-${session.id}`,
          title: session.sessionType === "focus" ? "Focus session complete" : "Break complete",
          body: `${duration} minute${duration === 1 ? "" : "s"} ${session.sessionType === "focus" ? "of focus time" : "break time"} saved in FinTrack.`,
          route: "/productivity/focus",
          ttl: 60 * 60,
        });
      } catch (pushError) {
        console.error("Focus session push failed:", pushError?.message || pushError);
      }
    }
    return res.status(201).json({ message: "Focus session saved successfully.", session });
  } catch (error) {
    return sendError(res, error, "save");
  }
};
