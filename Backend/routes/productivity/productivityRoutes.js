import express from "express";
import {
  archiveProductivityHabitController,
  createProductivityHabitController,
  deleteProductivityHabitLogController,
  listProductivityHabitLogsController,
  listProductivityHabitsController,
  saveProductivityHabitLogController,
  updateProductivityHabitController,
} from "../../controllers/productivity/productivityHabitsController.js";
import {
  createProductivityFocusSessionController,
  getProductivityFocusSummaryController,
  listProductivityFocusSessionsController,
} from "../../controllers/productivity/productivityFocusController.js";
import {
  createProductivityCalendarEventController,
  deleteProductivityCalendarEventController,
  getProductivityCalendarController,
  updateProductivityCalendarEventController,
} from "../../controllers/productivity/productivityCalendarController.js";
import {
  getProductivitySettingsController,
  updateProductivitySettingsController,
} from "../../controllers/productivity/productivitySettingsController.js";
import {
  createProductivityProjectController,
  listProductivityProjectsController,
  updateProductivityProjectController,
  archiveProductivityProjectController,
} from "../../controllers/productivity/productivityProjectsController.js";
import {
  createProductivitySubtaskController,
  createProductivityTaskController,
  deleteProductivitySubtaskController,
  deleteProductivityTaskController,
  getProductivityMyDayController,
  getProductivityTaskController,
  getProductivitySummaryController,
  listProductivityTasksController,
  updateProductivitySubtaskController,
  updateProductivityTaskController,
} from "../../controllers/productivity/productivityTasksController.js";

const router = express.Router();

// Workspace preferences (Phase 1)
router.get("/settings", getProductivitySettingsController);
router.patch("/settings", updateProductivitySettingsController);

// Calendar events and scheduled task display (Phase 3)
router.get("/calendar", getProductivityCalendarController);
router.post("/calendar/events", createProductivityCalendarEventController);
router.put("/calendar/events/:id", updateProductivityCalendarEventController);
router.delete("/calendar/events/:id", deleteProductivityCalendarEventController);

// Summary and daily planning
router.get("/summary", getProductivitySummaryController);
router.get("/my-day", getProductivityMyDayController);

// Projects
router.get("/projects", listProductivityProjectsController);
router.post("/projects", createProductivityProjectController);
router.put("/projects/:id", updateProductivityProjectController);
router.delete("/projects/:id", archiveProductivityProjectController);

// Habits and completion logs (Phase 4)
router.get("/habits", listProductivityHabitsController);
router.post("/habits", createProductivityHabitController);
router.put("/habits/:id", updateProductivityHabitController);
router.delete("/habits/:id", archiveProductivityHabitController);
router.get("/habits/:id/logs", listProductivityHabitLogsController);
router.post("/habits/:id/logs", saveProductivityHabitLogController);
router.delete("/habits/:id/logs/:date", deleteProductivityHabitLogController);

// Focus session history (Phase 4)
router.get("/focus/summary", getProductivityFocusSummaryController);
router.get("/focus/sessions", listProductivityFocusSessionsController);
router.post("/focus/sessions", createProductivityFocusSessionController);

// Tasks and subtasks
router.get("/tasks", listProductivityTasksController);
router.get("/tasks/:id", getProductivityTaskController);
router.post("/tasks", createProductivityTaskController);
router.put("/tasks/:id", updateProductivityTaskController);
router.delete("/tasks/:id", deleteProductivityTaskController);
router.post("/tasks/:id/subtasks", createProductivitySubtaskController);
router.put("/subtasks/:id", updateProductivitySubtaskController);
router.delete("/subtasks/:id", deleteProductivitySubtaskController);

export default router;
