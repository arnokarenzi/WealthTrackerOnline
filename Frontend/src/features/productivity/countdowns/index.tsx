import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, IconButton, MenuItem, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type { CountdownInput, ProductivityCountdown } from "../../../services/productivityApi";

type Draft = { title: string; description: string; eventDate: string; eventTime: string; category: string; color: string; recurrence: "none" | "yearly" };
const emptyDraft: Draft = { title: "", description: "", eventDate: "", eventTime: "", category: "", color: "#1976d2", recurrence: "none" };
const dateLabel = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const remainingLabel = (days: number) => days === 0 ? "Today" : days === 1 ? "Tomorrow" : days > 1 ? `${days} days to go` : `${Math.abs(days)} days ago`;

export default function ProductivityCountdownsPage() {
  const [items, setItems] = useState<ProductivityCountdown[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await productivityApi.getCountdowns(includeArchived)); }
    catch (requestError) { setError(productivityErrorMessage(requestError, "Could not load countdowns.")); }
    finally { setLoading(false); }
  }, [includeArchived]);
  useEffect(() => { void loadItems(); }, [loadItems]);

  const openCreate = () => { setEditingId(null); setDraft(emptyDraft); setDialogOpen(true); setError(""); };
  const openEdit = (item: ProductivityCountdown) => {
    setEditingId(item.id);
    setDraft({ title: item.title, description: item.description, eventDate: item.eventDate, eventTime: item.eventTime || "", category: item.category, color: item.color, recurrence: item.recurrence });
    setDialogOpen(true); setError("");
  };
  const saveCountdown = async () => {
    const payload: CountdownInput = { ...draft, description: draft.description || null, eventTime: draft.eventTime || null, category: draft.category || null };
    setSaving(true); setError("");
    try {
      if (editingId) await productivityApi.updateCountdown(editingId, payload);
      else await productivityApi.createCountdown(payload);
      setDialogOpen(false); setNotice(editingId ? "Countdown updated." : "Countdown created."); await loadItems();
    } catch (requestError) { setError(productivityErrorMessage(requestError, "Could not save this countdown.")); }
    finally { setSaving(false); }
  };
  const archive = async (item: ProductivityCountdown) => {
    if (!window.confirm(`Archive "${item.title}"?`)) return;
    try { await productivityApi.archiveCountdown(item.id); setNotice("Countdown archived."); await loadItems(); }
    catch (requestError) { setError(productivityErrorMessage(requestError, "Could not archive this countdown.")); }
  };
  const restore = async (item: ProductivityCountdown) => {
    try { await productivityApi.updateCountdown(item.id, { status: "active" }); setNotice("Countdown restored."); await loadItems(); }
    catch (requestError) { setError(productivityErrorMessage(requestError, "Could not restore this countdown.")); }
  };

  return <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
        <Box><Typography variant="h1" fontWeight={700}>Countdowns</Typography><Typography color="text.secondary">Keep important dates visible and see how close they are.</Typography></Box>
        <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => setIncludeArchived((value) => !value)}>{includeArchived ? "Hide archived" : "Show archived"}</Button><Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>Add countdown</Button></Stack>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {loading ? <CircularProgress /> : items.length === 0 ? <Card variant="outlined"><CardContent><Stack spacing={1} alignItems="flex-start"><EventOutlinedIcon fontSize="large" color="action"/><Typography variant="h3" fontWeight={650}>Nothing on the countdown yet</Typography><Typography color="text.secondary">Add a birthday, holiday, trip, examination or important deadline.</Typography><Button variant="contained" onClick={openCreate}>Create countdown</Button></Stack></CardContent></Card> : (
        <Grid container spacing={2}>{items.map((item) => <Grid item xs={12} sm={6} lg={4} key={item.id}>
          <Card variant="outlined" sx={{ height: "100%", borderRadius: 2.5, borderTop: `4px solid ${item.color}` }}><CardContent><Stack spacing={1.2}>
            <Stack direction="row" alignItems="flex-start"><Box flex={1} minWidth={0}><Typography variant="h3" fontWeight={700}>{item.title}</Typography>{item.category && <Typography variant="caption" color="text.secondary">{item.category}</Typography>}</Box><Tooltip title="Edit countdown"><IconButton size="small" onClick={() => openEdit(item)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>{item.status !== "archived" ? <Tooltip title="Archive countdown"><IconButton size="small" onClick={() => void archive(item)}><ArchiveOutlinedIcon fontSize="small" /></IconButton></Tooltip> : <Button size="small" onClick={() => void restore(item)}>Restore</Button>}</Stack>
            <Typography variant="h2" fontWeight={800} color={item.daysRemaining < 0 ? "text.secondary" : "primary.main"}>{remainingLabel(item.daysRemaining)}</Typography>
            <Typography variant="body2">{dateLabel(item.nextEventDate)}{item.eventTime ? ` · ${item.eventTime.slice(0, 5)}` : ""}</Typography>
            {item.recurrence === "yearly" && <Typography variant="caption" color="text.secondary">Repeats every year</Typography>}
            {item.description && <Typography variant="body2" color="text.secondary">{item.description}</Typography>}
            {item.status === "archived" && <Typography variant="caption" color="text.secondary">Archived</Typography>}
          </Stack></CardContent></Card>
        </Grid>)}</Grid>
      )}
    </Stack>
    <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{editingId ? "Edit countdown" : "Create countdown"}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
        <TextField label="Event name" required fullWidth value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} inputProps={{ maxLength: 150 }} />
        <TextField label="Date" required type="date" fullWidth InputLabelProps={{ shrink: true }} value={draft.eventDate} onChange={(event) => setDraft((current) => ({ ...current, eventDate: event.target.value }))} />
        <TextField label="Time (optional)" type="time" fullWidth InputLabelProps={{ shrink: true }} value={draft.eventTime} onChange={(event) => setDraft((current) => ({ ...current, eventTime: event.target.value }))} />
        <TextField label="Description" multiline minRows={2} fullWidth value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
        <TextField label="Category" fullWidth value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} inputProps={{ maxLength: 60 }} />
        <TextField select label="Repeat" value={draft.recurrence} onChange={(event) => setDraft((current) => ({ ...current, recurrence: event.target.value as Draft["recurrence"] }))}><MenuItem value="none">Does not repeat</MenuItem><MenuItem value="yearly">Every year (birthdays and anniversaries)</MenuItem></TextField>
        <Stack direction="row" spacing={1} alignItems="center"><Typography variant="body2">Card colour</Typography><TextField type="color" size="small" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} sx={{ width: 90 }} /></Stack>
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={() => void saveCountdown()} disabled={saving || !draft.title.trim() || !draft.eventDate}>{saving ? "Saving…" : "Save countdown"}</Button></DialogActions>
    </Dialog>
  </Box>;
}
