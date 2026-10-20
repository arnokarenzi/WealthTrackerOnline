import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, Stack, TextField, Typography,
} from "@mui/material";
import type { BarDatum } from "@nivo/bar";
import DebtOverview from "./components/DebtOverview";
import DebtPaymentHistory from "./components/DebtPaymentHistory";
import DebtToIncomeRatio from "./components/DebtToIncomeRatio";
import DebtBurdenRatio from "./components/DebtBurdenRatio";
import { financeApi } from "../../services/api";
import type { DebtPaymentRecord, DebtRecord, DebtSummary } from "../../types/api";

type FormState = {
  creditor: string; debtType: string; balance: string; interestRate: string; minimumPayment: string;
  dueDate: string; loanTerm: string; frequency: string; paymentMethod: string;
};
const blankForm: FormState = { creditor: "", debtType: "", balance: "", interestRate: "", minimumPayment: "", dueDate: "", loanTerm: "", frequency: "Monthly", paymentMethod: "" };
const makeRequestId = () => {
  try { return globalThis.crypto.randomUUID(); }
  catch { return `debt-payment-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};
const formatMoney = (value: number) => `${Number(value || 0).toLocaleString()} RWF`;

export default function DebtManagement() {
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [payments, setPayments] = useState<DebtPaymentRecord[]>([]);
  const [summary, setSummary] = useState<DebtSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ severity: "success" | "error" | "warning"; message: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [payDebt, setPayDebt] = useState<DebtRecord | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [payRequestId, setPayRequestId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [debtRows, paymentRows, summaryRow] = await Promise.all([
        financeApi.getDebts(), financeApi.getDebtPayments(), financeApi.getDebtSummary(),
      ]);
      setDebts(debtRows); setPayments(paymentRows); setSummary(summaryRow);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load debts from the server.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const startCreate = () => { setEditingDebt(null); setForm({ ...blankForm }); setFormOpen(true); setFeedback(null); };
  const startEdit = (debt: DebtRecord) => {
    setEditingDebt(debt);
    setForm({
      creditor: debt.creditor, debtType: debt.debtType, balance: String(debt.balance),
      interestRate: debt.interestRate == null ? "" : String(debt.interestRate),
      minimumPayment: debt.minimumPayment == null ? "" : String(debt.minimumPayment),
      dueDate: debt.dueDate || "", loanTerm: debt.loanTerm || "", frequency: debt.frequency || "Monthly", paymentMethod: debt.paymentMethod || "",
    });
    setFormOpen(true); setFeedback(null);
  };
  const saveDebt = async () => {
    const balance = Number(form.balance);
    const interestRate = form.interestRate.trim() === "" ? null : Number(form.interestRate);
    const minimumPayment = form.minimumPayment.trim() === "" ? null : Number(form.minimumPayment);
    if (!form.creditor.trim() || !form.debtType.trim() || (!editingDebt && (!Number.isFinite(balance) || balance <= 0))) {
      setFeedback({ severity: "error", message: "Creditor and debt type are required. New debt must have a positive opening balance." }); return;
    }
    setBusy(true); setFeedback(null);
    try {
      const terms = {
        creditor: form.creditor.trim(), debtType: form.debtType.trim(), interestRate, minimumPayment,
        dueDate: form.dueDate || null, loanTerm: form.loanTerm, frequency: form.frequency, paymentMethod: form.paymentMethod,
      };
      if (editingDebt) await financeApi.updateDebt(editingDebt.id, terms);
      else await financeApi.createDebt({ ...terms, balance });
      setFormOpen(false);
      setFeedback({ severity: "success", message: editingDebt ? "Debt terms saved by the server." : "Debt saved by the server." });
      await load();
    } catch (caught) {
      setFeedback({ severity: "error", message: caught instanceof Error ? caught.message : "Could not save debt details." });
    } finally { setBusy(false); }
  };
  const recordPayment = async () => {
    if (!payDebt || !payRequestId) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setFeedback({ severity: "error", message: "Enter a repayment amount greater than zero." }); return; }
    setBusy(true); setFeedback(null);
    try {
      await financeApi.recordDebtPayment(payDebt.id, { amount, requestId: payRequestId, paymentMethod: payMethod });
      setPayDebt(null); setPayRequestId(""); setPayAmount("");
      setFeedback({ severity: "success", message: "Repayment and outstanding balance were committed by the server." });
      await load();
    } catch (caught) {
      setFeedback({ severity: "error", message: caught instanceof Error ? caught.message : "Could not record the repayment." });
    } finally { setBusy(false); }
  };
  const archiveDebt = async (debt: DebtRecord) => {
    if (!window.confirm(`Archive the paid-off debt from ${debt.creditor}? Payment history will be retained.`)) return;
    setBusy(true); setFeedback(null);
    try {
      await financeApi.archiveDebt(debt.id);
      setFeedback({ severity: "success", message: "Paid-off debt archived." });
      await load();
    } catch (caught) {
      setFeedback({ severity: "error", message: caught instanceof Error ? caught.message : "Could not archive the debt." });
    } finally { setBusy(false); }
  };

  const dtiData = (summary?.debtToIncomeRatio || []) as unknown as BarDatum[];
  const burdenData = (summary?.debtBurdenRatio || []) as unknown as BarDatum[];

  return <Box sx={{ padding: 2 }}>
    <Box sx={{ paddingBlock: 2, width: "100%" }}>
      <Typography variant="h1">Debt Management</Typography>
      <Typography variant="h6">Manage saved debt balances and confirmed repayments</Typography>
    </Box>
    {loading && <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}><CircularProgress /></Box>}
    {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
    {feedback && <Alert severity={feedback.severity} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>{feedback.message}</Alert>}
    {summary && !loading && <Grid container spacing={1.5} sx={{ mb: 2 }}>
      <Grid item xs={12} sm={4}><Box sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}><Typography variant="body2" color="text.secondary">Outstanding debt</Typography><Typography variant="h5">{formatMoney(summary.totalBalance)}</Typography></Box></Grid>
      <Grid item xs={12} sm={4}><Box sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}><Typography variant="body2" color="text.secondary">Recorded minimum payments</Typography><Typography variant="h5">{formatMoney(summary.totalMinimumPayments)}</Typography></Box></Grid>
      <Grid item xs={12} sm={4}><Box sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}><Typography variant="body2" color="text.secondary">Recorded income this month</Typography><Typography variant="h5">{formatMoney(summary.recordedIncomeThisMonth)}</Typography><Typography variant="caption" color="text.secondary">{summary.debtToIncomePercent === null ? "Debt-to-income ratio unavailable" : `Minimum-payment ratio: ${summary.debtToIncomePercent.toFixed(1)}%`}</Typography></Box></Grid>
    </Grid>}
    <Grid container spacing={2} sx={{ width: "100%" }}>
      <Grid item xs={12} md={6} lg={8}><DebtOverview rows={debts} loading={loading || busy} onAdd={startCreate} onEdit={startEdit} onPay={(debt) => { setPayDebt(debt); setPayAmount(""); setPayMethod(debt.paymentMethod); setPayRequestId(makeRequestId()); setFeedback(null); }} onArchive={(debt) => void archiveDebt(debt)} /></Grid>
      <Grid item xs={12} md={6} lg={4}><DebtPaymentHistory rows={payments} loading={loading} /></Grid>
      <Grid item xs={12} md={6} lg={6}><DebtToIncomeRatio data={dtiData} /></Grid>
      <Grid item xs={12} md={6} lg={6}><DebtBurdenRatio data={burdenData} /></Grid>
    </Grid>

    <Dialog open={formOpen} onClose={() => !busy && setFormOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{editingDebt ? "Edit debt terms" : "Add debt"}</DialogTitle>
      <DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}>
        <TextField label="Creditor" value={form.creditor} onChange={(event) => setForm({ ...form, creditor: event.target.value })} required />
        <TextField label="Debt type" value={form.debtType} onChange={(event) => setForm({ ...form, debtType: event.target.value })} required />
        {!editingDebt && <TextField label="Opening balance (RWF)" type="number" value={form.balance} onChange={(event) => setForm({ ...form, balance: event.target.value })} inputProps={{ min: 0.01, step: 0.01 }} required />}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField label="Interest rate (%) — optional" type="number" value={form.interestRate} onChange={(event) => setForm({ ...form, interestRate: event.target.value })} inputProps={{ min: 0, step: 0.01 }} fullWidth />
          <TextField label="Minimum payment (RWF) — optional" type="number" value={form.minimumPayment} onChange={(event) => setForm({ ...form, minimumPayment: event.target.value })} inputProps={{ min: 0, step: 0.01 }} fullWidth />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField label="Due date — optional" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Term / remaining term" value={form.loanTerm} onChange={(event) => setForm({ ...form, loanTerm: event.target.value })} fullWidth />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField label="Frequency" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })} fullWidth />
          <TextField label="Payment method" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} fullWidth />
        </Stack>
        {editingDebt && <Typography variant="caption" color="text.secondary">Opening and outstanding balances are not editable here. Record a repayment to change outstanding balance so the payment history and balance remain consistent.</Typography>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setFormOpen(false)} disabled={busy}>Cancel</Button><Button variant="contained" onClick={() => void saveDebt()} disabled={busy}>{busy ? "Saving…" : "Save debt"}</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(payDebt)} onClose={() => !busy && setPayDebt(null)} fullWidth maxWidth="xs">
      <DialogTitle>Record repayment</DialogTitle>
      <DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}>
        {payDebt && <>
          <Typography>{payDebt.creditor} · outstanding {formatMoney(payDebt.balance)}</Typography>
          <TextField label="Amount (RWF)" type="number" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} inputProps={{ min: 0.01, max: payDebt.balance, step: 0.01 }} required />
          <TextField label="Payment method" value={payMethod} onChange={(event) => setPayMethod(event.target.value)} />
          <Typography variant="caption" color="text.secondary">No interest, fee, or extra charge is inferred. The repayment decreases the saved balance by the amount entered. Duplicate requests use a stable request ID.</Typography>
        </>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setPayDebt(null)} disabled={busy}>Cancel</Button><Button variant="contained" onClick={() => void recordPayment()} disabled={busy}>{busy ? "Recording…" : "Confirm repayment"}</Button></DialogActions>
    </Dialog>
  </Box>;
}
