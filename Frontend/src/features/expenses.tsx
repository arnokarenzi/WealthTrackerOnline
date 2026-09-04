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
  Tabs,
  Tab,
  Tooltip,
} from "@mui/material";
import {
  AddCard,
  ReceiptLong,
  DeleteOutline,
  AccountBalanceWallet,
  History,
  FileDownload,
  Search,
  TrendingUp,
} from "@mui/icons-material";
import { tokens } from "../assets/theme";
import { financeApi } from "../services/api";
import { Expense, MonthlyBudget } from "../types/api";
import { WalletIncomeItem } from "../services/api";

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

  // Tab Navigation State (0 = Active Expenses, 1 = Expense Archive, 2 = Income History)
  const [currentTab, setCurrentTab] = useState<number>(0);

  const [expenseList, setExpenseList] = useState<ExpenseItem[]>([]);
  const [expectedIncome, setExpectedIncome] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Income History State
  const [incomeHistory, setIncomeHistory] = useState<WalletIncomeItem[]>([]);
  const [incomeLoading, setIncomeLoading] = useState<boolean>(false);
  const [incomeStartDate, setIncomeStartDate] = useState<string>("");
  const [incomeEndDate, setIncomeEndDate] = useState<string>("");
  const [incomeHasSearched, setIncomeHasSearched] = useState<boolean>(false);

  // Form State
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [inputDate, setInputDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // History State
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [historyList, setHistoryList] = useState<ExpenseItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

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
          "Could not load your complete financial records from the database."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch Income History when switching to the Income History tab initially
  useEffect(() => {
    if (currentTab === 2 && !incomeHasSearched) {
      const fetchInitialIncomeHistory = async () => {
        try {
          setIncomeLoading(true);
          const data = await financeApi.getWalletIncomeHistory();
          setIncomeHistory(data);
        } catch (err) {
          console.error("Failed to load income history ledger:", err);
          setErrorMessage("Could not fetch wallet income audit history.");
        } finally {
          setIncomeLoading(false);
        }
      };
      fetchInitialIncomeHistory();
    }
  }, [currentTab, incomeHasSearched]);

  const handleAddExpense = async (
    e: React.FormEvent<HTMLFormElement>
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
        "Database write rejected. Please verify operational database health."
      );
    }
  };

  const handleDeleteExpense = async (id: string): Promise<void> => {
    setErrorMessage(null);
    try {
      await financeApi.deleteExpense(Number(id));
      setExpenseList((prevExpenses) =>
        prevExpenses.filter((item) => item.id !== id)
      );
    } catch (err) {
      console.error("Error standardizing item structural erasure:", err);
      setErrorMessage(
        "Could not erase target transactional payload line item."
      );
    }
  };

  // Helper check to protect Emergency and School Fees contributions from being deleted
  const isProtectedExpense = (category: string, description: string) => {
    const cat = (category || "").toLowerCase();
    const desc = (description || "").toLowerCase();
    return (
      cat.includes("emergency") ||
      cat.includes("school") ||
      desc.includes("emergency") ||
      desc.includes("school")
    );
  };

  // Search History
  const handleFetchHistory = async (): Promise<void> => {
    if (!startDate || !endDate) {
      setErrorMessage("Please select both a Start Date and End Date.");
      return;
    }
    setErrorMessage(null);
    try {
      setHistoryLoading(true);
      setHasSearched(true);
      const rawData = await financeApi.getExpenseHistory(startDate, endDate);
      const parsed: ExpenseItem[] = (rawData || []).map((item: any) => ({
        id: String(item?.id ?? crypto.randomUUID()),
        description: item?.description ?? "Unspecified Transaction",
        amount: Number(item?.amount ?? 0),
        category: item?.category ?? "Miscellaneous",
        expenseDate: item?.expenseDate ?? new Date().toISOString(),
      }));
      setHistoryList(parsed);
    } catch (err) {
      console.error("Error fetching historical expense archive:", err);
      setErrorMessage("Could not fetch expense history for selected range.");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Export filtered history to CSV
  const handleExportCSV = (): void => {
    if (historyList.length === 0) return;

    const headers = ["ID", "Date", "Description", "Category", "Amount (RWF)"];
    const csvRows = historyList.map((item) => {
      const date = item.expenseDate ? item.expenseDate.split("T")[0] : "";
      return `"${item.id}","${date}","${item.description.replace(/"/g, '""')}","${item.category}","${item.amount}"`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expenses_archive_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalSpent = expenseList.reduce(
    (acc, curr) => acc + Number(curr?.amount ?? 0),
    0
  );
  const historyTotalSpent = historyList.reduce(
    (acc, curr) => acc + Number(curr?.amount ?? 0),
    0
  );
  const remainingSurplus = expectedIncome - totalSpent;
  const totalIncomeCollected = incomeHistory.reduce(
    (acc, curr) => acc + Number(curr?.amount ?? 0),
    0
  );

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
          Financial Ledger & Expenses
        </Typography>
        <Typography variant="h6" color={colors.grey[300]}>
          Log current operational outlays, query archived expenses, and review income streams.
        </Typography>
      </Box>

      {/* TABS NAVIGATION */}
      <Box sx={{ borderBottom: 1, borderColor: colors.grey[700], mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(_e, val) => setCurrentTab(val)}
          textColor="secondary"
          indicatorColor="secondary"
        >
          <Tab
            label="Active Expenses"
            sx={{ fontWeight: 600, textTransform: "none", fontSize: "1rem" }}
          />
          <Tab
            label="Expense Archive"
            sx={{ fontWeight: 600, textTransform: "none", fontSize: "1rem" }}
          />
          <Tab
            label="Income History"
            sx={{ fontWeight: 600, textTransform: "none", fontSize: "1rem" }}
          />
        </Tabs>
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

      {/* TAB 0: ACTIVE EXPENSES MANAGEMENT */}
      {currentTab === 0 && (
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
                  Active Shift Running Cost Summary
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
              <Typography variant="h5" sx={{ p: 2, fontWeight: 600 }}>
                Active Shift Expenses
              </Typography>
              <Table aria-label="active expense tracking operational logs">
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
                        No active expenses logged for this shift cycle.
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenseList.map((item) => {
                      const isProtected = isProtectedExpense(item.category, item.description);
                      return (
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
                            {isProtected ? (
                              <Tooltip title="Emergency & School Fees contributions cannot be deleted to protect wallet balance consistency.">
                                <span>
                                  <Button
                                    color="error"
                                    size="small"
                                    disabled
                                    sx={{ minWidth: "auto", p: 0.5 }}
                                  >
                                    <DeleteOutline />
                                  </Button>
                                </span>
                              </Tooltip>
                            ) : (
                              <Button
                                color="error"
                                size="small"
                                onClick={() => handleDeleteExpense(item.id)}
                                sx={{ minWidth: "auto", p: 0.5 }}
                              >
                                <DeleteOutline />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      )}

      {/* TAB 1: EXPENSE ARCHIVE SEARCH */}
      {currentTab === 1 && (
        <Paper
          sx={{
            p: 3,
            backgroundColor: colors.primary[400],
            boxShadow: 4,
            borderRadius: 2,
            mt: 2,
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={2}
            mb={3}
          >
            <Typography
              variant="h4"
              sx={{ display: "flex", alignItems: "center", gap: 1.5, fontWeight: 600 }}
            >
              <History sx={{ color: colors.blueAccent[400] }} />
              Expense Archive Search
            </Typography>

            {historyList.length > 0 && (
              <Button
                variant="contained"
                color="success"
                startIcon={<FileDownload />}
                onClick={handleExportCSV}
                sx={{ fontWeight: 600, textTransform: "none" }}
              >
                Export Visible CSV ({historyList.length})
              </Button>
            )}
          </Box>

          <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField
              type="date"
              label="Start Date"
              variant="outlined"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setStartDate(e.target.value)
              }
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />

            <TextField
              type="date"
              label="End Date"
              variant="outlined"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEndDate(e.target.value)
              }
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />

            <Button
              variant="contained"
              color="secondary"
              startIcon={<Search />}
              onClick={handleFetchHistory}
              sx={{ py: 1.8, px: 3, fontWeight: 600, textTransform: "none" }}
            >
              Query History
            </Button>

            {hasSearched && (
              <Typography variant="h5" sx={{ ml: "auto", fontWeight: 700, color: colors.greenAccent[500] }}>
                Range Total: {historyTotalSpent.toLocaleString()} RWF
              </Typography>
            )}
          </Box>

          <TableContainer component={Paper} sx={{ backgroundColor: colors.primary[500] }}>
            <Table aria-label="archived expense history">
              <TableHead sx={{ backgroundColor: colors.primary[600] }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <CircularProgress color="secondary" />
                    </TableCell>
                  </TableRow>
                ) : !hasSearched ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3, color: colors.grey[400] }}>
                      Select a date range above and click "Query History" to search archived expenses.
                    </TableCell>
                  </TableRow>
                ) : historyList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3, color: colors.grey[400] }}>
                      No archived expense records found within this date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  historyList.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.expenseDate ? item.expenseDate.split("T")[0] : ""}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {item.description}
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell align="right" sx={{ color: colors.blueAccent[300], fontWeight: 600 }}>
                        {item.amount.toLocaleString()} RWF
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* TAB 2: INCOME HISTORY & ARCHIVE SEARCH */}
      {currentTab === 2 && (
        <Paper
          sx={{
            p: 3,
            backgroundColor: colors.primary[400],
            boxShadow: 4,
            borderRadius: 2,
            mt: 2,
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={2}
            mb={3}
          >
            <Typography
              variant="h4"
              sx={{ display: "flex", alignItems: "center", gap: 1.5, fontWeight: 600 }}
            >
              <TrendingUp sx={{ color: colors.greenAccent[500] }} />
              Income History & Audit Archive
            </Typography>

            {incomeHistory.length > 0 && (
              <Button
                variant="contained"
                color="success"
                startIcon={<FileDownload />}
                onClick={() => {
                  const headers = ["ID", "Date", "Description", "Source Type", "Amount (RWF)"];
                  const csvRows = incomeHistory.map((item) => {
                    const date = item.created_at ? item.created_at.split("T")[0] : "";
                    return `"${item.id}","${date}","${item.description.replace(/"/g, '""')}","${item.source_type}","${item.amount}"`;
                  });
                  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows].join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `income_archive_${incomeStartDate}_to_${incomeEndDate}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                sx={{ fontWeight: 600, textTransform: "none" }}
              >
                Export Visible CSV ({incomeHistory.length})
              </Button>
            )}
          </Box>

          <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField
              type="date"
              label="Start Date"
              variant="outlined"
              value={incomeStartDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setIncomeStartDate(e.target.value)
              }
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />

            <TextField
              type="date"
              label="End Date"
              variant="outlined"
              value={incomeEndDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setIncomeEndDate(e.target.value)
              }
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />

            <Button
              variant="contained"
              color="secondary"
              startIcon={<Search />}
              onClick={async () => {
                if (!incomeStartDate || !incomeEndDate) {
                  setErrorMessage("Please select both a Start Date and End Date for income history.");
                  return;
                }
                setErrorMessage(null);
                try {
                  setIncomeLoading(true);
                  setIncomeHasSearched(true);
                  const data = await financeApi.getWalletIncomeHistory(incomeStartDate, incomeEndDate);
                  setIncomeHistory(data);
                } catch (err) {
                  console.error("Error fetching filtered income history:", err);
                  setErrorMessage("Could not fetch income history for selected range.");
                } finally {
                  setIncomeLoading(false);
                }
              }}
              sx={{ py: 1.8, px: 3, fontWeight: 600, textTransform: "none" }}
            >
              Query Income History
            </Button>

            {incomeHasSearched && (
              <Typography variant="h5" sx={{ ml: "auto", fontWeight: 700, color: colors.greenAccent[500] }}>
                Range Inflow Total: {totalIncomeCollected.toLocaleString()} RWF
              </Typography>
            )}
          </Box>

          <TableContainer component={Paper} sx={{ backgroundColor: colors.primary[500] }}>
            <Table aria-label="wallet income history audit trail">
              <TableHead sx={{ backgroundColor: colors.primary[600] }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Source Type</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incomeLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                      <CircularProgress color="secondary" />
                    </TableCell>
                  </TableRow>
                ) : incomeHistory.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      align="center"
                      sx={{ py: 4, color: colors.grey[400] }}
                    >
                      No income records found within this date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  incomeHistory.map((item) => (
                    <TableRow
                      key={item.id}
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {item.description ?? ""}
                      </TableCell>
                      <TableCell>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor:
                              item.source_type === "shift_rollover"
                                ? colors.blueAccent?.[800] || "#1e3a8a"
                                : colors.greenAccent?.[800] || "#065f46",
                            color: "#fff",
                          }}
                        >
                          {item.source_type === "shift_rollover" ? "Shift Payment" : "Side Income"}
                        </span>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: colors.greenAccent[500], fontWeight: 600 }}
                      >
                        +RWF {Number(item?.amount ?? 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
