import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  useTheme,
  Stack,
  CircularProgress,
  Divider,
} from "@mui/material";
import { ReceiptLong } from "@mui/icons-material";
import { tokens } from "../../../assets/theme";
import { financeApi } from "../../../services/api";
import { Expense } from "../../../types/api";

export default function TransactionHistory() {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [transactions, setTransactions] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const data = await financeApi.getExpenses();
        setTransactions(data || []);
      } catch (err) {
        console.error(
          "Failed to fetch transaction history from database:",
          err,
        );
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: colors.primary[400],
        borderRadius: "4px",
        boxShadow: 4,
        p: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
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
        <ReceiptLong sx={{ color: colors.greenAccent[600] }} /> Transaction
        History
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress size={24} color="info" />
        </Box>
      ) : transactions.length === 0 ? (
        <Typography variant="body2" sx={{ color: colors.grey[400], py: 1 }}>
          No transaction records found in the database.
        </Typography>
      ) : (
        <Stack
          spacing={2}
          sx={{ overflowY: "auto", maxHeight: "350px", pr: 1 }}
        >
          {transactions.map((tx) => (
            <Box
              key={tx.id || Math.random()}
              sx={{
                py: 1.5,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {tx.description || tx.category || "Expense Record"}
                </Typography>
                <Typography variant="caption" sx={{ color: colors.grey[400] }}>
                  {tx.date ? new Date(tx.date).toLocaleDateString() : "Recent"}
                </Typography>
              </Box>
              <Typography
                variant="h5"
                sx={{ fontWeight: 700, color: colors.greenAccent[500] }}
              >
                -{Number(tx.amount || 0).toLocaleString()} RWF
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
