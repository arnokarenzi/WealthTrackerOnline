import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  LinearProgress,
  Chip,
  CircularProgress,
  Divider,
  TextField,
  Button,
  InputAdornment,
} from "@mui/material";
import {
  LocalActivity,
  WorkspacePremium,
  TrendingDown,
  AccountBalanceWallet,
  Send,
} from "@mui/icons-material";
import { financeApi } from "../services/api";
import { DashboardSummary } from "../types/api";

export default function ShiftTrackerWidget() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // New interactive states for the text box
  const [inputLetters, setInputLetters] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reusable function to fetch live dashboard metrics
  const fetchMetrics = () => {
    financeApi
      .getDashboardSummary()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load shift performance matrix:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  // Handle submitting the text box data to Aiven MySQL
  const handleLogProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(inputLetters, 10);

    if (isNaN(count) || count < 0) {
      alert("Please enter a valid positive number of letters.");
      return;
    }

    setSubmitting(true);
    try {
      await financeApi.recordTranslatedLetters(count);
      setInputLetters(""); // Clear the text box on success
      fetchMetrics(); // Refresh the numbers dynamically!
    } catch (err) {
      console.error("Failed to update translation progress:", err);
      alert("Error saving progress to the cloud database.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!data || !data.shiftStatus) {
    return (
      <Card sx={{ bgcolor: "background.paper", borderRadius: 2, p: 2 }}>
        <Typography color="text.secondary">
          No active shift performance logs discovered.
        </Typography>
      </Card>
    );
  }

  const { shiftStatus, monthlyBudget } = data;
  const muiColor =
    shiftStatus.variant === "danger" ? "error" : shiftStatus.variant;
  const shiftProgressPct = Math.min(
    Math.round((shiftStatus.currentDay / shiftStatus.totalDaysInShift) * 100),
    100,
  );

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)",
        mb: 4,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header Section */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
          mb={2}
        >
          <Box>
            <Typography variant="h5" fontWeight="700" color="text.primary">
              Shift Engine Performance
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Day {shiftStatus.shiftDay} of {shiftStatus.totalDaysInShift} (
              {shiftStatus.isShift1 ? "Shift 1" : "Shift 2"})
            </Typography>
          </Box>
          <Chip
            icon={<WorkspacePremium />}
            label={`${shiftStatus.medal} Status`}
            color={muiColor}
            variant="filled"
            sx={{ fontWeight: "bold", px: 1 }}
          />
        </Box>

        {/* Engine Notification Banner */}
        <Box
          sx={{
            bgcolor: `${muiColor}.main`,
            opacity: 0.9,
            borderRadius: 2,
            p: 1.5,
            mb: 3,
          }}
        >
          <Typography variant="body2" color="white" fontWeight="600">
            {shiftStatus.message}
          </Typography>
        </Box>

        {/* Metrics Grid */}
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "action.hover",
                  borderRadius: 2,
                  color: "primary.main",
                }}
              >
                <LocalActivity />
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Letters Velocity
                </Typography>
                <Typography variant="h6" fontWeight="700">
                  {monthlyBudget.translatedLetters} /{" "}
                  {shiftStatus.chunkPacingTarget}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "action.hover",
                  borderRadius: 2,
                  color: "error.main",
                }}
              >
                <TrendingDown />
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Pacing Shortfall
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight="700"
                  color={shiftStatus.behind > 0 ? "error.main" : "text.primary"}
                >
                  {shiftStatus.behind} Letters
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "action.hover",
                  borderRadius: 2,
                  color: "success.main",
                }}
              >
                <AccountBalanceWallet />
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Projected Gross Pay
                </Typography>
                <Typography variant="h6" fontWeight="700" color="success.main">
                  {Math.round(shiftStatus.projectedPay).toLocaleString()} RWF
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "action.hover",
                  borderRadius: 2,
                  color: "warning.main",
                }}
              >
                <TrendingDown />
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Pacing Leakage (Loss)
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight="700"
                  color={
                    shiftStatus.potentialLoss > 0
                      ? "error.main"
                      : "text.secondary"
                  }
                >
                  {Math.round(shiftStatus.potentialLoss).toLocaleString()} RWF
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* NEW ACTION AREA: Log Translated Letters Textbox */}
        <Box
          component="form"
          onSubmit={handleLogProgress}
          sx={{ mb: 3, p: 2, bgcolor: "background.default", borderRadius: 2 }}
        >
          <Typography
            variant="subtitle2"
            fontWeight="700"
            mb={1.5}
            color="text.primary"
          >
            Log Daily Translation Progress
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            <TextField
              size="small"
              label="Enter letters completed"
              type="number"
              value={inputLetters}
              onChange={(e) => setInputLetters(e.target.value)}
              disabled={submitting}
              sx={{ flexGrow: 1, maxWidth: "300px" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocalActivity fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submitting || !inputLetters}
              startIcon={
                submitting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <Send />
                )
              }
            >
              {submitting ? "Saving..." : "Update Progress"}
            </Button>
          </Box>
        </Box>

        {/* Time-Based Pacing Gauge */}
        <Box>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" fontWeight="600" color="text.secondary">
              Shift Timeline Progress
            </Typography>
            <Typography variant="body2" fontWeight="700" color="text.primary">
              {shiftProgressPct}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={shiftProgressPct}
            color="primary"
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
