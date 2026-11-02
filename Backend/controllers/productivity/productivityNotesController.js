import { archiveNote, createNote, getNoteById, listNotes, updateNote } from "../../services/productivity/productivityNotesService.js";
import { isValidPlanningId, validateNoteInput } from "../../utils/productivityPlanningValidation.js";

const sendError = (res, error, operation) => {
  if (error?.code === "ER_NO_SUCH_TABLE") return res.status(503).json({
    error: "Notes storage is not initialized. Apply Backend/migrations/20261106_productivity_goals_notes_countdowns.sql.",
    code: "PRODUCTIVITY_NOTES_MIGRATION_REQUIRED",
  });
  console.error(`${operation} productivity note error:`, error);
  return res.status(500).json({ error: `Could not ${operation} productivity notes.` });
};

export const listProductivityNotesController = async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search.length > 100) return res.status(400).json({ error: "Search text must be 100 characters or fewer." });
  try {
    return res.json({ notes: await listNotes({ includeArchived: req.query.includeArchived === "true", search }) });
  } catch (error) { return sendError(res, error, "retrieve"); }
};

export const createProductivityNoteController = async (req, res) => {
  const validation = validateNoteInput(req.body);
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  try {
    const note = await createNote(validation.values);
    return res.status(201).json({ message: "Note saved successfully.", note });
  } catch (error) { return sendError(res, error, "save"); }
};

export const updateProductivityNoteController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid note ID." });
  const validation = validateNoteInput(req.body, { partial: true });
  if (validation.errors.length) return res.status(400).json({ error: validation.errors.join(" ") });
  if (!Object.keys(validation.values).length) return res.status(400).json({ error: "Provide at least one supported note field to update." });
  try {
    if (!await getNoteById(Number(req.params.id))) return res.status(404).json({ error: "Note not found." });
    const note = await updateNote(Number(req.params.id), validation.values);
    return res.json({ message: "Note updated successfully.", note });
  } catch (error) { return sendError(res, error, "update"); }
};

export const archiveProductivityNoteController = async (req, res) => {
  if (!isValidPlanningId(req.params.id)) return res.status(400).json({ error: "Invalid note ID." });
  try {
    const archived = await archiveNote(Number(req.params.id));
    if (!archived) return res.status(404).json({ error: "Note not found or already archived." });
    return res.json({ message: "Note archived successfully." });
  } catch (error) { return sendError(res, error, "archive"); }
};
