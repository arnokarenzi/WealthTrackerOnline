import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Grid, Typography } from "@mui/material";
import TrendAnalysis from "./components/TrendAnalysis";
import SpendingBreakdown from "./components/SpendingBreakdown";
import BudgetComparison from "./components/BudgetComparison";
import FinancialOverview from "./components/FinancialOverview";
import { financeApi } from "../../services/api";
import type { ReportsPayload } from "../../types/api";

export default function Reports() {
  const [report, setReport] = useState<ReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    financeApi.getReports()
      .then(setReport)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load reports from the server."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ padding: 2 }}>
      <Box sx={{ paddingBlock: 2 }}>
        <Typography variant="h1">Reports &amp; Analysis</Typography>
        <Typography variant="h6">Insights from saved expenses, recorded income, and the current saved budget</Typography>
        {report && <Typography variant="caption" color="text.secondary">Period: {report.period.startDate} to {report.period.endDate}</Typography>}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error}</Alert>}
      {loading && <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>}
      {!loading && !error && report && <>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}><TrendAnalysis data={report.trendAnalysis} /></Grid>
          <Grid item xs={12} md={6}><FinancialOverview data={report.financialOverview} /></Grid>
          <Grid item xs={12} md={6}><SpendingBreakdown data={report.spendingBreakdown} keys={report.spendingBreakdownKeys} /></Grid>
          <Grid item xs={12} md={6}><BudgetComparison data={report.budgetComparison} /></Grid>
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          {report.definitions.financialOverview} {report.definitions.budgetComparison}
        </Typography>
      </>}
    </Box>
  );
}
