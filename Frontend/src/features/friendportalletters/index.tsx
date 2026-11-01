import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { financeApi } from "../../services/api";
import type { FriendPortalLettersPayload, FriendPortalShiftSummary } from "../../types/api";

const kigaliToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const formatRwf = (value: number) =>
  `${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })} RWF`;

const formatDate = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
};

const errorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return error instanceof Error ? error.message : "An unexpected error occurred.";
};

const shiftLabel = (shift: FriendPortalShiftSummary) => {
  const startDay = Number(shift.shiftStart.slice(-2));
  return startDay === 1 ? "First shift (1st–15th)" : "Second shift (16th–end of month)";
};

const isEntryInShift = (workDate: string, shift: FriendPortalShiftSummary) =>
  workDate >= shift.shiftStart && workDate <= shift.shiftEnd;

export default function FriendPortalLetters() {
  const today = useMemo(() => kigaliToday(), []);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [workDate, setWorkDate] = useState(today);
  const [lettersCount, setLettersCount] = useState("");
  const [notes, setNotes] = useState("");
  const [data, setData] = useState<FriendPortalLettersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingShift, setResettingShift] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await financeApi.getFriendPortalLetters(selectedMonth);
      setData(result);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const rate = data?.policy.ratePerLetter ?? 245;
  const allowance = data?.policy.excludedLettersPerShift ?? 150;
  const previewLetters = Math.max(0, Number(lettersCount) || 0);
  const selectedDay = Number(workDate.slice(-2));
  const selectedShiftStart = selectedDay <= 15 ? 1 : 16;
  const usedAllowanceBeforeDate = (data?.entries ?? [])
    .filter((entry) => {
      const entryDay = Number(entry.workDate.slice(-2));
      const sameShift = selectedDay <= 15
        ? entryDay >= selectedShiftStart && entryDay <= 15
        : entryDay >= selectedShiftStart;
      return entry.workDate.slice(0, 7) === workDate.slice(0, 7) &&
        sameShift && entry.workDate < workDate;
    })
    .reduce((total, entry) => total + entry.excludedLetters, 0);
  const remainingAllowance = Math.max(0, allowance - usedAllowanceBeforeDate);
  const previewExcluded = Math.min(previewLetters, remainingAllowance);
  const previewPayable = Math.max(0, previewLetters - previewExcluded);
  const previewEarnings = previewPayable * rate;

  const handleSave = async () => {
    const count = Number(lettersCount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      setError("Choose a valid work date.");
      return;
    }
    if (!Number.isInteger(count) || count < 1 || count > 1000000) {
      setError("Enter a whole number of letters between 1 and 1,000,000.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await financeApi.saveFriendPortalLetters({
        workDate,
        lettersCount: count,
        notes: notes.trim(),
      });
      setSuccess(
        `${result.message} ${result.entry.payableLetters.toLocaleString()} payable letters; ${formatRwf(result.entry.earnings)} estimated earnings.`,
      );
      setLettersCount("");
      setNotes("");
      setSelectedMonth(workDate.slice(0, 7));
      if (selectedMonth === workDate.slice(0, 7)) await loadRecords();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this work-date record? This cannot be undone.")) return;
    setError("");
    setSuccess("");
    try {
      const result = await financeApi.deleteFriendPortalLetters(id);
      setSuccess(result.message);
      await loadRecords();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  };

  const handleResetShift = async (shift: FriendPortalShiftSummary) => {
    const amount = shift.earnings;
    const confirmed = window.confirm(
      `Reset ${shiftLabel(shift)} (${formatDate(shift.shiftStart)}–${formatDate(shift.shiftEnd)})?\n\n` +
      `${shift.totalLetters.toLocaleString()} total letters\n` +
      `${shift.excludedLetters.toLocaleString()} excluded for your friend\n` +
      `${shift.payableLetters.toLocaleString()} payable letters\n` +
      `Receivable: ${formatRwf(amount)}\n\n` +
      "This finalizes the shift and locks its daily records. The records remain in your history. The amount will NOT enter your wallet until you confirm that your friend has paid you.",
    );
    if (!confirmed) return;

    setResettingShift(shift.shiftStart);
    setError("");
    setSuccess("");
    try {
      const result = await financeApi.resetFriendPortalShift(shift.shiftStart);
      setSuccess(result.message);
      await loadRecords();
    } catch (resetError) {
      setError(errorMessage(resetError));
    } finally {
      setResettingShift(null);
    }
  };

  const summary = data?.summary ?? {
    totalLetters: 0,
    excludedLetters: 0,
    payableLetters: 0,
    earnings: 0,
  };
  const shifts = data?.shiftSummaries ?? [];

  return (
    <Box p={{ xs: 2, md: 3 }}>
      <Box mb={3}>
        <Typography variant="h1" gutterBottom>
          Friend Portal Letters
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Track translations completed in your friend&apos;s portal separately from your personal FinTrack earnings.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        The first {allowance} letters in each FinTrack shift are excluded for your friend. Shifts run from the 1st–15th and from the 16th–end of the month. Every additional letter earns {formatRwf(rate)}. The allowance carries forward between dates in the same shift. Resetting a shift moves its calculated earnings to pending receivables; it does not add money to your wallet. You confirm the wallet deposit only after your friend pays you.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h4" mb={2}>Record a work date</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              label="Work date"
              type="date"
              value={workDate}
              onChange={(event) => {
                setWorkDate(event.target.value);
                if (event.target.value.length >= 7) setSelectedMonth(event.target.value.slice(0, 7));
              }}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Total letters translated that date"
              type="number"
              value={lettersCount}
              onChange={(event) => setLettersCount(event.target.value)}
              inputProps={{ min: 1, max: 1000000, step: 1 }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Notes (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              inputProps={{ maxLength: 500 }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ p: 2, borderRadius: 1, bgcolor: "action.hover", display: "flex", flexWrap: "wrap", gap: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Friend&apos;s excluded letters for this date</Typography>
                <Typography variant="h5">{previewExcluded.toLocaleString()}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Your payable letters</Typography>
                <Typography variant="h5">{previewPayable.toLocaleString()}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Estimated earnings</Typography>
                <Typography variant="h5" color="success.main">{formatRwf(previewEarnings)}</Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              startIcon={<SaveOutlinedIcon />}
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save daily total"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Box mb={2}>
        <Typography variant="h4" mb={1}>Monthly summary</Typography>
        <TextField
          label="Month"
          type="month"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ maxWidth: 240 }}
        />
      </Box>

      <Grid container spacing={2} mb={3}>
        {[
          { label: "Total letters", value: summary.totalLetters.toLocaleString() },
          { label: "Friend's excluded letters", value: summary.excludedLetters.toLocaleString() },
          { label: "Your payable letters", value: summary.payableLetters.toLocaleString() },
          { label: "Your estimated earnings", value: formatRwf(summary.earnings) },
        ].map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.label}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">{item.label}</Typography>
                <Typography variant="h4" mt={1}>{item.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h4" mb={2}>Shift reset and receivables</Typography>
      <Grid container spacing={2} mb={3}>
        {shifts.map((shift) => {
          const label = shiftLabel(shift);
          const isResetting = resettingShift === shift.shiftStart;
          const statusLabel = shift.status === "open"
            ? "Open"
            : shift.status === "pending"
              ? "Pending payment"
              : shift.status === "collected" ? "Deposited to wallet" : "Finalized — no payout";
          const chipColor = shift.status === "collected"
            ? "success"
            : shift.status === "pending" ? "warning" : "default";

          return (
            <Grid item xs={12} md={6} key={shift.shiftStart}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} mb={2}>
                    <Box>
                      <Typography variant="h5">{label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(shift.shiftStart)} – {formatDate(shift.shiftEnd)}
                      </Typography>
                    </Box>
                    <Chip size="small" label={statusLabel} color={chipColor} />
                  </Stack>
                  <Grid container spacing={1} mb={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Total letters</Typography>
                      <Typography variant="h6">{shift.totalLetters.toLocaleString()}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Excluded letters</Typography>
                      <Typography variant="h6">{shift.excludedLetters.toLocaleString()}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Payable letters</Typography>
                      <Typography variant="h6">{shift.payableLetters.toLocaleString()}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Earnings to receive</Typography>
                      <Typography variant="h6" color="success.main">{formatRwf(shift.earnings)}</Typography>
                    </Grid>
                  </Grid>

                  {shift.status === "open" ? (
                    <Button
                      fullWidth
                      variant="contained"
                      color="secondary"
                      startIcon={<RestartAltIcon />}
                      disabled={loading || isResetting || shift.totalLetters === 0}
                      onClick={() => void handleResetShift(shift)}
                    >
                      {isResetting ? "Resetting shift..." : "Reset & move to receivables"}
                    </Button>
                  ) : (
                    <Alert severity={shift.status === "collected" ? "success" : "info"} icon={shift.status === "collected" ? undefined : <LockOutlinedIcon />}>
                      {shift.status === "pending"
                        ? `Finalized. ${formatRwf(shift.payoutAmount ?? shift.earnings)} is waiting in Pending Friend Portal Payouts. Daily records are locked.`
                        : shift.status === "collected"
                          ? "Payment has been confirmed and deposited into your wallet. Daily records are locked."
                          : "This shift has been finalized. There were no payable earnings, so no receivable was created. Daily records are locked."}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4">Daily records</Typography>
          {loading && <CircularProgress size={22} />}
        </Stack>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
        ) : data?.entries.length ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Work date</TableCell>
                  <TableCell align="right">Letters</TableCell>
                  <TableCell align="right">Excluded</TableCell>
                  <TableCell align="right">Payable</TableCell>
                  <TableCell align="right">Earnings</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.entries.map((entry) => {
                  const closed = shifts.some(
                    (shift) => shift.status !== "open" && isEntryInShift(entry.workDate, shift),
                  );
                  return (
                    <TableRow key={entry.id} hover>
                      <TableCell>{entry.workDate}</TableCell>
                      <TableCell align="right">{entry.lettersCount.toLocaleString()}</TableCell>
                      <TableCell align="right">{entry.excludedLetters.toLocaleString()}</TableCell>
                      <TableCell align="right">{entry.payableLetters.toLocaleString()}</TableCell>
                      <TableCell align="right">{formatRwf(entry.earnings)}</TableCell>
                      <TableCell>{entry.notes || "—"}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          aria-label={`Delete record for ${entry.workDate}`}
                          color="error"
                          onClick={() => void handleDelete(entry.id)}
                          size="small"
                          disabled={closed}
                          title={closed ? "This shift has been reset and is locked" : "Delete daily record"}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography color="text.secondary" py={3} textAlign="center">
            No friend-portal letter records for this month yet.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
