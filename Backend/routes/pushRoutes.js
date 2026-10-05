import express from "express";
import {
  getPublicKey,
  subscribe,
  unsubscribe,
  testNotification,
} from "../controllers/pushController.js";

const router = express.Router();

router.get("/public-key", getPublicKey);
router.post("/subscribe", subscribe);
router.post("/unsubscribe", unsubscribe);
router.post("/test", testNotification);

export default router;
