import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, Stack, TextField, Typography,
} from "@mui/material";
import type { BarDatum } from "@nivo/bar";
import NetWorthOverview from "./components/NetWorthOverview";
import Assets from "./components/Assets";
import Liabilities from "./components/Liabilities";
import AssetsVsLiabilities from "./components/AssetsVsLiabilities";
import { financeApi } from "../../services/api";
import type { NetWorthAssetRecord, NetWorthPayload } from "../../types/api";
import { getKigaliDateInputValue } from "../../utils/kigaliTime";

type AssetForm = { assetName: string; assetType: string; currentValue: string; acquisitionDate: string; description: string };
const emptyForm: AssetForm = { assetName: "", assetType: "", currentValue: "", acquisitionDate: "", description: "" };
const money = (value: number) => `${Number(value || 0).toLocaleString()} RWF`;

export default function NetWorth() {
  const [data, setData] = useState<NetWorthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ severity: "success" | "error" | "warning"; message: string } | null>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const [form, setForm] = useState<AssetForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await financeApi.getNetWorth()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not retrieve net worth from the backend."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const saveAsset = async () => {
    const currentValue = Number(form.currentValue);
    if (!form.assetName.trim() || !form.assetType.trim() || form.currentValue.trim() === "" || !Number.isFinite(currentValue) || currentValue < 0) {
      setFeedback({ severity: "error", message: "Enter an asset name, type, and valid current value of zero or greater." }); return;
    }
    setBusy(true); setFeedback(null);
    try {
      await financeApi.createNetWorthAsset({
        assetName: form.assetName.trim(), assetType: form.assetType.trim(), currentValue, currency: "RWF",
        acquisitionDate: form.acquisitionDate || null, description: form.description.trim(),
      });
      setAssetOpen(false); setForm(emptyForm);
      setFeedback({ severity: "success", message: "Asset saved by the backend." });
      await load();
    } catch (caught) { setFeedback({ severity: "error", message: caught instanceof Error ? caught.message : "Could not save asset." }); }
    finally { setBusy(false); }
  };

  const archiveAsset = async (asset: NetWorthAssetRecord) => {
    if (asset.source !== "manual" || !asset.sourceId) return;
    setFeedback(null);
    try {
      await financeApi.archiveNetWorthAsset(asset.sourceId);
      setFeedback({ severity: "success", message: "Manual asset archived." });
      await load();
    } catch (caught) { setFeedback({ severity: "error", message: caught instanceof Error ? caught.message : "Could not archive the asset." }); }
  };

  const saveSnapshot = async () => {
    setBusy(true); setFeedback(null);
    try {
      const result = await financeApi.saveNetWorthSnapshot();
      setFeedback({ severity: "success", message: `Snapshot for ${result.date} saved: assets ${money(result.totalAssets)}, liabilities ${money(result.totalLiabilities)}, net worth ${money(result.netWorth)}.` });
      await load();
    } catch (caught) { setFeedback({ severity: "error", message: caught instanceof Error ? caught.message : "Could not save today's snapshot." }); }
    finally { setBusy(false); }
  };

  const chartData: BarDatum[] = data ? [{ date: data.asOfDate, ...data.breakdown }] : [];
  const hasChartValues = Boolean(data && (data.totalAssets !== 0 || data.totalLiabilities !== 0));

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={1} sx={{ py: 2 }}>
        <Box>
          <Typography variant="h1">Net Worth</Typography>
          <Typography variant="h6">Measure your financial position from persisted balances</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => void load()} disabled={loading}>Refresh</Button>
          <Button variant="outlined" onClick={() => { setForm(emptyForm); setAssetOpen(true); }} disabled={loading}>Add asset</Button>
          <Button variant="contained" onClick={() => void saveSnapshot()} disabled={loading || busy || !data}>Save today’s snapshot</Button>
        </Stack>
      </Stack>
      {loading && <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 3 }}><CircularProgress size={22} /><Typography>Loading persisted balances…</Typography></Box>}
      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>} sx={{ mb: 2 }}>{error}</Alert>}
      {feedback && <Alert severity={feedback.severity} onClose={() => setFeedback(null)} sx={{ mb: 2 }}>{feedback.message}</Alert>}
      {data && !loading && !error && <>
        <Alert severity="info" sx={{ mb: 2 }}>
          As of {data.asOfDate}. Assets include the existing wallet, emergency-fund, investment-reserve and investment records, plus manual RWF assets. Outstanding debts are liabilities; savings goals are excluded to avoid double-counting, and unpaid bills are excluded until a ledger relationship exists.
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{data.assetRules.join(" ")}</Typography>
        <Grid container spacing={2} sx={{ width: "100%" }}>
          <Grid item xs={12} md={6}>
            <NetWorthOverview history={data.history} totalAssets={data.totalAssets} totalLiabilities={data.totalLiabilities} netWorth={data.netWorth} asOfDate={data.asOfDate} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Assets rows={data.assets} loading={loading} onArchive={(asset) => void archiveAsset(asset)} />
          </Grid>
          <Grid item xs={12} md={6}><Liabilities rows={data.liabilities} loading={loading} /></Grid>
          <Grid item xs={12} md={6}><AssetsVsLiabilities data={chartData} hasValues={hasChartValues} /></Grid>
        </Grid>
      </>}
      <Dialog open={assetOpen} onClose={() => { if (!busy) setAssetOpen(false); }} fullWidth maxWidth="sm">
        <DialogTitle>Add manually tracked asset</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Asset name" required value={form.assetName} onChange={(event) => setForm((current) => ({ ...current, assetName: event.target.value }))} inputProps={{ maxLength: 160 }} />
            <TextField label="Asset type" required value={form.assetType} onChange={(event) => setForm((current) => ({ ...current, assetType: event.target.value }))} inputProps={{ maxLength: 100 }} helperText="Examples are descriptive only; enter the type that matches your asset." />
            <TextField label="Current value (RWF)" type="number" required value={form.currentValue} onChange={(event) => setForm((current) => ({ ...current, currentValue: event.target.value }))} inputProps={{ min: 0, step: "0.01" }} />
            <TextField label="Acquisition date" type="date" value={form.acquisitionDate} onChange={(event) => setForm((current) => ({ ...current, acquisitionDate: event.target.value }))} InputLabelProps={{ shrink: true }} inputProps={{ max: getKigaliDateInputValue() }} />
            <TextField label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} multiline minRows={2} inputProps={{ maxLength: 500 }} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setAssetOpen(false)} disabled={busy}>Cancel</Button><Button variant="contained" onClick={() => void saveAsset()} disabled={busy}>{busy ? "Saving…" : "Save asset"}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
