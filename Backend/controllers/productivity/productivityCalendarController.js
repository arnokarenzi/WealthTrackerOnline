import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventById,
  getCalendarRange,
  updateCalendarEvent,
} from "../../services/productivity/productivityCalendarService.js";
import {
  isValidCalendarDateRange,
  isValidCalendarId,
  validateCalendarEventInput,
} from "../../utils/productivityCalendarValidation.js";

const sendError = (res, error, operation) => {
  if (error?.code === "ER_NO_SUCH_TABLE") {
    return res.status(503).json({
      error: "Productivity storage is not fully initialized. Apply the Phase 1, Phase 2 and Phase 3 migrations in order, including Backend/migrations/20261104_productivity_calendar_events.sql.",
      code: "PRODUCTIVITY_CALENDAR_MIGRATION_REQUIRED",
    });
  }
  console.error(`${operation} productivity calendar error:`, error);
  return res.status(500).json({ error: `Could not ${operation} productivity calendar data.` });
};

export const getProductivityCalendarController = async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!isValidCalendarDateRange(startDate, endDate)) {
    return res.status(400).json({ error: "Provide valid startDate and endDate values in YYYY-MM-DD format; the range must not exceed 94 days." });
  }
  try {
    return res.json(await getCalendarRange(startDate, endDate));
  } catch (error) {
    return sendError(res, error, "retrieve");
  }
};

export const createProductivityCalendarEventController = async (req, res) => {
  const validation = validateCalendarEventInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const event = await createCalendarEvent(validation.values);
    return res.status(201).json({ message: "Calendar event created successfully.", event });
  } catch (error) {
    return sendError(res, error, "create");
  }
};

export const updateProductivityCalendarEventController = async (req, res) => {
  if (!isValidCalendarId(req.params.id)) return res.status(400).json({ error: "Invalid calendar event ID." });
  const validation = validateCalendarEventInput(req.body, { partial: true });
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  if (!Object.keys(validation.values).length) return res.status(400).json({ error: "Provide at least one supported event field to update." });
  try {
    const existing = await getCalendarEventById(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Calendar event not found." });
    const merged = validateCalendarEventInput({
      title: existing.title,
      description: existing.description,
      eventDate: existing.eventDate,
      startTime: existing.startTime,
      endTime: existing.endTime,
      isAllDay: existing.isAllDay,
      color: existing.color,
      ...validation.values,
    });
    if (merged.errors.length) return res.status(400).json({ error: merged.errors.join(" ") });
    const event = await updateCalendarEvent(Number(req.params.id), validation.values);
    return res.json({ message: "Calendar event updated successfully.", event });
  } catch (error) {
    return sendError(res, error, "update");
  }
};

export const deleteProductivityCalendarEventController = async (req, res) => {
  if (!isValidCalendarId(req.params.id)) return res.status(400).json({ error: "Invalid calendar event ID." });
  try {
    const deleted = await deleteCalendarEvent(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Calendar event not found." });
    return res.json({ message: "Calendar event deleted successfully." });
  } catch (error) {
    return sendError(res, error, "delete");
  }
};
