import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel,
  FormGroup, Grid, IconButton, InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import LocalFireDepartmentOutlinedIcon from "@mui/icons-material/LocalFireDepartmentOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type { HabitInput, ProductivityHabit } from "../../../services/productivityApi";

const weekdays = [
  { label: "Sun", value: 0 }, { label: "Mon", value: 1 }, { label: "Tue", value: 2 },
  { label: "Wed", value: 3 }, { label: "Thu", value: 4 }, { label: "Fri", value: 5 }, { label: "Sat", value: 6 },
];
const getKigaliDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const emptyDraft: HabitInput = {
  name: "", description: "", category: "", frequency: "daily", daysOfWeek: [], color: "#1976d2",
};

export default function ProductivityHabitsPage() {
  const today = getKigaliDate();
  const [habits, setHabits] = useState<ProductivityHabit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyHabitId, setBusyHabitId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<HabitInput>(emptyDraft);

  const loadHabits = useCallback(async () => {
    try {
      setError("");
      setHabits(await productivityApi.getHabits());
    } catch (requestError) {
      setError(productivityErrorMessage(requestError, "Could not load habits. Apply the Phase 4 migration and try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadHabits(); }, [loadHabits]);

  const openCreate = () => {
    setEditingId(null);
    setDraft({ ...emptyDraft, daysOfWeek: [] });
    setDialogOpen(true);
  };

  const openEdit = (habit: ProductivityHabit) => {
    setEditingId(habit.id);
    setDraft({
      name: habit.name, description: habit.description, category: habit.category,
      frequency: habit.frequency, daysOfWeek: habit.daysOfWeek, color: habit.color,
    });
    setDialogOpen(true);
  };

  const updateDraft = <K extends keyof HabitInput>(field: K, value: HabitInput[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const toggleDay = (day: number, checked: boolean) => {
    setDraft((current) => {
      const selected = new Set<number>(current.daysOfWeek || []);
      if (checked) selected.add(day); else selected.delete(day);
      return { ...current, daysOfWeek: [...selected].sort((a, b) => a - b) };
    });
  };

  const saveHabit = async () => {
    if (!draft.name?.trim()) return;
    setSaving(true);
    setNotice("");
    try {
      const payload: HabitInput = {
        name: draft.name.trim(), description: draft.description || null,
        category: draft.category || null, frequency: draft.frequency || "daily",
        daysOfWeek: draft.frequency === "selected_days" ? draft.daysOfWeek || [] : [],
        color: draft.color || "#1976d2",
      };
      if (editingId) await productivityApi.updateHabit(editingId, payload);
      else await productivityApi.createHabit(payload);
      setDialogOpen(false);
      setNotice(editingId ? "Habit updated." : "Habit created.");
      await loadHabits();
    } catch (requestError) {
      setError(productivityErrorMessage(requestError, "Could not save this habit."));
    } finally { setSaving(false); }
  };

  const toggleLog = async (habit: ProductivityHabit, date: string, completed: boolean) => {
    setBusyHabitId(habit.id);
    setError("");
    try {
      await productivityApi.saveHabitLog(habit.id, { logDate: date, isCompleted: completed });
      await loadHabits();
    } catch (requestError) {
      setError(productivityErrorMessage(requestError, "Could not save the habit completion."));
    } finally { setBusyHabitId(null); }
  };

  const archive = async (habit: ProductivityHabit) => {
    if (!window.confirm(`Archive "${habit.name}"? Its completion history will be preserved.`)) return;
    setBusyHabitId(habit.id);
    try {
      await productivityApi.archiveHabit(habit.id);
      setNotice("Habit archived. Its history has been preserved.");
      await loadHabits();
    } catch (requestError) {
      setError(productivityErrorMessage(requestError, "Could not archive this habit."));
    } finally { setBusyHabitId(null); }
  };

  const completedToday = habits.filter((habit) => habit.todayStatus === "completed").length;
  const dueToday = habits.filter((habit) => habit.todayStatus !== "not_scheduled").length;

  return (
    <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2}>
          <Box>
            <Typography variant="h1" fontWeight={700}>Habits</Typography>
            <Typography color="text.secondary">Build consistent routines and review your completion history.</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>Add habit</Button>
        </Stack>

        <Alert severity="info">Habit streaks count consecutive scheduled days. Non-scheduled days do not break a streak. Today's incomplete habit remains open until the day passes.</Alert>
        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
        {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

        <Grid container spacing={1.5}>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent><Typography color="text.secondary" variant="body2">Active habits</Typography><Typography variant="h3" fontWeight={750}>{habits.length}</Typography></CardContent></Card></Grid>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent><Typography color="text.secondary" variant="body2">Due today</Typography><Typography variant="h3" fontWeight={750}>{dueToday}</Typography></CardContent></Card></Grid>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent><Typography color="text.secondary" variant="body2">Completed today</Typography><Typography variant="h3" fontWeight={750}>{completedToday}</Typography></CardContent></Card></Grid>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent><Typography color="text.secondary" variant="body2">Today's completion</Typography><Typography variant="h3" fontWeight={750}>{dueToday ? Math.round(completedToday / dueToday * 100) : 0}%</Typography></CardContent></Card></Grid>
        </Grid>

        {loading ? <CircularProgress /> : habits.length === 0 ? (
          <Card variant="outlined"><CardContent><Stack spacing={1} alignItems="flex-start">
            <CheckCircleOutlineOutlinedIcon color="action" fontSize="large" />
            <Typography variant="h3" fontWeight={650}>Start with one small habit</Typography>
            <Typography color="text.secondary">Add a daily or selected-days routine. You can track completion, streaks and the last seven days here.</Typography>
            <Button variant="contained" onClick={openCreate}>Create your first habit</Button>
          </Stack></CardContent></Card>
        ) : (
          <Grid container spacing={2}>
            {habits.map((habit) => (
              <Grid item xs={12} md={6} key={habit.id}>
                <Card variant="outlined" sx={{ height: "100%", borderTop: `4px solid ${habit.color}` }}>
                  <CardContent>
                    <Stack spacing={1.6}>
                      <Stack direction="row" alignItems="flex-start" spacing={1}>
                        <Box flex={1} minWidth={0}>
                          <Typography variant="h3" fontWeight={700}>{habit.name}</Typography>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.5 }}>
                            {habit.category && <Chip size="small" label={habit.category} />}
                            <Chip size="small" variant="outlined" label={habit.frequency === "daily" ? "Every day" : habit.daysOfWeek.map((day) => weekdays[day].label).join(" · ")} />
                          </Stack>
                        </Box>
                        <IconButton aria-label="Edit habit" onClick={() => openEdit(habit)}><EditOutlinedIcon /></IconButton>
                        <IconButton aria-label="Archive habit" onClick={() => void archive(habit)} disabled={busyHabitId === habit.id}><ArchiveOutlinedIcon /></IconButton>
                      </Stack>
                      {habit.description && <Typography color="text.secondary" variant="body2">{habit.description}</Typography>}
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Stack direction="row" spacing={0.6} alignItems="center">
                            <LocalFireDepartmentOutlinedIcon color="warning" />
                            <Typography fontWeight={700}>{habit.currentStreak} day streak</Typography>
                          </Stack>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary" textAlign="right">{habit.completionRate30Days}% over 30 days</Typography>
                        </Grid>
                      </Grid>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={650}>Last 7 days</Typography>
                        <Typography variant="caption" color="text.secondary">{habit.completedDays30Days}/{habit.scheduledDays30Days} scheduled days completed in 30 days</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} justifyContent="space-between">
                        {habit.recentLogs.map((log) => (
                          <Tooltip title={`${log.date}${log.isScheduled ? (log.isCompleted ? " · Completed" : " · Not completed") : " · Not scheduled"}`} key={log.date}>
                            <Stack alignItems="center" spacing={0.2}>
                              <Typography variant="caption" color="text.secondary">{weekdays[new Date(`${log.date}T00:00:00Z`).getUTCDay()].label}</Typography>
                              <Checkbox
                                size="small"
                                checked={log.isCompleted}
                                disabled={!log.isScheduled || busyHabitId === habit.id}
                                onChange={(event) => void toggleLog(habit, log.date, event.target.checked)}
                                sx={{ p: 0.25, color: habit.color, "&.Mui-checked": { color: habit.color } }}
                              />
                            </Stack>
                          </Tooltip>
                        ))}
                      </Stack>
                      <Button
                        fullWidth
                        variant={habit.todayStatus === "completed" ? "outlined" : "contained"}
                        disabled={habit.todayStatus === "not_scheduled" || busyHabitId === habit.id}
                        onClick={() => void toggleLog(habit, today, habit.todayStatus !== "completed")}
                      >
                        {busyHabitId === habit.id ? "Saving…" : habit.todayStatus === "completed" ? "Undo today's completion" : habit.todayStatus === "not_scheduled" ? "Not scheduled today" : "Mark complete today"}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit habit" : "Create habit"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Habit name" required fullWidth value={draft.name || ""} onChange={(event) => updateDraft("name", event.target.value)} inputProps={{ maxLength: 120 }} />
            <TextField label="Description" fullWidth multiline minRows={2} value={draft.description || ""} onChange={(event) => updateDraft("description", event.target.value)} />
            <TextField label="Category (optional)" fullWidth value={draft.category || ""} onChange={(event) => updateDraft("category", event.target.value)} inputProps={{ maxLength: 60 }} />
            <FormControl fullWidth>
              <InputLabel>Schedule</InputLabel>
              <Select label="Schedule" value={draft.frequency || "daily"} onChange={(event) => updateDraft("frequency", event.target.value as HabitInput["frequency"])}>
                <MenuItem value="daily">Every day</MenuItem>
                <MenuItem value="selected_days">Selected days of the week</MenuItem>
              </Select>
            </FormControl>
            {draft.frequency === "selected_days" && (
              <FormGroup row>
                {weekdays.map((day) => <FormControlLabel key={day.value} control={<Checkbox checked={(draft.daysOfWeek || []).includes(day.value)} onChange={(event) => toggleDay(day.value, event.target.checked)} />} label={day.label} />)}
              </FormGroup>
            )}
            <Stack direction="row" alignItems="center" spacing={2}>
              <TextField label="Habit colour" type="color" value={draft.color || "#1976d2"} onChange={(event) => updateDraft("color", event.target.value)} sx={{ width: 160 }} InputLabelProps={{ shrink: true }} />
              <Typography variant="caption" color="text.secondary">Used as the habit card accent.</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveHabit()} disabled={saving || !draft.name?.trim() || (draft.frequency === "selected_days" && !(draft.daysOfWeek || []).length)}>{saving ? "Saving…" : editingId ? "Save changes" : "Create habit"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
