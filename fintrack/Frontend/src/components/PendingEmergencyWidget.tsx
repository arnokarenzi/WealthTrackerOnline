import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Chip,
  Stack,
  useTheme,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Shield, Work, LocalOffer } from "@mui/icons-material";
import { tokens } from "../assets/theme";
import { financeApi } from "../services/api";
import type { AllocationResponse } from "../types/api";

interface PendingEmergencyWidgetProps {
  onDepositSuccess?: () => void;
}

export default function PendingEmergencyWidget({
  onDepositSuccess,
}: PendingEmergencyWidgetProps) {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [allocation, setAllocation] = useState<AllocationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Dialog & Form state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [overrideAmount, setOverrideAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchAllocationData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await financeApi.getAllocations();
      setAllocation(data);
    } catch (err) {
      console.error("Failed to load emergency allocation breakdown:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllocationData();
  }, [fetchAllocationData]);

  const handleOpenModal = () => {
    const target = allocation?.recommendedEmergency ?? 0;
    setOverrideAmount(target > 0 ? String(target) : "");
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
      setFeedback(null);
    }
  };

  const handleDepositConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountToDeposit = parseFloat(overrideAmount);

    if (isNaN(amountToDeposit) || amountToDeposit <= 0) {
      setFeedback({
        type: "error",
        message: "Please enter a valid deposit amount greater than zero.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);

      const res = await financeApi.depositEmergency(amountToDeposit);

      setFeedback({
        type: "success",
        message: res.message || "Deposit logged successfully!",
      });

      // Refresh parent dashboard and local widget allocations
      if (onDepositSuccess) onDepositSuccess();
      await fetchAllocationData();

      setTimeout(() => {
        setIsModalOpen(false);
      }, 1200);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to record deposit.";
      setFeedback({ type: "error", message: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalTarget = allocation?.recommendedEmergency ?? 0;
  const salaryPortion = allocation?.emergencySalaryPortion ?? 0;
  const sidePortion = allocation?.emergencySidePortion ?? 0;

  return (
    <>
      <Box
        sx={{
          backgroundColor: colors.primary[400],
          borderRadius: "8px",
          p: 2.5,
          boxShadow: 3,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Box>
          {/* Header */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1.5 }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Shield sx={{ color: colors.greenAccent[500], fontSize: 24 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Pending Emergency Target
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: colors.grey[400] }}>
              Monthly Allocation
            </Typography>
          </Stack>

          {loading ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={28} color="secondary" />
            </Box>
          ) : (
            <>
              {/* Total Calculated Amount */}
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 800,
                  color: colors.greenAccent[400],
                  mb: 1.5,
                }}
              >
                {totalTarget.toLocaleString()} RWF
              </Typography>

              {/* Source Breakdown Badges */}
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                sx={{ gap: 1 }}
              >
                <Chip
                  icon={<Work style={{ fontSize: 16 }} />}
                  label={`From Salary: ${salaryPortion.toLocaleString()} RWF`}
                  size="small"
                  sx={{
                    backgroundColor: colors.primary[500],
                    color: colors.grey[100],
                    fontWeight: 600,
                    border: `1px solid ${colors.grey[700]}`,
                  }}
                />
                <Chip
                  icon={<LocalOffer style={{ fontSize: 16 }} />}
                  label={`From Side Income: ${sidePortion.toLocaleString()} RWF`}
                  size="small"
                  sx={{
                    backgroundColor: colors.primary[500],
                    color: colors.greenAccent[300],
                    fontWeight: 600,
                    border: `1px solid ${colors.greenAccent[700]}`,
                  }}
                />
              </Stack>
            </>
          )}
        </Box>

        {/* Action Button */}
        <Button
          variant="contained"
          color="secondary"
          fullWidth
          disabled={loading}
          onClick={handleOpenModal}
          sx={{
            mt: 2.5,
            fontWeight: 700,
            textTransform: "none",
            py: 1,
            borderRadius: "6px",
          }}
        >
          Deposit to Emergency Reserve
        </Button>
      </Box>

      {/* Override & Confirmation Dialog */}
      <Dialog
        open={isModalOpen}
        onClose={handleCloseModal}
        PaperProps={{
          sx: {
            backgroundColor: colors.primary[400],
            padding: 1.5,
            minWidth: "400px",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            color: colors.greenAccent[500],
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Shield /> Deposit to Emergency Reserve
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: colors.grey[200], mb: 2 }}>
            Confirm or override the calculated allocation to transfer into your
            Emergency Reserve pool.
          </DialogContentText>

          {/* Breakdown Summary Inside Modal */}
          <Box
            sx={{
              backgroundColor: colors.primary[500],
              p: 2,
              borderRadius: "6px",
              mb: 2.5,
              border: `1px solid ${colors.grey[700]}`,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, color: colors.grey[300], mb: 1 }}
            >
              Calculated Breakdown:
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2" sx={{ color: colors.grey[200] }}>
                💼 <strong>From Salary:</strong>{" "}
                {salaryPortion.toLocaleString()} RWF
              </Typography>
              <Typography variant="body2" sx={{ color: colors.grey[200] }}>
                💸 <strong>From Side Income:</strong>{" "}
                {sidePortion.toLocaleString()} RWF
              </Typography>
            </Stack>
          </Box>

          {feedback && (
            <Alert severity={feedback.type} sx={{ mb: 2 }}>
              {feedback.message}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleDepositConfirm}
            id="emergency-deposit-form"
          >
            <TextField
              label="Deposit Amount (RWF)"
              type="number"
              variant="outlined"
              fullWidth
              required
              value={overrideAmount}
              onChange={(e) => setOverrideAmount(e.target.value)}
              disabled={isSubmitting}
              helperText="You can override this number to deposit a custom amount."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseModal}
            disabled={isSubmitting}
            sx={{ color: colors.grey[100], textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="emergency-deposit-form"
            variant="contained"
            color="secondary"
            disabled={isSubmitting || !overrideAmount}
            sx={{ textTransform: "none", fontWeight: 700, px: 3 }}
          >
            {isSubmitting ? "Depositing..." : "Confirm & Deposit"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
