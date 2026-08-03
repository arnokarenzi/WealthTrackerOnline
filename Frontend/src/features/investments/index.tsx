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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from "@mui/material";
import {
  Security,
  ShowChart,
  AccountBalance,
  Edit,
  SwapHoriz,
} from "@mui/icons-material";
import { tokens } from "../../assets/theme";
import { financeApi } from "../../services/api";

interface CashReserveItem {
  current: number;
  target: number;
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

interface SavingsGoal {
  goalName?: string;
  goal_name?: string;
  targetAmount?: number | string;
}

interface RawReserveData {
  id?: number;
  amount?: number | string;
  current_amount?: number | string;
  currentAmount?: number | string;
  target_amount?: number | string;
  targetAmount?: number | string;
  cumulative?: number | string;
  amountSaved?: number | string;
  [key: string]: unknown;
}

export default function Investments() {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [reserves, setReserves] = useState<{ [key: string]: CashReserveItem }>({
    Emergency: { current: 0, target: 1000000 },
    "School Fees": { current: 0, target: 500000 },
    Investments: { current: 0, target: 2000000 },
  });

  const [portfolios, setPortfolios] = useState<ActualInvestment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Growth Asset Valuation Edit Modal States
  const [isAssetModalOpen, setIsAssetModalOpen] = useState<boolean>(false);
  const [activeAsset, setActiveAsset] = useState<ActualInvestment | null>(null);
  const [assetInputValue, setAssetInputValue] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reserve Deduction / Asset Deploy Modal States
  const [isDeployModalOpen, setIsDeployModalOpen] = useState<boolean>(false);
  const [deployForm, setDeployForm] = useState({
    assetName: "",
    assetType: "Bond",
    amount: "",
  });
  const [deployError, setDeployError] = useState<string | null>(null);

  const normalizeData = (data: unknown): RawReserveData => {
    if (Array.isArray(data)) {
      return (data[data.length - 1] || data[0] || {}) as RawReserveData;
    }
    return (data || {}) as RawReserveData;
  };

  const gatherVaultData = useCallback(async () => {
    try {
      const [
        emergencyData,
        schoolData,
        investmentReserveData,
        investmentData,
        savingsGoalsData,
      ] = await Promise.all([
        financeApi.getEmergencyFund().catch(() => null),
        financeApi.getSchoolFees().catch(() => null),
        financeApi.getInvestmentReserve().catch(() => null),
        financeApi.getActualInvestments().catch(() => []),
        financeApi.getSavingsGoals().catch(() => []),
      ]);

      const resolveTarget = (
        keyword: string,
        fallbackTarget: number,
        directTarget?: number | string,
      ): number => {
        if (
          directTarget &&
          !isNaN(Number(directTarget)) &&
          Number(directTarget) > 0
        ) {
          return Number(directTarget);
        }

        const matchedGoal = ((savingsGoalsData as SavingsGoal[]) || []).find(
          (g: SavingsGoal) => {
            const name = (g.goalName ?? g.goal_name ?? "").toLowerCase();
            return name.includes(keyword);
          },
        );

        if (matchedGoal) {
          const goalTarget = Number(matchedGoal.targetAmount ?? 0);
          if (goalTarget > 0) return goalTarget;
        }

        return fallbackTarget;
      };

      const emergencyObj = normalizeData(emergencyData);
      const schoolObj = normalizeData(schoolData);
      const investmentReserveObj = normalizeData(investmentReserveData);

      setReserves({
        Emergency: {
          current: Number(
            emergencyObj.current_amount ??
              emergencyObj.currentAmount ??
              emergencyObj.amount ??
              0,
          ),
          target: resolveTarget(
            "emergency",
            1000000,
            emergencyObj.target_amount ?? emergencyObj.targetAmount,
          ),
        },
        "School Fees": {
          current: Number(
            schoolObj.cumulative ??
              schoolObj.amountSaved ??
              schoolObj.current_amount ??
              schoolObj.amount ??
              0,
          ),
          target: resolveTarget(
            "school",
            500000,
            schoolObj.target_amount ?? schoolObj.targetAmount,
          ),
        },
        Investments: {
          current: Number(
            investmentReserveObj.amount ??
              investmentReserveObj.current_amount ??
              investmentReserveObj.currentAmount ??
              0,
          ),
          target: resolveTarget(
            "invest",
            2000000,
            investmentReserveObj.target_amount ??
              investmentReserveObj.targetAmount,
          ),
        },
      });

      setPortfolios((investmentData as ActualInvestment[]) || []);
    } catch (err) {
      console.error("Wealth vault pipeline failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    gatherVaultData();

    window.addEventListener("focus", gatherVaultData);
    return () => window.removeEventListener("focus", gatherVaultData);
  }, [gatherVaultData]);

  // Growth Asset Edit Handlers
  const handleOpenAssetEdit = (asset: ActualInvestment) => {
    const valueResolver =
      asset.current_value ?? asset.currentValue ?? asset.value ?? 0;
    setActiveAsset(asset);
    setAssetInputValue(Number(valueResolver).toString());
    setIsAssetModalOpen(true);
  };

  const handleCloseAssetEdit = () => {
    setIsAssetModalOpen(false);
    setActiveAsset(null);
    setAssetInputValue("");
  };

  const handleAssetValuationSubmit = async () => {
    if (!activeAsset || !assetInputValue) return;

    try {
      setSubmitting(true);
      await financeApi.updateInvestmentValue(
        activeAsset.id,
        Number(assetInputValue),
      );

      await gatherVaultData();
      handleCloseAssetEdit();
    } catch (err) {
      console.error("Failed to update asset value:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Reserve Deduction Handlers
  const handleOpenDeployModal = () => {
    setDeployForm({ assetName: "", assetType: "Bond", amount: "" });
    setDeployError(null);
    setIsDeployModalOpen(true);
  };

  const handleCloseDeployModal = () => {
    setIsDeployModalOpen(false);
    setDeployError(null);
  };

  const handleDeploySubmit = async () => {
    const amountNum = Number(deployForm.amount);
    if (!deployForm.assetName || isNaN(amountNum) || amountNum <= 0) {
      setDeployError("Please enter a valid asset name and positive amount.");
      return;
    }

    const currentReserveBalance = reserves["Investments"]?.current || 0;
    if (amountNum > currentReserveBalance) {
      setDeployError(
        `Amount exceeds current reserve balance of ${currentReserveBalance.toLocaleString()} RWF.`,
      );
      return;
    }

    try {
      setSubmitting(true);
      setDeployError(null);

      await financeApi.deployInvestmentReserve({
        assetName: deployForm.assetName,
        amount: amountNum,
        assetType: deployForm.assetType,
      });

      await gatherVaultData();
      handleCloseDeployModal();
    } catch (err) {
      console.error("Failed to deploy funds:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to deploy funds.";
      const apiError = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setDeployError(apiError || errorMessage || "Failed to deploy funds.");
    } finally {
      setSubmitting(false);
    }
  };

  const fixedCategories = [
    { title: "Emergency" },
    { title: "School Fees" },
    { title: "Investments" },
  ];

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
            {/* 🛡️ Cash Reserves & Target Goals */}
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
                  {fixedCategories.map((cat) => {
                    const data = reserves[cat.title] || {
                      current: 0,
                      target: 100000,
                    };
                    const current = data.current;
                    const target = data.target;
                    const percentageCalculation =
                      target > 0 ? (current / target) * 100 : 0;
                    const isInvestCard = cat.title === "Investments";

                    return (
                      <Grid item xs={12} sm={6} md={4} key={cat.title}>
                        <Box
                          sx={{
                            backgroundColor: "rgba(0,0,0,0.15)",
                            p: 2.5,
                            borderRadius: "4px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            height: "100%",
                          }}
                        >
                          <Box>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mb: 1 }}
                            >
                              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                {cat.title}
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

                          {isInvestCard && (
                            <Button
                              variant="outlined"
                              color="success"
                              size="small"
                              startIcon={<SwapHoriz />}
                              onClick={handleOpenDeployModal}
                              sx={{
                                mt: 2,
                                textTransform: "none",
                                fontWeight: 600,
                                borderColor: colors.greenAccent[500],
                                color: colors.greenAccent[400],
                                "&:hover": {
                                  borderColor: colors.greenAccent[400],
                                  backgroundColor: "rgba(76, 206, 172, 0.08)",
                                },
                              }}
                            >
                              Deduct & Deploy Cash
                            </Button>
                          )}
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            </Grid>

            {/* 📈 Active Growth Holdings */}
            <Grid item xs={12}>
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
                          0,
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
                                onClick={() => handleOpenAssetEdit(asset)}
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
          </Grid>
        )}
      </Box>

      {/* 📊 Modal for Editing Growth Asset Valuations */}
      <Dialog
        open={isAssetModalOpen}
        onClose={handleCloseAssetEdit}
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
            value={assetInputValue}
            onChange={(e) => setAssetInputValue(e.target.value)}
            disabled={submitting}
            autoFocus
            InputLabelProps={{ style: { color: colors.grey[200] } }}
            inputProps={{ style: { color: "#ffffff" } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={handleCloseAssetEdit}
            disabled={submitting}
            sx={{ color: colors.grey[200] }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssetValuationSubmit}
            variant="contained"
            color="success"
            disabled={submitting || !assetInputValue}
          >
            {submitting ? "Updating..." : "Save Value"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 💸 Modal for Deducting from Investment Reserve & Creating Asset */}
      <Dialog
        open={isDeployModalOpen}
        onClose={handleCloseDeployModal}
        PaperProps={{
          sx: {
            backgroundColor: colors.primary[400],
            backgroundImage: "none",
            minWidth: "340px",
            maxWidth: "450px",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Deduct & Deploy Investment Cash
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: colors.grey[300], mb: 2 }}>
            Specify how much to deduct from your{" "}
            <strong>Investments Reserve</strong> (
            {(reserves["Investments"]?.current || 0).toLocaleString()} RWF
            available) to deploy into an asset position.
          </Typography>

          {deployError && (
            <Box
              sx={{
                p: 1.5,
                mb: 2,
                borderRadius: "4px",
                backgroundColor: "rgba(244, 67, 54, 0.15)",
                border: "1px solid #f44336",
              }}
            >
              <Typography variant="caption" sx={{ color: "#f44336" }}>
                {deployError}
              </Typography>
            </Box>
          )}

          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              type="number"
              label="Amount to Deduct (RWF)"
              variant="outlined"
              value={deployForm.amount}
              onChange={(e) =>
                setDeployForm({ ...deployForm, amount: e.target.value })
              }
              disabled={submitting}
              autoFocus
              InputLabelProps={{ style: { color: colors.grey[200] } }}
              inputProps={{ style: { color: "#ffffff" } }}
            />
            <TextField
              fullWidth
              label="Asset Name (e.g., Rwanda Treasury Bond 2026)"
              variant="outlined"
              value={deployForm.assetName}
              onChange={(e) =>
                setDeployForm({ ...deployForm, assetName: e.target.value })
              }
              disabled={submitting}
              InputLabelProps={{ style: { color: colors.grey[200] } }}
              inputProps={{ style: { color: "#ffffff" } }}
            />
            <TextField
              fullWidth
              label="Asset Type (e.g., Bond, Stock, Real Estate)"
              variant="outlined"
              value={deployForm.assetType}
              onChange={(e) =>
                setDeployForm({ ...deployForm, assetType: e.target.value })
              }
              disabled={submitting}
              InputLabelProps={{ style: { color: colors.grey[200] } }}
              inputProps={{ style: { color: "#ffffff" } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={handleCloseDeployModal}
            disabled={submitting}
            sx={{ color: colors.grey[200] }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeploySubmit}
            variant="contained"
            color="success"
            disabled={submitting || !deployForm.amount || !deployForm.assetName}
          >
            {submitting ? "Deducting..." : "Confirm Deduction"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
