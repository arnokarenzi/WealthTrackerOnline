import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, IconButton, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type { NoteInput, ProductivityNote } from "../../../services/productivityApi";

const emptyDraft: NoteInput = { title: "", content: "", category: "", color: "#fff4cc", isPinned: false };
const dateLabel = (value: string) => new Date(value).toLocaleString();

export default function ProductivityNotesPage() {
  const [notes, setNotes] = useState<ProductivityNote[]>([]);
  const [draft, setDraft] = useState<NoteInput>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true); setError("");
    try { setNotes(await productivityApi.getNotes(includeArchived, search)); }
    catch (requestError) { setError(productivityErrorMessage(requestError, "Could not load notes.")); }
    finally { setLoading(false); }
  }, [includeArchived, search]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadNotes(); }, 250); return () => window.clearTimeout(timer); }, [loadNotes]);

  const openCreate = () => { setEditingId(null); setDraft(emptyDraft); setError(""); setDialogOpen(true); };
  const openEdit = (note: ProductivityNote) => {
    setEditingId(note.id);
    setDraft({ title: note.title, content: note.content, category: note.category, color: note.color, isPinned: note.isPinned, status: note.status });
    setError(""); setDialogOpen(true);
  };
  const saveNote = async () => {
    setSaving(true); setError("");
    try {
      if (editingId) await productivityApi.updateNote(editingId, draft);
      else await productivityApi.createNote(draft);
      setDialogOpen(false); setNotice(editingId ? "Note updated." : "Note saved."); await loadNotes();
    } catch (requestError) { setError(productivityErrorMessage(requestError, "Could not save this note.")); }
    finally { setSaving(false); }
  };
  const togglePin = async (note: ProductivityNote) => {
    try { await productivityApi.updateNote(note.id, { isPinned: !note.isPinned }); await loadNotes(); }
    catch (requestError) { setError(productivityErrorMessage(requestError, "Could not update the pinned state.")); }
  };
  const archive = async (note: ProductivityNote) => {
    if (!window.confirm(`Archive this note${note.title ? ` ("${note.title}")` : ""}?`)) return;
    try { await productivityApi.archiveNote(note.id); setNotice("Note archived."); await loadNotes(); }
    catch (requestError) { setError(productivityErrorMessage(requestError, "Could not archive this note.")); }
  };
  const restore = async (note: ProductivityNote) => {
    try { await productivityApi.updateNote(note.id, { status: "active" }); setNotice("Note restored."); await loadNotes(); }
    catch (requestError) { setError(productivityErrorMessage(requestError, "Could not restore this note.")); }
  };

  return <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
        <Box><Typography variant="h1" fontWeight={700}>Notes</Typography><Typography color="text.secondary">Capture ideas, keep useful information and organize it when you're ready.</Typography></Box>
        <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => setIncludeArchived((value) => !value)}>{includeArchived ? "Hide archived" : "Show archived"}</Button><Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>Quick note</Button></Stack>
      </Stack>
      <TextField fullWidth size="small" placeholder="Search note titles, content or categories" value={search} onChange={(event) => setSearch(event.target.value)} />
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {loading ? <CircularProgress /> : notes.length === 0 ? <Card variant="outlined"><CardContent><Typography variant="h3" fontWeight={650}>Nothing captured yet</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>Use Quick note to save an idea, reminder or useful piece of information.</Typography><Button sx={{ mt: 1.5 }} variant="contained" onClick={openCreate}>Create a note</Button></CardContent></Card> : (
        <Grid container spacing={2}>{notes.map((note) => <Grid item xs={12} sm={6} lg={4} key={note.id}>
          <Card variant="outlined" sx={{ height: "100%", borderRadius: 2.5, borderTop: `4px solid ${note.color}` }}><CardContent><Stack spacing={1.2}>
            <Stack direction="row" alignItems="flex-start"><Box flex={1} minWidth={0}><Typography variant="h3" fontWeight={700}>{note.title || "Untitled note"}</Typography>{note.category && <Typography variant="caption" color="text.secondary">{note.category}</Typography>}</Box><Tooltip title={note.isPinned ? "Unpin note" : "Pin note"}><IconButton size="small" onClick={() => void togglePin(note)} color={note.isPinned ? "primary" : "default"}><PushPinOutlinedIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Edit note"><IconButton size="small" onClick={() => openEdit(note)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>{note.status !== "archived" ? <Tooltip title="Archive note"><IconButton size="small" onClick={() => void archive(note)}><ArchiveOutlinedIcon fontSize="small" /></IconButton></Tooltip> : <Button size="small" onClick={() => void restore(note)}>Restore</Button>}</Stack>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 230, overflow: "hidden" }}>{note.content}</Typography>
            <Typography variant="caption" color="text.secondary">Updated {dateLabel(note.updatedAt)}</Typography>
          </Stack></CardContent></Card>
        </Grid>)}</Grid>
      )}
    </Stack>
    <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{editingId ? "Edit note" : "Quick note"}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
        <TextField label="Title (optional)" fullWidth value={draft.title || ""} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} inputProps={{ maxLength: 200 }} />
        <TextField label="Your note" required fullWidth multiline minRows={7} value={draft.content || ""} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} inputProps={{ maxLength: 100000 }} />
        <TextField label="Category (optional)" fullWidth value={draft.category || ""} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} inputProps={{ maxLength: 60 }} />
        <Stack direction="row" spacing={1} alignItems="center"><Typography variant="body2">Note colour</Typography><TextField type="color" size="small" value={draft.color || "#fff4cc"} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} sx={{ width: 90 }} /></Stack>
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={() => void saveNote()} disabled={saving || !draft.content?.trim()}>{saving ? "Saving…" : "Save note"}</Button></DialogActions>
    </Dialog>
  </Box>;
}
