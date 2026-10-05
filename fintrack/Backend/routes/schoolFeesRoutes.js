import express from "express";
const router = express.Router();
import * as controller from "../controllers/schoolFeesController.js";

router.get("/", controller.getFeesHistory);
router.post("/", controller.addSchoolFees);
router.post("/reset-fees", controller.resetSchoolFeesOnly);

// Term Configuration Endpoints
router.get("/term-config/active", controller.getActiveTermConfig);
router.put("/term-config", controller.updateTermConfig);

export default router;
