import {
  archiveGoal, createGoal, createGoalMilestone, deleteGoalMilestone, getGoalById,
  getMilestoneById, listGoalMilestones, listGoals, updateGoal, updateGoalMilestone,
} from "../../services/productivity/productivityGoalsService.js";
import { isValidPlanningDate, isValidPlanningId, validateGoalInput, validateMilestoneInput } from "../../utils/productivityPlanningValidation.js";

const sendError = (res, error, operation) => {
  if (error?.code === "ER_NO_SUCH_TABLE") return res.status(503).json({
    error: "Goals and milestone storage is not initialized. Apply Backend/migrations/20261106_productivity_goals_notes_countdowns.sql.",
    code: "PRODUCTIVITY_GOALS_MIGRATION_REQUIRED",
  });
  console.error(`${operation} productivity goal error:`, error);
  return res.status(500).json({ error: `Could not ${operation} productivity goal data.` });
};

export const listProductivityGoalsController = async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search.length > 100) return res.status(400).json({ error: "Search text must be 100 characters or fewer." });
  try {
    const goals = await listGoals({ includeArchived: req.query.includeArchived === "true", search });
    return res.json({ goals });
  } catch (error) { return sendError(res, error, "retrieve"); }
};

export const getProductivityGoalController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid goal ID." });
  try {
    const goal = await getGoalById(Number(req.params.id));
    if (!goal) return res.status(404).json({ error: "Goal not found." });
    const milestones = await listGoalMilestones(goal.id);
    return res.json({ goal: { ...goal, milestones } });
  } catch (error) { return sendError(res, error, "retrieve"); }
};

export const createProductivityGoalController = async (req, res) => {
  const validation = validateGoalInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const goal = await createGoal(validation.values);
    return res.status(201).json({ message: "Goal created successfully.", goal });
  } catch (error) { return sendError(res, error, "create"); }
};

export const updateProductivityGoalController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid goal ID." });
  const validation = validateGoalInput(req.body, { partial: true });
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  if (!Object.keys(validation.values).length) return res.status(400).json({ error: "Provide at least one supported goal field to update." });
  try {
    const existing = await getGoalById(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Goal not found." });
    const startDate = Object.hasOwn(validation.values, "startDate") ? validation.values.startDate : existing.startDate;
    const targetDate = Object.hasOwn(validation.values, "targetDate") ? validation.values.targetDate : existing.targetDate;
    if (startDate && targetDate && targetDate < startDate) return res.status(400).json({ error: "targetDate cannot be earlier than startDate." });
    const goal = await updateGoal(existing.id, validation.values);
    return res.json({ message: "Goal updated successfully.", goal });
  } catch (error) { return sendError(res, error, "update"); }
};

export const archiveProductivityGoalController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid goal ID." });
  try {
    const archived = await archiveGoal(Number(req.params.id));
    if (!archived) return res.status(404).json({ error: "Goal not found or already archived." });
    return res.json({ message: "Goal archived. Its milestones have been retained." });
  } catch (error) { return sendError(res, error, "archive"); }
};

export const listProductivityMilestonesController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid goal ID." });
  try {
    const goal = await getGoalById(Number(req.params.id));
    if (!goal) return res.status(404).json({ error: "Goal not found." });
    return res.json({ milestones: await listGoalMilestones(goal.id) });
  } catch (error) { return sendError(res, error, "retrieve milestone"); }
};

export const createProductivityMilestoneController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid goal ID." });
  const validation = validateMilestoneInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const milestone = await createGoalMilestone(Number(req.params.id), validation.values);
    if (!milestone) return res.status(404).json({ error: "Goal not found or not active." });
    return res.status(201).json({ message: "Milestone created successfully.", milestone });
  } catch (error) { return sendError(res, error, "create milestone"); }
};

export const updateProductivityMilestoneController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid milestone ID." });
  const validation = validateMilestoneInput(req.body, { partial: true });
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  if (!Object.keys(validation.values).length) return res.status(400).json({ error: "Provide at least one supported milestone field to update." });
  try {
    const existing = await getMilestoneById(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Milestone not found." });
    const milestone = await updateGoalMilestone(existing.id, validation.values);
    return res.json({ message: "Milestone updated successfully.", milestone });
  } catch (error) { return sendError(res, error, "update milestone"); }
};

export const deleteProductivityMilestoneController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid milestone ID." });
  try {
    const deleted = await deleteGoalMilestone(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Milestone not found." });
    return res.json({ message: "Milestone deleted successfully." });
  } catch (error) { return sendError(res, error, "delete milestone"); }
};
