import express from "express";
import { getDailyLetterStatus } from "../controllers/dailyLetterController.js";

const router = express.Router();
router.get("/", getDailyLetterStatus);
export default router;
