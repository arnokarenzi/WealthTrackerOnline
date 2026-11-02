import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, Grid, IconButton, LinearProgress,
  MenuItem, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type { GoalInput, GoalMilestoneInput, ProductivityGoal, ProductivityGoalMilestone } from "../../../services/productivityApi";

type Draft = {
  name: string; description: string; category: string; status: ProductivityGoal["status"];
  startDate: string; targetDate: string; progressMode: "milestones" | "manual"; manualProgress: number;
};
const emptyDraft: Draft = {
  name: "", description: "", category: "", status: "active", startDate: "", targetDate: "",
  progressMode: "milestones", manualProgress: 0,
};
const dateLabel = (value: string | null) => value ? new Date(`${value}T00:00:00Z`).toLocaleDateString() : "No target date";

export default function ProductivityGoalsPage() {
  const [goals, setGoals] = useState<ProductivityGoal[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [milestones, setMilestones] = useState<ProductivityGoalMilestone[]>([]);
  const [milestoneDraft, setMilestoneDraft] = useState<GoalMilestoneInput>({ title: "", dueDate: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyMilestone, setBusyMilestone] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadGoals = useCallback(async () => {
    setLoading(true); setError("");
    try { setGoals(await productivityApi.getGoals(includeArchived)); }
    catch (requestError) { setError(productivityErrorMessage(requestError, "Could not load personal goals.")); }
    finally { setLoading(false); }
  }, [includeArchived]);

  useEffect(() => { void loadGoals(); }, [loadGoals]);

  const openCreate = () => {
    setEditingId(null); setDraft(emptyDraft); setMilestones([]); setMilestoneDraft({ title: "", dueDate: "" });
    setError(""); setDialogOpen(true);
  };

  const openEdit = async (goal: ProductivityGoal) => {
    setError("");
    try {
      const detail = await productivityApi.getGoal(goal.id);
      setEditingId(goal.id);
      setDraft({
        name: detail.name, description: detail.description, category: detail.category,
        status: detail.status,
        startDate: detail.startDate || "", targetDate: detail.targetDate || "",
        progressMode: detail.progressMode, manualProgress: detail.manualProgress,
      });
      setMilestones(detail.milestones || []);
      setMilestoneDraft({ title: "", dueDate: "" });
      setDialogOpen(true);
    } catch (requestError) { setError(productivityErrorMessage(requestError, "Could not load this goal.")); }
  };

  const saveGoal = async () => {
    const payload: GoalInput = {
      name: draft.name, description: draft.description || null, category: draft.category || null,
      status: draft.status, startDate: draft.startDate || null, targetDate: draft.targetDate || null,
      progressMode: draft.progressMode, manualProgress: draft.manualProgress,
    };
    setSaving(true); setError("");
    try {
      if (editingId) await productivityApi.updateGoal(editingId, payload);
      else await productivityApi.createGoal(payload);
      setDialogOpen(false); setNotice(editingId ? "Goal updated." : "Goal created."); await loadGoals();
    } catch (requestError) { setError(productivityErrorMessage(requestError, "Could not save this goal.")); }
    finally { setSaving(false); }
  };

  const addMilestone = async () => {
    if (!editingId || !milestoneDraft.title?.trim()) return;
    setBusyMilestone(-1); setError("");
    try {
      await productivityApi.createGoalMilestone(editingId, milestoneDraft);
      const updated = await productivityApi.getGoal(editingId);
      setMilestones(updated.milestones || []); setMilestoneDraft({ title: "", dueDate: "" }); await loadGoals();
    } catch (requestError) { setError(productivityErrorMessage(requestError, "Could not add the milestone.")); }
    finally { setBusyMilestone(null); }
  };

  const toggleMilestone = async (milestone: ProductivityGoalMilestone, isCompleted: boolean) => {
    setBusyMilestone(milestone.id); setError("");
    try {
      await productivityApi.updateGoalMilestone(milestone.id, { isCompleted });
      const updated = await productivityApi.getGoal(milestone.goalId);
      setMilestones(updated.milestones || []); await loadGoals();
    } catch (requestError) { setError(productivityErrorMessage(requestError, "Could not update the milestone.")); }
    finally { setBusyMilestone(null); }
  };

  const removeMilestone = async (milestone: ProductivityGoalMilestone) => {
    if (!window.confirm(`Delete milestone "${milestone.title}"?`)) return;
    setBusyMilestone(milestone.id);
    try {
      await productivityApi.deleteGoalMilestone(milestone.id);
      const updated = await productivityApi.getGoal(milestone.goalId);
      setMilestones(updated.milestones || []); await loadGoals();
    } catch (requestError) { setError(productivityErrorMessage(requestError, "Could not delete the milestone.")); }
    finally { setBusyMilestone(null); }
  };

  const archive = async (goal: ProductivityGoal) => {
    if (!window.confirm(`Archive "${goal.name}"? Its milestones will be preserved.`)) return;
    try { await productivityApi.archiveGoal(goal.id); setNotice("Goal archived. Its milestones were preserved."); await loadGoals(); }
    catch (requestError) { setError(productivityErrorMessage(requestError, "Could not archive this goal.")); }
  };

  return <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
        <Box><Typography variant="h1" fontWeight={700}>Personal Goals</Typography><Typography color="text.secondary">Turn long-term ambitions into measurable milestones.</Typography></Box>
        <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => setIncludeArchived((value) => !value)}>{includeArchived ? "Hide archived" : "Show archived"}</Button><Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>Add goal</Button></Stack>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {loading ? <CircularProgress /> : goals.length === 0 ? <Card variant="outlined"><CardContent><Stack spacing={1} alignItems="flex-start"><FlagOutlinedIcon fontSize="large" color="action"/><Typography variant="h3" fontWeight={650}>Start with a meaningful goal</Typography><Typography color="text.secondary">Create a goal, add milestones and watch your progress build over time.</Typography><Button variant="contained" onClick={openCreate}>Create your first goal</Button></Stack></CardContent></Card> : (
        <Grid container spacing={2}>{goals.map((goal) => <Grid item xs={12} md={6} key={goal.id}>
          <Card variant="outlined" sx={{ height: "100%", borderRadius: 2.5 }}><CardContent><Stack spacing={1.4}>
            <Stack direction="row" alignItems="flex-start" spacing={1}><Box flex={1} minWidth={0}><Typography variant="h3" fontWeight={700}>{goal.name}</Typography><Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.6 }}>{goal.category && <Typography variant="caption" color="text.secondary">{goal.category}</Typography>}<Typography variant="caption" color="text.secondary">{goal.status}</Typography></Stack></Box><Tooltip title="Edit goal and milestones"><IconButton onClick={() => void openEdit(goal)}><EditOutlinedIcon /></IconButton></Tooltip>{goal.status !== "archived" && <Tooltip title="Archive goal"><IconButton onClick={() => void archive(goal)}><ArchiveOutlinedIcon /></IconButton></Tooltip>}</Stack>
            {goal.description && <Typography variant="body2" color="text.secondary">{goal.description}</Typography>}
            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" fontWeight={650}>Progress</Typography><Typography variant="body2" fontWeight={700}>{goal.progress}%</Typography></Stack>
            <LinearProgress variant="determinate" value={goal.progress} sx={{ height: 8, borderRadius: 5 }} />
            <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">{goal.progressMode === "manual" ? "Manual progress" : `${goal.completedMilestoneCount}/${goal.milestoneCount} milestones complete`}</Typography><Typography variant="caption" color="text.secondary">{dateLabel(goal.targetDate)}</Typography></Stack>
            <Button size="small" variant="outlined" onClick={() => void openEdit(goal)}>Manage goal</Button>
          </Stack></CardContent></Card>
        </Grid>)}</Grid>
      )}
    </Stack>
    <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{editingId ? "Manage goal" : "Create personal goal"}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
        <TextField label="Goal name" required fullWidth value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} inputProps={{ maxLength: 150 }} />
        <TextField label="Description" fullWidth multiline minRows={2} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
        <TextField label="Category" fullWidth value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} inputProps={{ maxLength: 60 }} />
        <Grid container spacing={1.5}><Grid item xs={6}><TextField label="Start date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></Grid><Grid item xs={6}><TextField label="Target date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={draft.targetDate} onChange={(event) => setDraft((current) => ({ ...current, targetDate: event.target.value }))} /></Grid></Grid>
        <TextField select label="Progress method" value={draft.progressMode} onChange={(event) => setDraft((current) => ({ ...current, progressMode: event.target.value as Draft["progressMode"] }))}><MenuItem value="milestones">Calculate from milestones</MenuItem><MenuItem value="manual">Set manually</MenuItem></TextField>
        {draft.progressMode === "manual" && <TextField type="number" label="Progress (%)" value={draft.manualProgress} onChange={(event) => setDraft((current) => ({ ...current, manualProgress: Number(event.target.value) }))} inputProps={{ min: 0, max: 100 }} />}
        <TextField select label="Status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as Draft["status"] }))}><MenuItem value="active">Active</MenuItem><MenuItem value="completed">Completed</MenuItem><MenuItem value="archived">Archived</MenuItem></TextField>
        {editingId !== null && <><Divider /><Typography variant="h3" fontWeight={650}>Milestones</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField fullWidth size="small" label="New milestone" value={milestoneDraft.title || ""} onChange={(event) => setMilestoneDraft((current) => ({ ...current, title: event.target.value }))} /><TextField size="small" label="Due date" type="date" InputLabelProps={{ shrink: true }} value={milestoneDraft.dueDate || ""} onChange={(event) => setMilestoneDraft((current) => ({ ...current, dueDate: event.target.value }))} /><Button variant="outlined" onClick={() => void addMilestone()} disabled={!milestoneDraft.title?.trim() || busyMilestone === -1}>Add</Button></Stack>
          {milestones.length === 0 ? <Typography variant="body2" color="text.secondary">No milestones yet.</Typography> : milestones.map((milestone) => <Stack key={milestone.id} direction="row" alignItems="center" spacing={1}><Checkbox checked={milestone.isCompleted} disabled={busyMilestone === milestone.id} onChange={(event) => void toggleMilestone(milestone, event.target.checked)} /><Box flex={1} minWidth={0}><Typography sx={{ textDecoration: milestone.isCompleted ? "line-through" : "none" }}>{milestone.title}</Typography>{milestone.dueDate && <Typography variant="caption" color="text.secondary">Due {dateLabel(milestone.dueDate)}</Typography>}</Box><IconButton size="small" aria-label="Delete milestone" onClick={() => void removeMilestone(milestone)} disabled={busyMilestone === milestone.id}><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton></Stack>)}</>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setDialogOpen(false)} disabled={saving}>Close</Button><Button variant="contained" onClick={() => void saveGoal()} disabled={saving || !draft.name.trim()}>{saving ? "Saving…" : "Save goal"}</Button></DialogActions>
    </Dialog>
  </Box>;
}
