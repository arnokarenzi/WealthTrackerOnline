import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Typography,
  useTheme,
} from "@mui/material";
import { CheckCircleOutline, PendingActions } from "@mui/icons-material";
import { tokens } from "../assets/theme";
import { financeApi } from "../services/api";
import type { FriendPortalPendingPayout } from "../types/api";
import { formatKigaliDate } from "../utils/kigaliTime";

const formatRwf = (amount: number) =>
  `${Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} RWF`;

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return error instanceof Error ? error.message : "An unexpected error occurred.";
};

export default function PendingFriendPortalPayoutsWidget({
  onClaimSuccess,
}: {
  onClaimSuccess: () => void;
}) {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [pendingList, setPendingList] = useState<FriendPortalPendingPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const data = await financeApi.getPendingFriendPortalPayouts();
      setPendingList(data || []);
    } catch (error) {
      console.error("Failed to load pending friend-portal payouts:", error);
      setActionError("Could not load pending friend-portal payouts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const handleClaim = async (item: FriendPortalPendingPayout) => {
    const confirmed = window.confirm(
      `Confirm that your friend has sent you ${formatRwf(item.amount)} for ${item.shiftStart} to ${item.shiftEnd}?\n\n` +
      "Only confirm after the money has actually reached you. This will add the amount to your FinTrack wallet.",
    );
    if (!confirmed) return;

    setActionError(null);
    setClaimingId(item.id);
    try {
      await financeApi.claimFriendPortalPayout(item.id);
      await fetchPending();
      onClaimSuccess();
    } catch (error) {
      console.error("Error depositing friend-portal payout:", error);
      setActionError(getErrorMessage(error));
    } finally {
      setClaimingId(null);
    }
  };

  if (!loading && pendingList.length === 0 && !actionError) return null;

  return (
    <Paper
      sx={{
        backgroundColor: colors.primary[400],
        padding: 2.5,
        boxShadow: 4,
        mb: 3,
        height: "100%",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <PendingActions sx={{ color: colors.greenAccent[500], fontSize: "1.8rem" }} />
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Pending Friend Portal Payouts
        </Typography>
      </Box>

      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress color="secondary" size={30} />
        </Box>
      ) : pendingList.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          No pending friend-portal payments are waiting to be received.
        </Typography>
      ) : (
        <List sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {pendingList.map((item) => (
            <ListItem
              key={item.id}
              sx={{
                backgroundColor: colors.primary[500],
                borderRadius: "4px",
                border: `1px solid ${colors.greenAccent[600]}`,
                pr: 2,
                minHeight: 96,
              }}
            >
              <ListItemText
                primary={item.description}
                secondary={
                  `Shift: ${item.shiftStart} to ${item.shiftEnd} · ` +
                  `${item.totalLetters.toLocaleString()} total letters · ` +
                  `${item.payableLetters.toLocaleString()} payable letters · ` +
                  `Reset: ${formatKigaliDate(item.resetAt)}`
                }
                primaryTypographyProps={{ fontWeight: 600, color: colors.grey[100] }}
                secondaryTypographyProps={{ color: colors.grey[300] }}
              />
              <ListItemSecondaryAction sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: colors.greenAccent[400], whiteSpace: "nowrap" }}>
                  {formatRwf(item.amount)}
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  size="small"
                  startIcon={claimingId === item.id ? <CircularProgress size={14} /> : <CheckCircleOutline />}
                  onClick={() => void handleClaim(item)}
                  disabled={claimingId !== null}
                  sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  {claimingId === item.id ? "Depositing..." : "Confirm Received & Deposit"}
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}
