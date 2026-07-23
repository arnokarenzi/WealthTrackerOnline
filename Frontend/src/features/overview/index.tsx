import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Grid,
  Typography,
  useTheme,
  CircularProgress,
  LinearProgress,
  Divider,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import {
  AttachMoney,
  ShoppingCartCheckout,
  Balance,
  Savings as SavingsIcon,
  Work,
  Shield,
  Star,
  TrendingUp,
  RestartAlt,
  LockOutlined,
} from "@mui/icons-material";
import PersonalFinancesCard from "./components/PersonalFinanceCard";
import { tokens } from "../../assets/theme";
import ShiftTrackerWidget from "../../components/ShiftTrackerWidget";
import PendingEarningsWidget from "../../components/PendingEarningsWidget"; // 🌟 Imported Pending Earnings Widget

import { financeApi } from "../../services/api";
import { MonthlyBudget } from "../../types/api";

interface ShiftStatusSummary {
  medal: string;
  message: string;
}

interface DashboardSummary {
  efCompletionPct: number;
  emergencyTarget: number;
  essentials: number;
  financialStage: string;
  seedRatio: number;
  wealthScore: number;
  shiftStatus: ShiftStatusSummary;
  monthlyBudget: MonthlyBudget;
}

interface SavingsGoal {
  id: number;
  goalName?: string;
  goal_name?: string;
  targetAmount?: number;
  target_amount?: number;
  currentSaved?: number;
  currentAmount?: number;
  current_amount?: number;
}

interface DailyExpense {
  amount: number;
}

