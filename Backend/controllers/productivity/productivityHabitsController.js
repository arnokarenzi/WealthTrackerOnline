import {
  archiveHabit, createHabit, deleteHabitLog, getHabitById, listHabitLogs,
  listHabits, saveHabitLog, updateHabit,
} from "../../services/productivity/productivityHabitsService.js";
import { getKigaliDateString } from "../../utils/kigaliTime.js";
import { isValidHabitDateRange, isValidHabitId, validateHabitInput, validateHabitLogInput } from "../../utils/productivityHabitsValidation.js";

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
    return res.status(503).json({ error: "Habit and focus storage is not initialized. Apply Backend/migrations/20261105_productivity_habits_focus.sql.", code: "PRODUCTIVITY_HABITS_FOCUS_MIGRATION_REQUIRED" });
  }
  if (error?.code === "PRODUCTIVITY_HABIT_ARCHIVED") return res.status(409).json({ error: error.message });
  console.error(`${operation} productivity habit error:`, error);
  return res.status(500).json({ error: `Could not ${operation} productivity habit data.` });
};

export const listProductivityHabitsController = async (req, res) => {
  try {
    return res.json({ habits: await listHabits({ includeArchived: req.query.includeArchived === "true" }) });
  } catch (error) {
    return sendError(res, error, "retrieve");
  }
};

export const createProductivityHabitController = async (req, res) => {
  const validation = validateHabitInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const habit = await createHabit(validation.values);
    return res.status(201).json({ message: "Habit created successfully.", habit });
  } catch (error) {
    return sendError(res, error, "create");
  }
};

export const updateProductivityHabitController = async (req, res) => {
  if (!isValidHabitId(req.params.id)) return res.status(400).json({ error: "Invalid habit ID." });
  const validation = validateHabitInput(req.body, { partial: true });
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  if (!Object.keys(validation.values).length) return res.status(400).json({ error: "Provide at least one supported habit field to update." });
  try {
    const existing = await getHabitById(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Habit not found." });
    const merged = validateHabitInput({
      name: existing.name, description: existing.description, category: existing.category,
      frequency: existing.frequency, daysOfWeek: existing.daysOfWeek, color: existing.color,
      status: existing.status, ...validation.values,
    });
    if (merged.errors.length) return res.status(400).json({ error: merged.errors.join(" ") });
    const habit = await updateHabit(Number(req.params.id), validation.values);
    return res.json({ message: "Habit updated successfully.", habit });
  } catch (error) {
    return sendError(res, error, "update");
  }
};

export const archiveProductivityHabitController = async (req, res) => {
  if (!isValidHabitId(req.params.id)) return res.status(400).json({ error: "Invalid habit ID." });
  try {
    const archived = await archiveHabit(Number(req.params.id));
    if (!archived) return res.status(404).json({ error: "Active habit not found." });
    return res.json({ message: "Habit archived. Its completion history has been preserved." });
  } catch (error) {
    return sendError(res, error, "archive");
  }
};

export const listProductivityHabitLogsController = async (req, res) => {
  if (!isValidHabitId(req.params.id)) return res.status(400).json({ error: "Invalid habit ID." });
  const endDate = req.query.endDate || getKigaliDateString();
  const startDate = req.query.startDate || addDays(endDate, -89);
  if (!isValidHabitDateRange(startDate, endDate)) return res.status(400).json({ error: "Provide valid startDate and endDate values in YYYY-MM-DD format; the range must not exceed 366 days." });
  try {
    const logs = await listHabitLogs(Number(req.params.id), startDate, endDate);
    if (logs === null) return res.status(404).json({ error: "Habit not found." });
    return res.json({ habitId: Number(req.params.id), startDate, endDate, logs });
  } catch (error) {
    return sendError(res, error, "retrieve");
  }
};

export const saveProductivityHabitLogController = async (req, res) => {
  if (!isValidHabitId(req.params.id)) return res.status(400).json({ error: "Invalid habit ID." });
  const validation = validateHabitLogInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const log = await saveHabitLog(Number(req.params.id), validation.values);
    if (!log) return res.status(404).json({ error: "Habit not found." });
    return res.json({ message: "Habit log saved successfully.", log });
  } catch (error) {
    return sendError(res, error, "save");
  }
};

export const deleteProductivityHabitLogController = async (req, res) => {
  if (!isValidHabitId(req.params.id)) return res.status(400).json({ error: "Invalid habit ID." });
  if (!validDate(req.params.date)) return res.status(400).json({ error: "Log date must be a valid YYYY-MM-DD date." });
  try {
    const habit = await getHabitById(Number(req.params.id));
    if (!habit) return res.status(404).json({ error: "Habit not found." });
    const deleted = await deleteHabitLog(Number(req.params.id), req.params.date);
    if (!deleted) return res.status(404).json({ error: "Habit log not found." });
    return res.json({ message: "Habit completion log removed." });
  } catch (error) {
    return sendError(res, error, "delete");
  }
};
