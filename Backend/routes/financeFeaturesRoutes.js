import express from "express";
import {
  searchRecords,
  getBills,
  createBill,
  updateBill,
  archiveBill,
  recordBillPayment,
  getBillPayments,
  getBillPaymentTrends,
  getDebts,
  createDebt,
  updateDebt,
  archiveDebt,
  recordDebtPayment,
  getDebtPayments,
  getDebtSummary,
  getReports,
  getNetWorth,
  createNetWorthAsset,
  archiveNetWorthAsset,
  saveNetWorthSnapshot,
  getSettings,
  updateSettings,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getActionCenter,
} from "../controllers/financeFeaturesController.js";

const router = express.Router();

router.get("/search", searchRecords);
router.get("/reports", getReports);

router.get("/bills", getBills);
router.post("/bills", createBill);
router.get("/bills/trends", getBillPaymentTrends);
router.get("/bills/payments", getBillPayments);
router.get("/bills/:id/payments", getBillPayments);
router.post("/bills/:id/payments", recordBillPayment);
router.put("/bills/:id", updateBill);
router.delete("/bills/:id", archiveBill);

router.get("/debts", getDebts);
router.post("/debts", createDebt);
router.get("/debts/summary", getDebtSummary);
router.get("/debts/payments", getDebtPayments);
router.post("/debts/:id/payments", recordDebtPayment);
router.put("/debts/:id", updateDebt);
router.delete("/debts/:id", archiveDebt);

router.get("/net-worth", getNetWorth);
router.post("/net-worth/assets", createNetWorthAsset);
router.delete("/net-worth/assets/:id", archiveNetWorthAsset);
router.post("/net-worth/snapshots", saveNetWorthSnapshot);

router.get("/settings", getSettings);
router.patch("/settings", updateSettings);
router.put("/settings", updateSettings);

router.get("/notifications", getNotifications);
router.post("/notifications/read-all", markAllNotificationsRead);
router.patch("/notifications/:id/read", markNotificationRead);

router.get("/action-center", getActionCenter);

export default router;
