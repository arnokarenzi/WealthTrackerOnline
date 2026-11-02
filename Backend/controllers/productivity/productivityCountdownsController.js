import { archiveCountdown, createCountdown, getCountdownById, listCountdowns, updateCountdown } from "../../services/productivity/productivityCountdownsService.js";
import { isValidPlanningId, validateCountdownInput } from "../../utils/productivityPlanningValidation.js";

const sendError = (res, error, operation) => {
  if (error?.code === "ER_NO_SUCH_TABLE") return res.status(503).json({
    error: "Countdown storage is not initialized. Apply Backend/migrations/20261106_productivity_goals_notes_countdowns.sql.",
    code: "PRODUCTIVITY_COUNTDOWNS_MIGRATION_REQUIRED",
  });
  console.error(`${operation} productivity countdown error:`, error);
  return res.status(500).json({ error: `Could not ${operation} productivity countdowns.` });
};

export const listProductivityCountdownsController = async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search.length > 100) return res.status(400).json({ error: "Search text must be 100 characters or fewer." });
  try {
    return res.json({ countdowns: await listCountdowns({ includeArchived: req.query.includeArchived === "true", search }) });
  } catch (error) { return sendError(res, error, "retrieve"); }
};

export const createProductivityCountdownController = async (req, res) => {
  const validation = validateCountdownInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const countdown = await createCountdown(validation.values);
    return res.status(201).json({ message: "Countdown created successfully.", countdown });
  } catch (error) { return sendError(res, error, "create"); }
};

export const updateProductivityCountdownController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid countdown ID." });
  const validation = validateCountdownInput(req.body, { partial: true });
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  if (!Object.keys(validation.values).length) return res.status(400).json({ error: "Provide at least one supported countdown field to update." });
  try {
    if (!await getCountdownById(Number(req.params.id))) return res.status(404).json({ error: "Countdown not found." });
    const countdown = await updateCountdown(Number(req.params.id), validation.values);
    return res.json({ message: "Countdown updated successfully.", countdown });
  } catch (error) { return sendError(res, error, "update"); }
};

export const archiveProductivityCountdownController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid countdown ID." });
  try {
    const archived = await archiveCountdown(Number(req.params.id));
    if (!archived) return res.status(404).json({ error: "Countdown not found or already archived." });
    return res.json({ message: "Countdown archived successfully." });
  } catch (error) { return sendError(res, error, "archive"); }
};
