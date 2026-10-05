import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  useTheme,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Alert,
} from "@mui/material";
import { CheckCircleOutline, PendingActions } from "@mui/icons-material";
import { tokens } from "../assets/theme";
import { financeApi } from "../services/api";

interface PendingItem {
  id: number;
  amount: number;
  description: string;
  earned_date: string;
}

export default function PendingEarningsWidget({
  onClaimSuccess,
}: {
  onClaimSuccess: () => void;
}) {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [pendingList, setPendingList] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const data = await financeApi.getPendingEarnings();
      setPendingList(data || []);
    } catch (err) {
      console.error("Failed to load pending payouts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleClaim = async (id: number) => {
    setActionError(null);
    try {
      const secureApi = financeApi as typeof financeApi & {
        claimPendingEarning?: (id: number) => Promise<void>;
      };
      if (secureApi.claimPendingEarning) {
        await secureApi.claimPendingEarning(id);
      }
      await fetchPending();
      onClaimSuccess(); // Triggers global dashboard refetch to update wallet balance instantly
    } catch (err) {
      console.error("Error claiming payout:", err);
      setActionError("Failed to transfer payout to wallet balance.");
    }
  };

  if (!loading && pendingList.length === 0) {
    return null; // Hide widget automatically if no pending shift payouts exist
  }

  return (
    <Paper
      sx={{
        backgroundColor: colors.primary[400],
        padding: 2.5,
        boxShadow: 4,
        mb: 3,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <PendingActions
          sx={{ color: colors.greenAccent[500], fontSize: "1.8rem" }}
        />
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Pending Shift Payouts (Receivables)
        </Typography>
      </Box>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress color="secondary" size={30} />
        </Box>
      ) : (
        <List sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {pendingList.map((item) => (
            <ListItem
              key={item.id}
              sx={{
                backgroundColor: colors.primary[500],
                borderRadius: "4px",
                border: `1px solid ${colors.greenAccent[600]}`,
              }}
            >
              <ListItemText
                primary={item.description}
                secondary={`Earned on: ${new Date(item.earned_date).toLocaleDateString()}`}
                primaryTypographyProps={{
                  fontWeight: 600,
                  color: colors.grey[100],
                }}
                secondaryTypographyProps={{ color: colors.grey[300] }}
              />
              <ListItemSecondaryAction
                sx={{ display: "flex", alignItems: "center", gap: 2 }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: colors.greenAccent[400] }}
                >
                  {Number(item.amount).toLocaleString()} RWF
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  size="small"
                  startIcon={<CheckCircleOutline />}
                  onClick={() => handleClaim(item.id)}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  Check Off & Deposit
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}
