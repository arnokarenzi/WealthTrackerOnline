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

export default function Investments() {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  // Specialized Liquid Cash Reserves
  const [reserves, setReserves] = useState<{ [key: string]: CashReserveItem }>({
    Emergency: { current: 0, target: 1000000 },
    "School Fees": { current: 0, target: 500000 },
    Investments: { current: 0, target: 2000000 },
  });

  const [portfolios, setPortfolios] = useState<ActualInvestment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Growth Asset Modal States
  const [isAssetModalOpen, setIsAssetModalOpen] = useState<boolean>(false);
  const [activeAsset, setActiveAsset] = useState<ActualInvestment | null>(null);
  const [assetInputValue, setAssetInputValue] = useState<string>("");

  // Cash Reserve Modal States
  const [isReserveModalOpen, setIsReserveModalOpen] = useState<boolean>(false);
  const [activeCategoryTitle, setActiveCategoryTitle] = useState<string>("");
  const [reserveInputValue, setReserveInputValue] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);

  const gatherVaultData = async () => {
    try {
      const secureApi = financeApi as typeof financeApi & {
        getEmergencyFund?: () => Promise<{
          current_amount?: number;
          target_amount?: number;
        }>;
        getSchoolFees?: () => Promise<{ cumulative?: number }>;
        getActualInvestments: () => Promise<ActualInvestment[]>;
      };

      const [emergencyData, schoolData, investmentData] = await Promise.all([
        secureApi.getEmergencyFund
          ? secureApi.getEmergencyFund()
          : Promise.resolve({ current_amount: 0 }),
        secureApi.getSchoolFees
          ? secureApi.getSchoolFees()
          : Promise.resolve({ cumulative: 0 }),
        secureApi.getActualInvestments
          ? secureApi.getActualInvestments()
          : Promise.resolve([]),
      ]);

      setReserves((prev) => ({
        ...prev,
        Emergency: {
          ...prev.Emergency,
          current: Number(emergencyData?.current_amount || 0),
        },
        "School Fees": {
          ...prev["School Fees"],
          current: Number(schoolData?.cumulative || 0),
        },
      }));

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
      const secureApi = financeApi as typeof financeApi & {
        updateInvestmentValue: (id: number, value: number) => Promise<void>;
      };

      if (secureApi.updateInvestmentValue) {
        await secureApi.updateInvestmentValue(
          activeAsset.id,
          Number(assetInputValue),
        );
      }

      await gatherVaultData();
      handleCloseAssetEdit();
    } catch (err) {
      console.error("Failed to update asset value:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Fixed Cash Reserve Edit Handlers
  const handleOpenReserveEdit = (categoryTitle: string) => {
    setActiveCategoryTitle(categoryTitle);
    const currentVal = reserves[categoryTitle]?.current || 0;
    setReserveInputValue(String(currentVal));
    setIsReserveModalOpen(true);
  };

  const handleCloseReserveEdit = () => {
    setIsReserveModalOpen(false);
    setActiveCategoryTitle("");
    setReserveInputValue("");
  };

  const handleReserveSubmit = async () => {
    if (!reserveInputValue || !activeCategoryTitle) return;

    try {
      setSubmitting(true);
      const val = Number(reserveInputValue);

      // Explicit API requests to persist data in the database
      if (activeCategoryTitle === "Emergency") {
        await fetch("/api/emergency", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ current_amount: val }),
        });
      } else if (activeCategoryTitle === "School Fees") {
        await fetch("/api/school-fees", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountSaved: val }),
        });
      } else if (activeCategoryTitle === "Investments") {
        await fetch("/api/investments/reserve", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: val }),
        });
      }

      await gatherVaultData();
      handleCloseReserveEdit();
    } catch (err) {
      console.error("Failed to update specialized reserve in database:", err);
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
            {/* 🛡️ Full Width Row: Fixed Cash Reserves & Target Goals */}
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

                    return (
                      <Grid item xs={12} sm={6} md={4} key={cat.title}>
                        <Box
                          sx={{
                            backgroundColor: "rgba(0,0,0,0.15)",
                            p: 2.5,
                            borderRadius: "4px",
                            position: "relative",
                          }}
                        >
                          <Box
                            sx={{ position: "absolute", top: 12, right: 12 }}
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleOpenReserveEdit(cat.title)}
                              sx={{
                                color: colors.grey[300],
                                "&:hover": { color: colors.greenAccent[500] },
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Box>

                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 1, pr: 3 }}
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
                      </Grid>
                    );
                  })}
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

            {/* 📑 Right Column: Prebuilt Transaction History Log */}
            <Grid item xs={12} md={6}>
              <TransactionHistory />
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

      {/* 🛡️ Modal for Direct Editing of Cash Reserves */}
      <Dialog
        open={isReserveModalOpen}
        onClose={handleCloseReserveEdit}
        PaperProps={{
          sx: {
            backgroundColor: colors.primary[400],
            backgroundImage: "none",
            minWidth: "320px",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Update {activeCategoryTitle} Reserve
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: colors.grey[300], mb: 2 }}>
            Set or adjust the current saved amount for{" "}
            <strong>{activeCategoryTitle}</strong>.
          </Typography>
          <TextField
            fullWidth
            type="number"
            label="Current Amount (RWF)"
            variant="outlined"
            value={reserveInputValue}
            onChange={(e) => setReserveInputValue(e.target.value)}
            disabled={submitting}
            autoFocus
            InputLabelProps={{ style: { color: colors.grey[200] } }}
            inputProps={{ style: { color: "#ffffff" } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={handleCloseReserveEdit}
            disabled={submitting}
            sx={{ color: colors.grey[200] }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReserveSubmit}
            variant="contained"
            color="success"
            disabled={submitting || !reserveInputValue}
          >
            {submitting ? "Saving..." : "Save Reserve"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
