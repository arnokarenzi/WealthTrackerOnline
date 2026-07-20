import express from "express";
const router = express.Router();
import * as controller from "../controllers/schoolFeesController.js";
router.get("/", controller.getFeesHistory);
router.post("/reset-fees", controller.resetSchoolFeesOnly);
export default router;
