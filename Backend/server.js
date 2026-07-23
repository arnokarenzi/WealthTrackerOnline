import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import monthlyBudgetRoutes from "./routes/monthlyBudgetRoutes.js";
import dailyExpenseRoutes from "./routes/dailyExpenseRoutes.js";
import savingsGoalRoutes from "./routes/savingsGoalRoutes.js";
import schoolFeesRoutes from "./routes/schoolFeesRoutes.js";
import investmentRoutes from "./routes/investmentRoutes.js";
import allocationRoutes from "./routes/allocationRoutes.js";
import gratitudeRoutes from "./routes/gratitudeRoutes.js";
import alertsRoutes from "./routes/alertsRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import pendingEarningsRouter from "./routes/pendingEarningsRoutes.js"; // 🌟 Added missing import

dotenv.config();

// Global error handlers to prevent silent server crashes
process.on("uncaughtException", (err) => {
  console.error("FATAL UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Main App API Routes
app.use("/api/monthly-budget", monthlyBudgetRoutes);
app.use("/api/daily-expenses", dailyExpenseRoutes);
app.use("/api/savings-goals", savingsGoalRoutes);
app.use("/api/school-fees", schoolFeesRoutes);
app.use("/api/actual-investments", investmentRoutes);
app.use("/api/allocation", allocationRoutes);
app.use("/api/gratitude", gratitudeRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/pending-earnings", pendingEarningsRouter);

app.get("/", (req, res) => {
  res.send("WealthTrackerOnline Backend API is operating perfectly!");
});

app.listen(PORT, () => {
  console.log(`Server is running successfully on port ${PORT}`);
});
