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
  Chip,
  Stack,
  useTheme,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Shield, Work, LocalOffer } from "@mui/icons-material";
import { tokens } from "../assets/theme";
import { financeApi } from "../services/api";
import type { PendingEmergencySnapshot } from "../types/api";

interface PendingEmergencyWidgetProps {
  onDepositSuccess?: () => void;
}

export default function PendingEmergencyWidget({
  onDepositSuccess,
}: PendingEmergencyWidgetProps) {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [snapshot, setSnapshot] =
    useState<PendingEmergencySnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchPendingSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      const data = await financeApi.getPendingEmergency();
      setSnapshot(data);
    } catch (err) {
      console.error("Failed to load pending emergency snapshot:", err);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingSnapshot();
  }, [fetchPendingSnapshot]);

  const handleOpenModal = () => {
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
      setFeedback(null);
    }
  };

  const handleDepositConfirm = async () => {
    if (!snapshot?.pending || snapshot.totalAmount <= 0) return;

    try {
      setIsSubmitting(true);
      setFeedback(null);

      const res = await financeApi.claimPendingEmergency();
      setFeedback({
        type: "success",
        message: res.message || "Emergency Reserve transfer completed!",
      });

      await fetchPendingSnapshot();
      onDepositSuccess?.();

      setTimeout(() => {
        setIsModalOpen(false);
        setFeedback(null);
      }, 900);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Failed to transfer the pending Emergency Reserve amount.";
      setFeedback({ type: "error", message: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalTarget = Number(snapshot?.totalAmount || 0);
  const salaryPortion = Number(snapshot?.salaryPortion || 0);
  const sidePortion = Number(snapshot?.sideIncomePortion || 0);

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
              Frozen at Reset Month
            </Typography>
          </Stack>

          {loading ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={28} color="secondary" />
            </Box>
          ) : !snapshot?.pending ? (
            <Typography
              variant="body1"
              sx={{ color: colors.grey[400], py: 2, fontWeight: 600 }}
            >
              No pending Emergency Reserve target.
            </Typography>
          ) : (
            <>
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

              {snapshot.monthLabel && (
                <Typography
                  variant="body2"
                  sx={{ color: colors.grey[400], mb: 1.25 }}
                >
                  Snapshot: {snapshot.monthLabel}
                </Typography>
              )}

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

        <Button
          variant="contained"
          color="secondary"
          fullWidth
          disabled={loading || !snapshot?.pending || totalTarget <= 0}
          onClick={handleOpenModal}
          sx={{
            mt: 2.5,
            fontWeight: 700,
            textTransform: "none",
            py: 1,
            borderRadius: "6px",
          }}
        >
          Migrate to Emergency Reserve
        </Button>
      </Box>

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
          <Shield /> Migrate Pending Emergency Target
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: colors.grey[200], mb: 2 }}>
            This transfer uses the frozen amount created at Reset Month. It does
            not recalculate from your current Allocations settings.
          </DialogContentText>

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
              Frozen transfer amount:
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: colors.greenAccent[400],
                mb: 1.5,
              }}
            >
              {totalTarget.toLocaleString()} RWF
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
            onClick={handleDepositConfirm}
            variant="contained"
            color="secondary"
            disabled={isSubmitting || totalTarget <= 0}
            sx={{ textTransform: "none", fontWeight: 700, px: 3 }}
          >
            {isSubmitting
              ? "Migrating..."
              : `Migrate ${totalTarget.toLocaleString()} RWF`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
