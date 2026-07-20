import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Stack,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCardIcon from "@mui/icons-material/AddCard";
import { financeApi } from "../../../services/api"; // 📑 Hits your core API definitions
import { Expense } from "../../../types/api";

interface DailyExpensesProps {
  onExpenseChanged: () => void; // 🚀 Notifies the parent dashboard to update its charts and balances instantly
}

export default function DailyExpenses({
  onExpenseChanged,
}: DailyExpensesProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");

  // Expense categories mapping directly to your backend columns
  const categories = [
    { value: "food", label: "Food Provisions" },
    { value: "rent", label: "Core Rent Base" },
    { value: "electricityWater", label: "Electricity & Water Grid" },
    { value: "phoneInternet", label: "Network Phone & Internet" },
    { value: "medical", label: "Medical Safeguards" },
    { value: "familySupport", label: "Family Direct Support" },
    { value: "miscellaneous", label: "Miscellaneous Buffers" },
  ];

  const fetchExpenses = async () => {
    try {
      const data = await financeApi.getExpenses(); // 📑 GET /api/expenses
      setExpenses(data);
    } catch (err) {
      console.error("Failed to fetch transactional logs:", err);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    try {
      const newExpense = {
        description,
        amount: parseFloat(amount) || 0,
        category,
        expenseDate: new Date().toISOString().split("T")[0],
      } as Expense; // 🚀 Tells TypeScript: "Treat this payload as an Expense for the API call"

      await financeApi.addExpense(newExpense); // 📑 Sends cleanly without a new type error
      setDescription("");
      setAmount("");

      // Dynamic synchronization
      await fetchExpenses();
      onExpenseChanged();
    } catch (err) {
      console.error("Failed to save transaction entry:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !window.confirm("Remove this log line entry from the ledger permanently?")
    )
      return;
    try {
      await financeApi.deleteExpense(id); // 📑 DELETE /api/expenses/:id

      // Dynamic synchronization
      await fetchExpenses();
      onExpenseChanged();
    } catch (err) {
      console.error("Failed to delete transaction line:", err);
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "background.paper",
        borderRadius: "16px",
        boxShadow: 1,
      }}
    >
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Daily Transaction Log
      </Typography>

      {/* Quick Add Inline Entry Form */}
      <Box component="form" onSubmit={handleSubmit} sx={{ mb: 4 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Description"
            variant="outlined"
            size="small"
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <TextField
            label="Amount (RWF)"
            type="number"
            variant="outlined"
            size="small"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <TextField
            select
            label="Category"
            size="small"
            fullWidth
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            type="submit"
            variant="contained"
            color="info"
            startIcon={<AddCardIcon />}
            sx={{ px: 3, borderRadius: "8px", height: "40px" }}
          >
            Log
          </Button>
        </Stack>
      </Box>

      {/* Ledger History List Table */}
      <TableContainer
        component={Paper}
        sx={{
          maxHeight: 300,
          borderRadius: "8px",
          boxShadow: 0,
          border: "1px solid #e0e0e0",
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Amount
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  align="center"
                  sx={{ py: 3, color: "text.secondary" }}
                >
                  No transactions recorded for the active cycle tracker yet.
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.description}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>
                    {row.category}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500 }}>
                    {Number(row.amount).toLocaleString()} RWF
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => row.id && handleDelete(row.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