export default function Overview() {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [liveBudget, setLiveBudget] = useState<MonthlyBudget | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(
    null,
  );
  const [savings, setSavings] = useState<SavingsGoal[]>([]);
  const [actualExpenses, setActualExpenses] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // 🌟 Extra Income Modal States
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState<boolean>(false);
  const [incomeAmount, setIncomeAmount] = useState<string>("");
  const [incomeDescription, setIncomeDescription] = useState<string>("");
  const [isSubmittingIncome, setIsSubmittingIncome] = useState<boolean>(false);

  const [refreshKey, setRefreshKey] = useState<number>(0);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const secureApi = financeApi as typeof financeApi & {
        getDashboardSummary: () => Promise<DashboardSummary>;
        getSavingsGoals: () => Promise<SavingsGoal[]>;
        getExpenses?: () => Promise<DailyExpense[]>;
      };

      // Wrapped individual calls with catch blocks so a single table error doesn't break the entire dashboard
      const [budgetPlan, dashboardSummary, savingsData, expensesData] =
        await Promise.all([
          secureApi.getBudgetPlan().catch(() => null),
          secureApi.getDashboardSummary().catch(() => null),
          secureApi.getSavingsGoals
            ? secureApi.getSavingsGoals().catch(() => [])
            : Promise.resolve([]),
          secureApi.getExpenses
            ? secureApi.getExpenses().catch(() => [])
            : Promise.resolve([]),
        ]);

      if (budgetPlan) setLiveBudget(budgetPlan);
      if (dashboardSummary) setDashboardData(dashboardSummary);
      setSavings(savingsData || []);

      const totalExp = (expensesData || []).reduce(
        (sum: number, item: DailyExpense) => sum + Number(item.amount || 0),
        0,
      );
      setActualExpenses(totalExp);
    } catch (err: unknown) {
      console.error("Dashboard data fetch failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleExecuteProjectReset = async (): Promise<void> => {
    setAuthError(null);
    if (passwordInput !== "Kimironko@1992") {
      setAuthError(
        "Administrative authentication failed. Incorrect system passphrase.",
      );
      return;
    }

    try {
      setIsResetting(true);

      await financeApi.initializeProjectDefaults();

      await fetchDashboardData();
      setRefreshKey((prev: number) => prev + 1);

      setIsResetting(false);
      setIsResetModalOpen(false);
      setPasswordInput("");
    } catch (err: unknown) {
      console.error("System administrative wipe failure:", err);
      setAuthError("Failed to reset database. Verify backend connection.");
      setIsResetting(false);
    }
  };

  const handleOpenResetModal = (): void => {
    setIsResetModalOpen(true);
    setAuthError(null);
    setPasswordInput("");
  };

  const handleCloseResetModal = (): void => {
    if (!isResetting) setIsResetModalOpen(false);
  };

  // 🌟 Extra Income Handlers
  const handleOpenIncomeModal = (): void => {
    setIsIncomeModalOpen(true);
    setIncomeAmount("");
    setIncomeDescription("");
  };

  const handleCloseIncomeModal = (): void => {
    if (!isSubmittingIncome) setIsIncomeModalOpen(false);
  };

  const handleSaveExtraIncome = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const parsedAmount = parseFloat(incomeAmount);
    if (!parsedAmount || parsedAmount <= 0) return;

    try {
      setIsSubmittingIncome(true);
      const secureApi = financeApi as typeof financeApi & {
        addExtraIncome?: (data: {
          amount: number;
          description: string;
        }) => Promise<void>;
      };

      if (secureApi.addExtraIncome) {
        await secureApi.addExtraIncome({
          amount: parsedAmount,
          description: incomeDescription || "Side Hustle / Freelance",
        });
      }

      await fetchDashboardData();
      setIsIncomeModalOpen(false);
    } catch (err) {
      console.error("Failed to commit extra income:", err);
    } finally {
      setIsSubmittingIncome(false);
    }
  };

  // Calculations for Cards
  const salary = Number(liveBudget?.salary ?? 0);
  const auxiliary = Number(liveBudget?.otherIncome ?? 0);
  const totalIncome = dashboardData?.monthlyBudget
    ? Number(dashboardData.monthlyBudget.salary) +
      Number(dashboardData.monthlyBudget.otherIncome)
    : salary + auxiliary;

  // Total accumulated reserves calculated dynamically from actual Savings Goals records
  const accumulatedReserves = savings.reduce((total, goal) => {
    const current = Number(
      goal.currentAmount ?? goal.current_amount ?? goal.currentSaved ?? 0,
    );
    return total + current;
  }, 0);

  // Extract true Investments value exclusively from the "Business Capital" savings goal
  const businessCapitalGoal = savings.find(
    (g) =>
      (g.goalName ?? g.goal_name ?? "").toLowerCase() === "business capital",
  );
  const totalInvestments = Number(
    businessCapitalGoal?.currentAmount ??
      businessCapitalGoal?.current_amount ??
      businessCapitalGoal?.currentSaved ??
      0,
  );

  // Pull wallet balance directly from the backend's authoritative balance source
  const calculatedWallet = Number(
    dashboardData?.monthlyBudget?.balance ?? liveBudget?.balance ?? 0,
  );

  const emergencyGoal = savings.find(
    (g) => (g.goalName ?? g.goal_name ?? "").toLowerCase() === "emergency fund",
  );

  const liveEfPct = emergencyGoal
    ? Math.round(
        (Number(
          emergencyGoal.currentSaved ??
            emergencyGoal.currentAmount ??
            emergencyGoal.current_amount ??
            0,
        ) /
          (Number(
            emergencyGoal.targetAmount ?? emergencyGoal.target_amount ?? 0,
          ) || 1)) *
          100,
      )
    : (dashboardData?.efCompletionPct ?? 0);

  return (
    <>
      <Box sx={{ padding: 2 }}>
        <Box
          sx={{
            paddingBlock: 2,
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="h1">Overview</Typography>
            <Typography variant="h6">
              A snapshot of your financial health
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleOpenIncomeModal}
              sx={{ fontWeight: 600, textTransform: "none" }}
            >
              + Add Side Income
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RestartAlt />}
              onClick={handleOpenResetModal}
              sx={{
                fontWeight: 600,
                textTransform: "none",
                borderWidth: "2px",
                "&:hover": { borderWidth: "2px" },
              }}
            >
              Initialize Project
            </Button>
          </Box>
        </Box>

        <Box sx={{ width: "100%", mb: 2 }}>
          <ShiftTrackerWidget key={refreshKey} />
        </Box>

        {/* 🌟 Render Pending Earnings Widget (automatically hides if empty) */}
        <Box sx={{ width: "100%", mb: 2 }}>
          <PendingEarningsWidget
            key={refreshKey}
            onClaimSuccess={fetchDashboardData}
          />
        </Box>

        <Grid container spacing={2} sx={{ width: "100%" }} key={refreshKey}>
          <Grid item xs={12} md>
            <PersonalFinancesCard
              title="Expected Income (Budgeted)"
              value={totalIncome}
              icon={<Work sx={{ color: colors.greenAccent[600] }} />}
              chartType={[1, 4, 2, 5, 7, 2, 4, 6]}
            />
          </Grid>
          <Grid item xs={12} md>
            <PersonalFinancesCard
              title="Expenses"
              value={actualExpenses}
              icon={
                <ShoppingCartCheckout sx={{ color: colors.greenAccent[600] }} />
              }
              chartType={[3, -10, -2, 5, 7, -2, 4, 6]}
            />
          </Grid>
          <Grid item xs={12} md>
            <PersonalFinancesCard
              title="Wallet"
              value={calculatedWallet}
              icon={<Balance sx={{ color: colors.greenAccent[600] }} />}
              chartType={[1, 3, 4, 5, 5, 6, 6, 8]}
            />
          </Grid>
          <Grid item xs={12} md>
            <PersonalFinancesCard
              title="Savings"
              value={accumulatedReserves}
              icon={<SavingsIcon sx={{ color: colors.greenAccent[600] }} />}
              chartType={[3, -10, -2, 3, 4, -2, 4, 6]}
            />
          </Grid>
          <Grid item xs={12} md>
            <PersonalFinancesCard
              title="Investments"
              value={totalInvestments}
              icon={<AttachMoney sx={{ color: colors.greenAccent[600] }} />}
              chartType={[1, 4, 2, 5, 7, 2, 4, 6]}
            />
          </Grid>

          <Grid item xs={12} sm={12} md={6} lg={4}>
            <Box
              sx={{
                backgroundColor: colors.primary[400],
                borderRadius: "4px",
                boxShadow: 4,
                padding: "1rem",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 1.5 }}>
                Financial Health Metrics
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {loading ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  flexGrow={1}
                  py={4}
                >
                  <CircularProgress color="info" />
                </Box>
              ) : !dashboardData ? (
                <Typography
                  variant="body2"
                  sx={{
                    color: colors.grey[400],
                    textAlign: "center",
                    my: "auto",
                  }}
                >
                  No ongoing health summaries compiled.
                </Typography>
              ) : (
                <Stack
                  spacing={2.5}
                  sx={{ justifyContent: "center", flexGrow: 1 }}
                >
                  <Box>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      sx={{ mb: 0.5 }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Star
                          sx={{ color: colors.greenAccent[600], fontSize: 18 }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Wealth Score
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {dashboardData.wealthScore} / 100
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={dashboardData.wealthScore}
                      color="success"
                      sx={{
                        height: 6,
                        borderRadius: 2,
                        backgroundColor: "rgba(0,0,0,0.1)",
                      }}
                    />
                  </Box>
                  <Box>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      sx={{ mb: 0.5 }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Shield
                          sx={{ color: colors.greenAccent[600], fontSize: 18 }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Emergency Buffer Progress
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {liveEfPct}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(liveEfPct, 100)}
                      color="info"
                      sx={{
                        height: 6,
                        borderRadius: 2,
                        backgroundColor: "rgba(0,0,0,0.1)",
                      }}
                    />
                  </Box>
                  <Divider />
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <TrendingUp
                        sx={{ color: colors.greenAccent[600], fontSize: 18 }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Financial Phase
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, color: colors.greenAccent[500] }}
                    >
                      {dashboardData.financialStage}
                    </Typography>
                  </Stack>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, color: colors.grey[400] }}
                    >
                      Essentials Base Cap
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {Number(dashboardData.essentials).toLocaleString()} RWF
                    </Typography>
                  </Stack>
                </Stack>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Side Income Modal Dialog */}
      <Dialog
        open={isIncomeModalOpen}
        onClose={handleCloseIncomeModal}
        PaperProps={{
          sx: {
            backgroundColor: colors.primary[400],
            padding: 2,
            minWidth: "400px",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: colors.greenAccent[500] }}>
          Record Side Hustle / Extra Income
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: colors.grey[200], mb: 2 }}>
            Log ad-hoc earnings from outside your regular salary. This will be
            added directly to your Wallet Balance.
          </DialogContentText>
          <Box
            component="form"
            onSubmit={handleSaveExtraIncome}
            id="income-form"
            sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
          >
            <TextField
              label="Description (e.g., Freelance Project)"
              variant="outlined"
              fullWidth
              value={incomeDescription}
              onChange={(e) => setIncomeDescription(e.target.value)}
            />
            <TextField
              label="Amount (RWF)"
              type="number"
              variant="outlined"
              fullWidth
              required
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseIncomeModal}
            sx={{ color: colors.grey[100], textTransform: "none" }}
            disabled={isSubmittingIncome}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="income-form"
            variant="contained"
            color="secondary"
            disabled={isSubmittingIncome || !incomeAmount}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {isSubmittingIncome ? "Processing..." : "Deposit to Wallet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Administrative Master Reset Modal Dialog */}
      <Dialog
        open={isResetModalOpen}
        onClose={handleCloseResetModal}
        PaperProps={{
          sx: {
            backgroundColor: colors.primary[400],
            padding: 2,
            minWidth: "420px",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            color: theme.palette.error.main,
            fontWeight: 700,
          }}
        >
          <LockOutlined /> Administrative Master Reset
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: colors.grey[200], mb: 3 }}>
            Warning: This action will completely overwrite all transaction
            metrics, outlays, historical savings allocations, and clean the
            application pages back to pristine baseline parameters.
          </DialogContentText>
          {authError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {authError}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Enter Administrative Password"
            type="password"
            fullWidth
            variant="outlined"
            value={passwordInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPasswordInput(e.target.value)
            }
            disabled={isResetting}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseResetModal}
            sx={{
              color: colors.grey[100],
              textTransform: "none",
              fontWeight: 600,
            }}
            disabled={isResetting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExecuteProjectReset}
            variant="contained"
            color="error"
            disabled={isResetting || !passwordInput}
            sx={{ textTransform: "none", fontWeight: 600, px: 3 }}
          >
            {isResetting ? "Purging Records..." : "Confirm Initialization"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
