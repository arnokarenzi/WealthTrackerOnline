import express from "express";
import {
  getAllocation,
  upsertAllocation,
  applyAllocation,
} from "../controllers/allocationController.js";

const router = express.Router();

router.get("/", getAllocation);
router.put("/", upsertAllocation);
router.post("/apply", applyAllocation);

export default router;
