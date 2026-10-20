import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Item from "../../../components/Item";
import CustomToolbar from "../../../components/CustomToolbar";
import { financeApi } from "../../../services/api";
import type { BillRecord } from "../../../types/api";
import { getKigaliDateInputValue } from "../../../utils/kigaliTime";

type Feedback = { severity: "success" | "error" | "warning" | "info"; message: string };
type BillForm = {
  billName: string;
  vendor: string;
  dueDate: string;
  amount: string;
  frequency: string;
  paymentMethod: string;
  category: string;
  notes: string;
  notification: boolean;
  autoPay: boolean;
};
const emptyForm: BillForm = {
  billName: "", vendor: "", dueDate: getKigaliDateInputValue(), amount: "",
  frequency: "Monthly", paymentMethod: "", category: "Other", notes: "", notification: false, autoPay: false,
};
const newRequestId = () => {
  try { return globalThis.crypto.randomUUID(); }
  catch { return `bill-payment-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};

function BillSummaryTable() {
  const [rows, setRows] = useState<BillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BillRecord | null>(null);
  const [form, setForm] = useState<BillForm>(emptyForm);
  const [paymentBill, setPaymentBill] = useState<BillRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentRequestId, setPaymentRequestId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setRows(await financeApi.getBills()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load bills from the server."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, dueDate: getKigaliDateInputValue() });
    setEditorOpen(true);
    setFeedback(null);
  };
  const openEdit = (bill: BillRecord) => {
    setEditing(bill);
    setForm({
      billName: bill.billName, vendor: bill.vendor, dueDate: bill.dueDate,
      amount: String(bill.amount), frequency: bill.frequency, paymentMethod: bill.paymentMethod,
      category: bill.category, notes: bill.notes, notification: bill.notification, autoPay: bill.autoPay,
    });
    setEditorOpen(true);
    setFeedback(null);
  };
  const saveBill = async () => {
    const amount = Number(form.amount);
    if (!form.billName.trim() || !form.dueDate || !Number.isFinite(amount) || amount <= 0) {
      setFeedback({ severity: "error", message: "Enter a bill name, valid due date, and amount greater than zero." });
      return;
    }
    setBusy(true); setFeedback(null);
    try {
      const payload = { ...form, amount };
      if (editing) await financeApi.updateBill(editing.id, payload);
      else await financeApi.createBill(payload);
      setEditorOpen(false);
      setFeedback({ severity: "success", message: editing ? "Bill updated on the server." : "Bill saved to the server." });
      await load();
    } catch (caught) {
      setFeedback({ severity: "error", message: caught instanceof Error ? caught.message : "Could not save the bill." });
    } finally { setBusy(false); }
  };
  const recordPayment = async () => {
    if (!paymentBill || !paymentRequestId) return;
    setBusy(true); setFeedback(null);
    try {
      await financeApi.recordBillPayment(paymentBill.id, { requestId: paymentRequestId, paymentMethod });
      setPaymentBill(null); setPaymentRequestId("");
      setFeedback({ severity: "success", message: "Payment was confirmed by the server and saved to payment history." });
      await load();
    } catch (caught) {
      setFeedback({ severity: "error", message: caught instanceof Error ? caught.message : "Could not record bill payment. The bill was not marked paid in this interface." });
    } finally { setBusy(false); }
  };
  const archiveBill = async (bill: BillRecord) => {
    if (!window.confirm(`Archive “${bill.billName}”? Its payment history will be retained.`)) return;
    setBusy(true); setFeedback(null);
    try {
      await financeApi.archiveBill(bill.id);
      setFeedback({ severity: "success", message: "Bill archived on the server." });
      await load();
    } catch (caught) {
      setFeedback({ severity: "error", message: caught instanceof Error ? caught.message : "Could not archive the bill." });
    } finally { setBusy(false); }
  };

  const columns: GridColDef<BillRecord>[] = [
    { field: "billName", headerName: "Bill Name", minWidth: 160, flex: 1 },
    { field: "vendor", headerName: "Vendor", minWidth: 140, flex: 1 },
    { field: "status", headerName: "Status", minWidth: 100, width: 100 },
    { field: "paymentDate", headerName: "Payment Date", minWidth: 130, flex: 1, valueFormatter: (params) => params.value || "—" },
    { field: "dueDate", headerName: "Due Date", minWidth: 120, flex: 1 },
    { field: "amount", headerName: "Amount (RWF)", type: "number", minWidth: 135, flex: 1, valueFormatter: (params) => Number(params.value || 0).toLocaleString() },
    { field: "frequency", headerName: "Frequency", minWidth: 110, flex: 1 },
    { field: "paymentMethod", headerName: "Payment Method", minWidth: 140, flex: 1, valueFormatter: (params) => params.value || "—" },
    { field: "category", headerName: "Category", minWidth: 120, flex: 1 },
    { field: "notification", headerName: "Reminder", type: "boolean", width: 95 },
    { field: "autoPay", headerName: "Auto Pay", type: "boolean", width: 95 },
    {
      field: "actions", headerName: "Actions", sortable: false, filterable: false, minWidth: 240, flex: 1,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Button size="small" onClick={() => openEdit(row)}>Edit</Button>
          {row.status === "Unpaid" && <Button size="small" variant="contained" onClick={() => { setPaymentBill(row); setPaymentMethod(row.paymentMethod); setPaymentRequestId(newRequestId()); }}>Record payment</Button>}
          <Button size="small" color="inherit" onClick={() => void archiveBill(row)}>Archive</Button>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ width: "100%" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">Bills shown here are saved records. Payment actions update the bill and payment history in one database transaction.</Typography>
        <Button variant="contained" onClick={openCreate}>Add bill</Button>
      </Stack>
      {feedback && <Alert severity={feedback.severity} sx={{ mb: 1.5 }} onClose={() => setFeedback(null)}>{feedback.message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1.5 }} action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
      {loading ? <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}><CircularProgress /></Box> : (
        <Box sx={{ height: 440, width: "100%" }}>
          <DataGrid
            rows={rows} columns={columns} loading={busy} disableColumnSelector disableDensitySelector
            slots={{ toolbar: CustomToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
            initialState={{ pagination: { paginationModel: { page: 0, pageSize: 10 } } }}
            pageSizeOptions={[5, 10, 25]} getRowId={(row) => row.id}
            localeText={{ noRowsLabel: "No bills are saved yet. Use Add bill to create the first record." }}
          />
        </Box>
      )}

      <Dialog open={editorOpen} onClose={() => !busy && setEditorOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit bill" : "Add bill"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField required label="Bill name" value={form.billName} onChange={(event) => setForm({ ...form, billName: event.target.value })} inputProps={{ maxLength: 160 }} />
            <TextField label="Vendor" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField required label="Amount (RWF)" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} inputProps={{ min: 0.01, step: 0.01 }} fullWidth />
              <TextField required label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField label="Frequency" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })} fullWidth />
              <TextField label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} fullWidth />
            </Stack>
            <TextField label="Payment method" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} />
            <TextField label="Notes" multiline minRows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            <Stack direction="row" flexWrap="wrap">
              <FormControlLabel control={<Checkbox checked={form.notification} onChange={(event) => setForm({ ...form, notification: event.target.checked })} />} label="Reminder enabled" />
              <FormControlLabel control={<Checkbox checked={form.autoPay} onChange={(event) => setForm({ ...form, autoPay: event.target.checked })} />} label="Auto pay preference" />
            </Stack>
            <Typography variant="caption" color="text.secondary">Reminder enabled creates an in-app reminder for the due date. Frequency is stored as bill metadata, and the auto-pay preference does not initiate a real payment; bill payments must be recorded explicitly.</Typography>
            {editing && <Typography variant="caption" color="text.secondary">Payment status and history are managed by the payment endpoint and cannot be changed by editing bill details.</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void saveBill()} variant="contained" disabled={busy}>{busy ? "Saving…" : "Save bill"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(paymentBill)} onClose={() => !busy && setPaymentBill(null)} fullWidth maxWidth="xs">
        <DialogTitle>Record bill payment</DialogTitle>
        <DialogContent>
          {paymentBill && <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography>{paymentBill.billName} — {paymentBill.amount.toLocaleString()} RWF</Typography>
            <Typography variant="body2" color="text.secondary">The recorded payment will equal the saved bill amount. This operation does not create a Daily Expense record.</Typography>
            <TextField label="Payment method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} />
          </Stack>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentBill(null)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void recordPayment()} variant="contained" disabled={busy}>{busy ? "Recording…" : "Confirm payment"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const BillsSummary = () => <Item title="Bills Summary" content={<BillSummaryTable />} height={570} />;
export default BillsSummary;
