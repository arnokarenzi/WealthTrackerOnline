import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  Stack,
} from "@mui/material";
import EditNoteIcon from "@mui/icons-material/EditNote";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import BudgetAllocation from "./components/BudgetAllocation";
import IncomeSources from "./components/IncomeSources";
import ExpenseLimits from "./components/ExpenseLimits";
import Savings from "./components/Savings";
import { financeApi } from "../../services/api";
import { MonthlyBudget } from "../../types/api";
import ExpenseForm from "./components/ui/ExpenseForm";

export default function Budget() {
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  // 🚀 Added unique render key to break cache and force component remounts
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const fetchLiveDatabaseData = async () => {
    try {
      setLoading(true);
      const data = await financeApi.getBudgetPlan();
      setBudget(data);
      setError(null);
    } catch (err) {
      console.error("Database fetch failed:", err);
      setError("Failed to load live budget configurations from the database.");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 Async Handler for Reset Month Operation
  const handleResetMonth = async (): Promise<void> => {
    const confirmAction = window.confirm(
      "Are you sure you want to reset the current month parameters? This action will restore your configurations back to default baselines.",
    );
    if (!confirmAction) return;

    try {
      setLoading(true);
      await financeApi.resetMonthAndExport();
      await fetchLiveDatabaseData();
      setRefreshKey((prev: number) => prev + 1);
    } catch (err: unknown) {
      console.error("Reset operation failed:", err);
      let errorMsg = "Failed to reset monthly budget tracking tables.";
      if (typeof err === "object" && err !== null && "response" in err) {
        const axiosErr = err as {
          response?: { data?: { error?: string; message?: string } };
        };
        errorMsg =
          axiosErr.response?.data?.error ||
          axiosErr.response?.data?.message ||
          errorMsg;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveDatabaseData();
  }, []);

  if (loading && refreshKey === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <CircularProgress color="info" />
      </Box>
    );
  }

  if (error || !budget) {
    return (
      <Box sx={{ padding: 2 }}>
        <Alert severity="error">
          {error || "No active budget profile found in database."}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ padding: 2 }}>
      {/* Header Layout Container */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBlock: 2,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h1">Budget Horizon</Typography>
          <Typography variant="h6">
            Tracking active cycle: Month {budget.month}, Year {budget.year}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<RestartAltIcon />}
            onClick={handleResetMonth}
            sx={{ fontWeight: 600, borderRadius: "8px" }}
          >
            Reset Month
          </Button>

          <Button
            variant="contained"
            color="info"
            startIcon={<EditNoteIcon />}
            onClick={() => setIsFormOpen(true)}
            sx={{ fontWeight: 600, borderRadius: "8px" }}
          >
            Modify Blueprint
          </Button>
        </Stack>
      </Box>

      {/* 🚀 Attached key={refreshKey} here to explicitly break child component caching rules */}
      <Grid container spacing={2} key={refreshKey}>
        <Grid item xs={12} md={6} lg={8}>
          <IncomeSources budget={budget} />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <BudgetAllocation budget={budget} />
        </Grid>
        <Grid item xs={12} md={6} lg={6}>
          <ExpenseLimits budget={budget} />
        </Grid>
        <Grid item xs={12} md={6} lg={6}>
          <Savings budget={budget} />
        </Grid>
      </Grid>

      <Dialog
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px", padding: 1 } }}
      >
        <ExpenseForm
          currentBudget={budget}
          onSaveSuccess={async () => {
            await fetchLiveDatabaseData();
            setRefreshKey((prev) => prev + 1); // 🚀 Refreshes UI grids dynamically on form submission
          }}
          onClose={() => setIsFormOpen(false)}
        />
      </Dialog>
    </Box>
  );
}
