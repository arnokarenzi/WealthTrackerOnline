import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  useTheme,
  Stack,
} from "@mui/material";
import {
  ShieldOutlined,
  AccountBalanceWalletOutlined,
  TrendingUpOutlined,
  ShoppingBagOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { financeApi } from "../../services/api";
import { tokens } from "../../assets/theme";

export const AllocationsPage: React.FC = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [allocation, setAllocation] = useState({
    emergency_pct: 10,
    essentials_pct: 50,
    invest_pct: 25,
    discretionary_pct: 15,
  });

  const [recommendations, setRecommendations] = useState<{
    recommendedEssentials: number;
    recommendedEmergency: number;
    recommendedInvest: number;
    recommendedDiscretionary: number;
  } | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchAndApplyTemplate = async () => {
      try {
        setIsLoading(true);
        const data = await financeApi.getAllocationTemplate();
        if (data) {
          const loadedAllocation = {
            emergency_pct: Number(data.emergency_pct) || 0,
            essentials_pct: Number(data.essentials_pct) || 0,
            invest_pct: Number(data.invest_pct) || 0,
            discretionary_pct: Number(data.discretionary_pct) || 0,
          };

          setAllocation(loadedAllocation);

          // Calculate and render current projections automatically on load
          const result =
            await financeApi.applyAllocationTemplate(loadedAllocation);
          setRecommendations(result);
        }
      } catch {
        setError("Could not load saved configuration. Showing default values.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndApplyTemplate();
  }, []);

  const totalPercentage =
    Number(allocation.emergency_pct) +
    Number(allocation.essentials_pct) +
    Number(allocation.invest_pct) +
    Number(allocation.discretionary_pct);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPercentage !== 100) {
      setError("Total allocation percentage must equal exactly 100%.");
      setMessage(null);
      return;
    }

    try {
      setError(null);
      setMessage(null);

      // 1. Save allocation ratios into AllocationTemplates table
      await financeApi.updateAllocationTemplate(allocation);

      // 2. Apply and update active MonthlyBudget row in database
      const result = await financeApi.applyAllocationTemplate(allocation);

      setRecommendations(result);
      setMessage(
        "Allocation rules saved to database and applied to active budget!",
      );
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(
        apiError?.response?.data?.error || "Failed to update allocation rule.",
      );
    }
  };

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
      >
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box m="20px">
      <Box mb="25px">
        <Typography variant="h3" fontWeight="bold" color={colors.grey[100]}>
          Income Allocation Rules
        </Typography>
        <Typography variant="subtitle1" color={colors.greenAccent[400]}>
          Set your "Pay Yourself First" rules to automatically route incoming
          earnings
        </Typography>
      </Box>

      <Stack spacing={2} mb={3}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {message && (
          <Alert severity="success" onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}
      </Stack>

      <Grid container spacing={3}>
        {/* Settings Form */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              backgroundColor: colors.primary[400],
              borderRadius: "12px",
              boxShadow: 3,
            }}
          >
            <CardContent>
              <Typography
                variant="h5"
                fontWeight="600"
                color={colors.grey[100]}
                mb={2}
              >
                Adjust Allocation Ratios
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <form onSubmit={handleSave}>
                <Stack spacing={3}>
                  <TextField
                    label="Emergency Fund (%)"
                    type="number"
                    variant="outlined"
                    fullWidth
                    value={allocation.emergency_pct}
                    onChange={(e) =>
                      setAllocation({
                        ...allocation,
                        emergency_pct: Number(e.target.value),
                      })
                    }
                    helperText="Recommended: 10% auto-deduction"
                  />

                  <TextField
                    label="Essentials & Bills (%)"
                    type="number"
                    variant="outlined"
                    fullWidth
                    value={allocation.essentials_pct}
                    onChange={(e) =>
                      setAllocation({
                        ...allocation,
                        essentials_pct: Number(e.target.value),
                      })
                    }
                  />

                  <TextField
                    label="Investments (%)"
                    type="number"
                    variant="outlined"
                    fullWidth
                    value={allocation.invest_pct}
                    onChange={(e) =>
                      setAllocation({
                        ...allocation,
                        invest_pct: Number(e.target.value),
                      })
                    }
                  />

                  <TextField
                    label="Discretionary / Personal Spend (%)"
                    type="number"
                    variant="outlined"
                    fullWidth
                    value={allocation.discretionary_pct}
                    onChange={(e) =>
                      setAllocation({
                        ...allocation,
                        discretionary_pct: Number(e.target.value),
                      })
                    }
                  />

                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      backgroundColor:
                        totalPercentage === 100
                          ? colors.greenAccent[800]
                          : colors.redAccent[800],
                      color: colors.grey[100],
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight="bold">
                      Total Target: {totalPercentage}%
                      {totalPercentage !== 100 && " (Must equal 100%)"}
                    </Typography>
                  </Paper>

                  <Button
                    type="submit"
                    variant="contained"
                    color="secondary"
                    size="large"
                    disabled={totalPercentage !== 100}
                    startIcon={<SaveOutlined />}
                    fullWidth
                    sx={{ py: 1.5, fontWeight: "bold" }}
                  >
                    Save & Apply Target Splits
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Live Calculation Output */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              backgroundColor: colors.primary[400],
              borderRadius: "12px",
              boxShadow: 3,
            }}
          >
            <CardContent>
              <Typography
                variant="h5"
                fontWeight="600"
                color={colors.grey[100]}
                mb={1}
              >
                Current Month Projections
              </Typography>
              <Typography variant="body2" color={colors.grey[300]} mb={3}>
                Recommended balance breakdown calculated from your logged
                Monthly Budget.
              </Typography>
              <Divider sx={{ mb: 3 }} />

              {recommendations ? (
                <Stack spacing={2}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: colors.primary[500],
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <ShieldOutlined color="info" />
                      <Typography variant="subtitle1" fontWeight="500">
                        Emergency Drop
                      </Typography>
                    </Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color={colors.blueAccent[300]}
                    >
                      {recommendations.recommendedEmergency.toLocaleString()}{" "}
                      RWF
                    </Typography>
                  </Paper>

                  <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: colors.primary[500],
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <AccountBalanceWalletOutlined color="secondary" />
                      <Typography variant="subtitle1" fontWeight="500">
                        Essentials Budget
                      </Typography>
                    </Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color={colors.grey[100]}
                    >
                      {recommendations.recommendedEssentials.toLocaleString()}{" "}
                      RWF
                    </Typography>
                  </Paper>

                  <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: colors.primary[500],
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <TrendingUpOutlined color="success" />
                      <Typography variant="subtitle1" fontWeight="500">
                        Investment Target
                      </Typography>
                    </Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color={colors.greenAccent[400]}
                    >
                      {recommendations.recommendedInvest.toLocaleString()} RWF
                    </Typography>
                  </Paper>

                  <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: colors.primary[500],
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <ShoppingBagOutlined color="warning" />
                      <Typography variant="subtitle1" fontWeight="500">
                        Discretionary Spend
                      </Typography>
                    </Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color={colors.greenAccent[300]}
                    >
                      {recommendations.recommendedDiscretionary.toLocaleString()}{" "}
                      RWF
                    </Typography>
                  </Paper>
                </Stack>
              ) : (
                <Box
                  p={4}
                  textAlign="center"
                  border={`2px dashed ${colors.grey[500]}`}
                  borderRadius="8px"
                >
                  <Typography variant="body1" color={colors.grey[300]}>
                    Save and apply your configuration to preview your
                    recommended income splits in RWF.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AllocationsPage;
