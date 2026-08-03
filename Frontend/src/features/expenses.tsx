import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  useTheme,
  TextField,
  Button,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  AddCard,
  ReceiptLong,
  DeleteOutline,
  AccountBalanceWallet,
} from "@mui/icons-material";
import { tokens } from "../assets/theme";
import { financeApi } from "../services/api";
import { Expense, MonthlyBudget } from "../types/api";

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
}

const EXPENSE_CATEGORIES = [
  { label: "Food & Dining", value: "food" },
  { label: "Phone & Internet", value: "phoneInternet" },
  { label: "Electricity & Water", value: "electricityWater" },
  { label: "Medical", value: "medical" },
  { label: "Family Support", value: "familySupport" },
  { label: "Rent", value: "rent" },
  { label: "School Saving", value: "schoolSaving" },
  { label: "Emergency Fund", value: "emergencyFund" },
  { label: "Investment", value: "investment" },
  { label: "Miscellaneous", value: "miscellaneous" },
];

export default function Expenses() {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [expenseList, setExpenseList] = useState<ExpenseItem[]>([]);
  const [expectedIncome, setExpectedIncome] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [inputDate, setInputDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const rawData: Expense[] = await financeApi.getExpenses();
        const parsedExpenses: ExpenseItem[] = (rawData || []).map((item) => ({
          id: String(item?.id ?? crypto.randomUUID()),
          description: item?.description ?? "Unspecified Transaction",
          amount: Number(item?.amount ?? 0),
          category: item?.category ?? "Miscellaneous",
          expenseDate: item?.expenseDate ?? new Date().toISOString(),
        }));
        setExpenseList(parsedExpenses);

        const budgetData: MonthlyBudget = await financeApi.getBudgetPlan();
        const calculatedIncome =
          Number(budgetData?.salary ?? 0) +
          Number(budgetData?.otherIncome ?? 0);

        setExpectedIncome(calculatedIncome);
      } catch (err) {
        console.error("Failed to read synchronized system records:", err);
        setErrorMessage(
          "Could not load your complete financial records from the database.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAddExpense = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    if (!description || !amount || !category || !inputDate) return;

    setErrorMessage(null);
    const newPayload: Expense = {
      description,
      amount: parseFloat(amount),
      category,
      expenseDate: inputDate,
    };

    try {
      const response = await financeApi.addExpense(newPayload);
      const savedExpense = response as unknown as ExpenseItem;

      const sanitizedItem: ExpenseItem = {
        id: String(savedExpense?.id ?? crypto.randomUUID()),
        description: savedExpense?.description ?? newPayload.description,
        amount: Number(savedExpense?.amount ?? newPayload.amount),
        category: savedExpense?.category ?? newPayload.category,
        expenseDate: savedExpense?.expenseDate ?? newPayload.expenseDate,
      };
      setExpenseList((prevExpenses) => [sanitizedItem, ...prevExpenses]);

      setDescription("");
      setAmount("");
      setCategory("");
    } catch (err) {
      console.error("Error committing transaction write:", err);
      setErrorMessage(
        "Database write rejected. Please verify operational database health.",
      );
    }
  };

  const handleDeleteExpense = async (id: string): Promise<void> => {
    setErrorMessage(null);
    try {
      await financeApi.deleteExpense(Number(id));
      setExpenseList((prevExpenses) =>
        prevExpenses.filter((item) => item.id !== id),
      );
    } catch (err) {
      console.error("Error standardizing item structural erasure:", err);
      setErrorMessage(
        "Could not erase target transactional payload line item.",
      );
    }
  };

  const totalSpent = expenseList.reduce(
    (acc, curr) => acc + Number(curr?.amount ?? 0),
    0,
  );
  const remainingSurplus = expectedIncome - totalSpent;

  return (
    <Box sx={{ padding: 2 }}>
      <Box sx={{ paddingBlock: 2, width: "100%" }}>
        <Typography
          variant="h1"
          sx={{ display: "flex", alignItems: "center", gap: 2 }}
        >
          <ReceiptLong
            sx={{ fontSize: "2.5rem", color: colors.greenAccent[500] }}
          />
          Daily Expenses
        </Typography>
        <Typography variant="h6" color={colors.grey[300]}>
          Log and monitor your immediate operational outlays in real-time.
        </Typography>
      </Box>

      {errorMessage && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setErrorMessage(null)}
        >
          {errorMessage}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.primary[400], boxShadow: 4 }}>
            <CardContent>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
                Record New Expense
              </Typography>

              <Box
                component="form"
                onSubmit={handleAddExpense}
                sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
              >
                <TextField
                  label="Description"
                  variant="outlined"
                  fullWidth
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDescription(e.target.value)
                  }
                  required
                />

                <TextField
                  label="Amount (RWF)"
                  type="number"
                  variant="outlined"
                  fullWidth
                  value={amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAmount(e.target.value)
                  }
                  required
                />

                <TextField
                  select
                  label="Category"
                  variant="outlined"
                  fullWidth
                  value={category}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCategory(e.target.value)
                  }
                  required
                >
                  {EXPENSE_CATEGORIES.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  type="date"
                  label="Transaction Date"
                  variant="outlined"
                  fullWidth
                  value={inputDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setInputDate(e.target.value)
                  }
                  InputLabelProps={{ shrink: true }}
                  required
                />

                <Button
                  type="submit"
                  variant="contained"
                  color="secondary"
                  startIcon={<AddCard />}
                  sx={{ py: 1.5, fontWeight: 600, textTransform: "none" }}
                  fullWidth
                >
                  Add Transaction Entry
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card
            sx={{ backgroundColor: colors.primary[400], boxShadow: 4, mt: 3 }}
          >
            <CardContent>
              <Typography variant="body1" color={colors.grey[300]}>
                Cumulative Running Cost Summary
              </Typography>
              <Typography
                variant="h2"
                sx={{ fontWeight: 700, mt: 1, color: colors.greenAccent[500] }}
              >
                {totalSpent.toLocaleString()} RWF
              </Typography>
            </CardContent>
          </Card>

          <Card
            sx={{ backgroundColor: colors.primary[400], boxShadow: 4, mt: 3 }}
          >
            <CardContent>
              <Typography
                variant="body1"
                color={colors.grey[300]}
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <AccountBalanceWallet
                  sx={{ fontSize: "1.2rem", color: colors.blueAccent[400] }}
                />
                Remaining Budget Surplus
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 700,
                  mt: 1,
                  color:
                    remainingSurplus >= 0
                      ? colors.blueAccent[400]
                      : theme.palette.error.main,
                }}
              >
                {remainingSurplus.toLocaleString()} RWF
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <TableContainer
            component={Paper}
            sx={{ backgroundColor: colors.primary[400], boxShadow: 4 }}
          >
            <Table aria-label="expense tracking operational logs">
              <TableHead sx={{ backgroundColor: colors.primary[500] }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Amount
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <CircularProgress color="secondary" />
                    </TableCell>
                  </TableRow>
                ) : expenseList.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      align="center"
                      sx={{ py: 4, color: colors.grey[400] }}
                    >
                      No recent expenses logged for this current validation
                      cycle.
                    </TableCell>
                  </TableRow>
                ) : (
                  expenseList.map((item) => (
                    <TableRow
                      key={item.id}
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell>
                        {item.expenseDate ? item.expenseDate.split("T")[0] : ""}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {item.description ?? ""}
                      </TableCell>
                      <TableCell>{item.category ?? ""}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: colors.blueAccent[300], fontWeight: 600 }}
                      >
                        {Number(item?.amount ?? 0).toLocaleString()} RWF
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          color="error"
                          size="small"
                          onClick={() => handleDeleteExpense(item.id)}
                          sx={{ minWidth: "auto", p: 0.5 }}
                        >
                          <DeleteOutline />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Box>
  );
}
