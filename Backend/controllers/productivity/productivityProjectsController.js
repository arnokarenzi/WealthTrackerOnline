import {
  archiveProject,
  createProject,
  getProjectById,
  listProjects,
  updateProject,
} from "../../services/productivity/productivityProjectsService.js";
import { isValidProductivityId, validateProjectInput } from "../../utils/productivityValidation.js";

const sendError = (res, error, operation) => {
  if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR") {
    return res.status(503).json({
      error: "Productivity project storage is not initialized. Apply Backend/migrations/20261103_productivity_tasks_projects.sql.",
      code: "PRODUCTIVITY_TASKS_MIGRATION_REQUIRED",
    });
  }
  console.error(`${operation} productivity project error:`, error);
  return res.status(500).json({ error: `Could not ${operation} productivity projects.` });
};

export const listProductivityProjectsController = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    return res.json({ projects: await listProjects({ includeArchived }) });
  } catch (error) {
    return sendError(res, error, "retrieve");
  }
};

export const createProductivityProjectController = async (req, res) => {
  const validation = validateProjectInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const project = await createProject(validation.values);
    return res.status(201).json({ message: "Project created successfully.", project });
  } catch (error) {
    return sendError(res, error, "create");
  }
};

export const updateProductivityProjectController = async (req, res) => {
  if (!isValidProductivityId(req.params.id)) return res.status(400).json({ error: "Invalid project ID." });
  const validation = validateProjectInput(req.body, { partial: true });
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  if (!Object.keys(validation.values).length) return res.status(400).json({ error: "Provide at least one supported project field to update." });
  try {
    const existing = await getProjectById(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Project not found." });
    const project = await updateProject(Number(req.params.id), validation.values);
    return res.json({ message: "Project updated successfully.", project });
  } catch (error) {
    return sendError(res, error, "update");
  }
};

export const archiveProductivityProjectController = async (req, res) => {
  if (!isValidProductivityId(req.params.id)) return res.status(400).json({ error: "Invalid project ID." });
  try {
    const archived = await archiveProject(Number(req.params.id));
    if (!archived) return res.status(404).json({ error: "Active project not found." });
    return res.json({ message: "Project archived. Its tasks have been retained." });
  } catch (error) {
    return sendError(res, error, "archive");
  }
};
