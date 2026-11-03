import {
  createTask,
  deleteSubtask,
  deleteTask,
  getMyDay,
  getProductivitySummary,
  getTaskById,
  listTasks,
  updateSubtask,
  updateTask,
  createSubtask,
} from "../../services/productivity/productivityTasksService.js";
import { getKigaliDateString } from "../../utils/kigaliTime.js";
import { sendCategoryPushNotification } from "../../services/appPushNotificationService.js";
import {
  isValidProductivityDate,
  isValidProductivityId,
  validateSubtaskInput,
  validateTaskInput,
} from "../../utils/productivityValidation.js";

const sendError = (res, error, operation) => {
  if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR") {
    return res.status(503).json({
      error: "Productivity task storage is not initialized. Apply Backend/migrations/20261103_productivity_tasks_projects.sql.",
      code: "PRODUCTIVITY_TASKS_MIGRATION_REQUIRED",
    });
  }
  if (error?.code === "PRODUCTIVITY_PROJECT_NOT_FOUND") return res.status(404).json({ error: error.message });
  if (error?.code === "PRODUCTIVITY_PROJECT_NOT_ACTIVE") return res.status(409).json({ error: error.message });
  console.error(`${operation} productivity task error:`, error);
  return res.status(500).json({ error: `Could not ${operation} productivity task data.` });
};

export const listProductivityTasksController = async (req, res) => {
  const filters = {};
  if (req.query.status) {
    if (!["todo", "in_progress", "completed", "cancelled"].includes(req.query.status)) {
      return res.status(400).json({ error: "Invalid task status filter." });
    }
    filters.status = req.query.status;
  }
  if (req.query.priority) {
    if (!["none", "low", "medium", "high"].includes(req.query.priority)) {
      return res.status(400).json({ error: "Invalid priority filter." });
    }
    filters.priority = req.query.priority;
  }
  if (req.query.projectId) {
    if (!isValidProductivityId(req.query.projectId)) return res.status(400).json({ error: "Invalid project ID." });
    filters.projectId = Number(req.query.projectId);
  }
  if (req.query.date) {
    if (!isValidProductivityDate(req.query.date)) return res.status(400).json({ error: "date must be a valid YYYY-MM-DD date." });
    filters.date = req.query.date;
  }
  if (req.query.search) {
    if (typeof req.query.search !== "string" || req.query.search.length > 100) return res.status(400).json({ error: "Search text must be 100 characters or fewer." });
    filters.search = req.query.search.trim();
  }
  filters.includeCompleted = req.query.includeCompleted === "true";

  try {
    return res.json({ tasks: await listTasks(filters) });
  } catch (error) {
    return sendError(res, error, "retrieve");
  }
};

export const getProductivityTaskController = async (req, res) => {
  if (!isValidProductivityId(req.params.id)) return res.status(400).json({ error: "Invalid task ID." });
  try {
    const task = await getTaskById(Number(req.params.id));
    if (!task) return res.status(404).json({ error: "Task not found." });
    return res.json({ task });
  } catch (error) {
    return sendError(res, error, "retrieve");
  }
};

export const createProductivityTaskController = async (req, res) => {
  const validation = validateTaskInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const task = await createTask(validation.values);
    return res.status(201).json({ message: "Task created successfully.", task });
  } catch (error) {
    return sendError(res, error, "create");
  }
};

export const updateProductivityTaskController = async (req, res) => {
  if (!isValidProductivityId(req.params.id)) return res.status(400).json({ error: "Invalid task ID." });
  const validation = validateTaskInput(req.body, { partial: true });
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  if (Object.keys(validation.values).length === 0) return res.status(400).json({ error: "Provide at least one supported task field to update." });
  try {
    const existing = await getTaskById(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Task not found." });
    const task = await updateTask(Number(req.params.id), validation.values);
    if (validation.values.status === "completed" && existing.status !== "completed") {
      try {
        await sendCategoryPushNotification({
          category: "taskReminders",
          eventKey: `task-completed-${task.id}`,
          title: "Task completed",
          body: `“${task.title}” has been marked complete.`,
          route: "/productivity/tasks",
          ttl: 60 * 60,
        });
      } catch (pushError) {
        console.error("Task completion push failed:", pushError?.message || pushError);
      }
    }
    return res.json({ message: "Task updated successfully.", task });
  } catch (error) {
    return sendError(res, error, "update");
  }
};

export const deleteProductivityTaskController = async (req, res) => {
  if (!isValidProductivityId(req.params.id)) return res.status(400).json({ error: "Invalid task ID." });
  try {
    const deleted = await deleteTask(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Task not found." });
    return res.json({ message: "Task and its subtasks deleted successfully." });
  } catch (error) {
    return sendError(res, error, "delete");
  }
};

export const getProductivityMyDayController = async (req, res) => {
  const date = req.query.date || getKigaliDateString();
  if (!isValidProductivityDate(date)) return res.status(400).json({ error: "date must be a valid YYYY-MM-DD date." });
  try {
    return res.json(await getMyDay(date));
  } catch (error) {
    return sendError(res, error, "retrieve My Day");
  }
};

export const getProductivitySummaryController = async (_req, res) => {
  try {
    return res.json(await getProductivitySummary());
  } catch (error) {
    return sendError(res, error, "retrieve summary");
  }
};

export const createProductivitySubtaskController = async (req, res) => {
  if (!isValidProductivityId(req.params.id)) return res.status(400).json({ error: "Invalid task ID." });
  const validation = validateSubtaskInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const subtask = await createSubtask(Number(req.params.id), validation.values);
    if (!subtask) return res.status(404).json({ error: "Parent task not found." });
    return res.status(201).json({ message: "Subtask created successfully.", subtask });
  } catch (error) {
    return sendError(res, error, "create subtask");
  }
};

export const updateProductivitySubtaskController = async (req, res) => {
  if (!isValidProductivityId(req.params.id)) return res.status(400).json({ error: "Invalid subtask ID." });
  const validation = validateSubtaskInput(req.body, { partial: true });
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  if (!Object.keys(validation.values).length) return res.status(400).json({ error: "Provide at least one subtask field to update." });
  try {
    const subtask = await updateSubtask(Number(req.params.id), validation.values);
    if (!subtask) return res.status(404).json({ error: "Subtask not found." });
    return res.json({ message: "Subtask updated successfully.", subtask });
  } catch (error) {
    return sendError(res, error, "update subtask");
  }
};

export const deleteProductivitySubtaskController = async (req, res) => {
  if (!isValidProductivityId(req.params.id)) return res.status(400).json({ error: "Invalid subtask ID." });
  try {
    const deleted = await deleteSubtask(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Subtask not found." });
    return res.json({ message: "Subtask deleted successfully." });
  } catch (error) {
    return sendError(res, error, "delete subtask");
  }
};
