import express from "express";
const router = express.Router();
import * as controller from "../controllers/gratitudeController.js";
router.post("/", controller.saveGratitude);
router.get("/", controller.getGratitudes);
router.delete("/:id", controller.deleteGratitude);

export default router;
