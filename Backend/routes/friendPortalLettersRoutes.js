import express from "express";
import {
  claimFriendPortalPayoutController,
  getFriendPortalLetters,
  getPendingFriendPortalPayoutsController,
  removeFriendPortalLetters,
  resetFriendPortalShiftController,
  saveFriendPortalLetters,
} from "../controllers/friendPortalLettersController.js";

const router = express.Router();

router.get("/", getFriendPortalLetters);
router.post("/", saveFriendPortalLetters);
router.delete("/:id", removeFriendPortalLetters);
router.post("/reset", resetFriendPortalShiftController);
router.get("/payouts/pending", getPendingFriendPortalPayoutsController);
router.post("/payouts/claim/:id", claimFriendPortalPayoutController);

export default router;
