import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Typography,
  useTheme,
  CircularProgress,
  LinearProgress,
  Divider,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from "@mui/material";
import { Security, ShowChart, AccountBalance, Edit } from "@mui/icons-material";
import TransactionHistory from "./components/TransactionHistory";
import { tokens } from "../../assets/theme";
import { financeApi } from "../../services/api";

// 🚀 Explicitly typed interfaces perfectly aligned with your backend keys
interface SavingsGoal {
  id: number;
  goalName?: string;
  goal_name?: string;
  targetAmount?: number;
  target_amount?: number;
  currentSaved?: number; // 🔍 Fixed: perfectly maps to your live data key
  currentAmount?: number;
  current_amount?: number;
}

interface ActualInvestment {
  id: number;
  assetName?: string;
  asset_name?: string;
  assetType?: string;
  asset_type?: string;
  type?: string;
  principalAmount?: number;
  principal_amount?: number;
  principal_invested?: number | string;
  currentValue?: number | string;
  current_value?: number | string;
  value?: number | string;
}

export default function Investments() {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [savings, setSavings] = useState<SavingsGoal[]>([]);
  const [portfolios, setPortfolios] = useState<ActualInvestment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 🛠️ Added: Dialog Form Interface States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [activeAsset, setActiveAsset] = useState<ActualInvestment | null>(null);
  const [inputValue, setInputValue] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 🔄 Unified data gatherer extracted up so updates can trigger visual refreshes instantly
  const gatherVaultData = async () => {
    try {
      const secureApi = financeApi as typeof financeApi & {
        getSavingsGoals: () => Promise<SavingsGoal[]>;
        getActualInvestments: () => Promise<ActualInvestment[]>;
      };

      const [savingsData, investmentData] = await Promise.all([
        secureApi.getSavingsGoals
          ? secureApi.getSavingsGoals()
          : Promise.resolve([]),
        secureApi.getActualInvestments
          ? secureApi.getActualInvestments()
          : Promise.resolve([]),
      ]);

      setSavings(savingsData);
      setPortfolios(investmentData);
    } catch (err) {
      console.error("Wealth vault pipeline failure:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    gatherVaultData();
  }, []);

  // 🛠️ Added: Dialog Interactive Handlers
  const handleOpenEdit = (asset: ActualInvestment) => {
    const valueResolver =
      asset.current_value ?? asset.currentValue ?? asset.value ?? 5000;
    setActiveAsset(asset);
    setInputValue(Number(valueResolver).toString());
    setIsModalOpen(true);
  };

  const handleCloseEdit = () => {
    setIsModalOpen(false);
    setActiveAsset(null);
    setInputValue("");
  };

  const handleValuationSubmit = async () => {
    if (!activeAsset || !inputValue) return;

    try {
      setSubmitting(true);
      const secureApi = financeApi as typeof financeApi & {
        updateInvestmentValue: (id: number, value: number) => Promise<void>;
      };

      if (secureApi.updateInvestmentValue) {
        await secureApi.updateInvestmentValue(
          activeAsset.id,
          Number(inputValue),
        );
      }

      await gatherVaultData(); // Triggers live state sync across layout interfaces
      handleCloseEdit();
    } catch (err) {
      console.error("Failed to update asset value:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Box sx={{ padding: 2 }}>
        <Box sx={{ paddingBlock: 2, width: "100%" }}>
          <Typography variant="h1">Investments</Typography>
          <Typography variant="h6" sx={{ color: colors.grey[400] }}>
            Maximize your investment potential with real-time tracking
          </Typography>
        </Box>

        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="40vh"
          >
            <CircularProgress color="info" />
          </Box>
        ) : (
          <Grid container spacing={2} sx={{ width: "100%" }}>
            {/* 🛡️ Full Width Row: Secure Savings Target Performance */}
            <Grid item xs={12}>
              <Box
                sx={{
                  backgroundColor: colors.primary[400],
                  borderRadius: "4px",
                  boxShadow: 4,
                  p: 3,
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 600,
                    mb: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Security sx={{ color: colors.greenAccent[600] }} /> Cash
                  Reserves & Target Goals
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={2}>
                  {savings.length === 0 ? (
                    <Grid item xs={12}>
                      <Typography
                        variant="body2"
                        sx={{ color: colors.grey[400], py: 1 }}
                      >
                        No active secure cash targets logged.
                      </Typography>
                    </Grid>
                  ) : (
                    savings.map((goal) => {
                      const name =
                        goal.goalName ?? goal.goal_name ?? "Unnamed Goal";
                      const target = Number(
                        goal.targetAmount ?? goal.target_amount ?? 0,
                      );
                      // 🔄 Resolves exactly to your live database property
                      const current = Number(
                        goal.currentSaved ??
                          goal.currentAmount ??
                          goal.current_amount ??
                          0,
                      );

                      const percentageCalculation =
                        target > 0 ? (current / target) * 100 : 0;

                      return (
                        <Grid item xs={12} sm={6} md={4} key={goal.id}>
                          <Box
                            sx={{
                              backgroundColor: "rgba(0,0,0,0.15)",
                              p: 2,
                              borderRadius: "4px",
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mb: 1 }}
                            >
                              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                {name}
                              </Typography>
                              <AccountBalance
                                sx={{ color: colors.greenAccent[600] }}
                              />
                            </Stack>
                            <Typography
                              variant="h3"
                              sx={{ my: 1, fontWeight: 700 }}
                            >
                              {current.toLocaleString()} RWF
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ color: colors.grey[400], mb: 1.5 }}
                            >
                              Target: {target.toLocaleString()} RWF
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(percentageCalculation, 100)}
                              color="success"
                              sx={{ height: 6, borderRadius: 2 }}
                            />
                            <Typography
                              variant="caption"
                              display="block"
                              sx={{
                                mt: 0.5,
                                textAlign: "right",
                                color: colors.grey[400],
                              }}
                            >
                              {Math.round(percentageCalculation)}% Secured
                            </Typography>
                          </Box>
                        </Grid>
                      );
                    })
                  )}
                </Grid>
              </Box>
            </Grid>

            {/* 📈 Left Column: Live Compound Investment Portfolios */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  backgroundColor: colors.primary[400],
                  borderRadius: "4px",
                  boxShadow: 4,
                  p: 3,
                  height: "100%",
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 600,
                    mb: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <ShowChart sx={{ color: colors.greenAccent[600] }} /> Active
                  Growth Holdings
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Stack spacing={2}>
                  {portfolios.length === 0 ? (
                    <Typography
                      variant="body2"
                      sx={{ color: colors.grey[400], py: 1 }}
                    >
                      No performance growth positions recorded.
                    </Typography>
                  ) : (
                    portfolios.map((asset) => {
                      const assetName =
                        asset.assetName ?? asset.asset_name ?? "Unknown Asset";

                      // 🛠️ Adjustments applied right here to prevent standard fallback label execution
                      const assetType =
                        assetName === "Shift Rollover Portfolio"
                          ? "Business Capital"
                          : (asset.type ??
                            asset.assetType ??
                            asset.asset_type ??
                            "Bond");

                      const currentValue = Number(
                        asset.current_value ??
                          asset.currentValue ??
                          asset.value ??
                          5000,
                      );
                      const principalAmount = Number(
                        asset.principal_invested ??
                          asset.principal_amount ??
                          asset.principalAmount ??
                          0,
                      );

                      const growthMargin = currentValue - principalAmount;
                      const isUp = growthMargin >= 0;

                      return (
                        <Box
                          key={asset.id}
                          sx={{
                            py: 1.5,
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Box>
                              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                {assetName}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: colors.grey[400],
                                  textTransform: "uppercase",
                                }}
                              >
                                {assetType}
                              </Typography>
                            </Box>

                            {/* 🛠️ Modern Interlocking Input Stack */}
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={1}
                            >
                              <Box sx={{ textAlign: "right" }}>
                                <Typography
                                  variant="h4"
                                  sx={{ fontWeight: 700 }}
                                >
                                  {currentValue.toLocaleString()} RWF
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: isUp
                                      ? colors.greenAccent[500]
                                      : "#f44336",
                                    fontWeight: 600,
                                  }}
                                >
                                  {isUp ? "+" : ""}
                                  {growthMargin.toLocaleString()} RWF Return
                                </Typography>
                              </Box>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenEdit(asset)}
                                sx={{
                                  color: colors.grey[300],
                                  "&:hover": { color: colors.greenAccent[500] },
                                }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })
                  )}
                </Stack>
              </Box>
            </Grid>

            {/* 📑 Right Column: Prebuilt Transaction History Log */}
            <Grid item xs={12} md={6}>
              <TransactionHistory />
            </Grid>
          </Grid>
        )}
      </Box>

      {/* 📊 Added: Safe Manual Update Modal Layout */}
      <Dialog
        open={isModalOpen}
        onClose={handleCloseEdit}
        PaperProps={{
          sx: {
            backgroundColor: colors.primary[400],
            backgroundImage: "none",
            minWidth: "320px",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Update Current Value</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: colors.grey[300], mb: 2 }}>
            Enter the current evaluated market value for{" "}
            <strong>{activeAsset?.assetName ?? activeAsset?.asset_name}</strong>
            .
          </Typography>
          <TextField
            fullWidth
            type="number"
            label="Current Value (RWF)"
            variant="outlined"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={submitting}
            autoFocus
            InputLabelProps={{ style: { color: colors.grey[200] } }}
            inputProps={{ style: { color: "#ffffff" } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={handleCloseEdit}
            disabled={submitting}
            sx={{ color: colors.grey[200] }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleValuationSubmit}
            variant="contained"
            color="success"
            disabled={submitting || !inputValue}
          >
            {submitting ? "Updating..." : "Save Value"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
