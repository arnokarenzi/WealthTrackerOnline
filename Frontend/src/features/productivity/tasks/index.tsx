import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Grid,
  IconButton, InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type { ProductivityProject, ProductivitySubtask, ProductivityTask, TaskInput } from "../../../services/productivityApi";
import { formatKigaliDate, getKigaliDateInputValue } from "../../../utils/kigaliTime";

type Draft = {
  title: string; description: string; projectId: string; status: ProductivityTask["status"];
  priority: ProductivityTask["priority"]; dueDate: string; dueTime: string;
  scheduledDate: string; scheduledStartTime: string; estimatedMinutes: string;
  isImportant: boolean; isUrgent: boolean;
};

const blankDraft = (projectId = ""): Draft => ({
  title: "", description: "", projectId, status: "todo", priority: "medium",
  dueDate: "", dueTime: "", scheduledDate: "", scheduledStartTime: "",
  estimatedMinutes: "", isImportant: false, isUrgent: false,
});

const toDraft = (task: ProductivityTask): Draft => ({
  title: task.title, description: task.description, projectId: task.projectId ? String(task.projectId) : "",
  status: task.status, priority: task.priority, dueDate: task.dueDate || "", dueTime: task.dueTime || "",
  scheduledDate: task.scheduledDate || "", scheduledStartTime: task.scheduledStartTime || "",
  estimatedMinutes: task.estimatedMinutes == null ? "" : String(task.estimatedMinutes),
  isImportant: task.isImportant, isUrgent: task.isUrgent,
});

const dateLabel = (value: string | null) => value ? formatKigaliDate(value) : "No date";
const priorityColor = (priority: ProductivityTask["priority"]): "default" | "success" | "warning" | "error" =>
  priority === "high" ? "error" : priority === "medium" ? "warning" : priority === "low" ? "success" : "default";

export default function ProductivityTasksPage() {
  const [searchParams] = useSearchParams();
  const initialProject = searchParams.get("projectId") || "";
  const initialSearch = searchParams.get("search") || "";
  const [tasks, setTasks] = useState<ProductivityTask[]>([]);
  const [projects, setProjects] = useState<ProductivityProject[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState("open");
  const [projectFilter, setProjectFilter] = useState(initialProject);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductivityTask | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft(initialProject));
  const [subtasks, setSubtasks] = useState<ProductivitySubtask[]>([]);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskBusy, setSubtaskBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [taskRows, projectRows] = await Promise.all([
        productivityApi.getTasks({
          search: search.trim() || undefined,
          projectId: projectFilter ? Number(projectFilter) : undefined,
          includeCompleted: statusFilter === "all",
          ...(statusFilter === "completed" ? { status: "completed" } : {}),
          ...(statusFilter === "in_progress" ? { status: "in_progress" } : {}),
          ...(statusFilter === "todo" ? { status: "todo" } : {}),
        }),
        productivityApi.getProjects(),
      ]);
      setTasks(taskRows.filter((task) => statusFilter !== "open" || ["todo", "in_progress"].includes(task.status)));
      setProjects(projectRows.filter((project) => project.status === "active"));
    } catch (err) {
      setError(productivityErrorMessage(err, "Could not load tasks. Check the productivity database migration and backend."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [search, statusFilter, projectFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setEditing(null); setDraft(blankDraft(projectFilter)); setSubtasks([]); setSubtaskTitle(""); setDialogOpen(true); };
  const openEdit = async (task: ProductivityTask) => {
    setEditing(task); setDraft(toDraft(task)); setSubtasks([]); setSubtaskTitle(""); setDialogOpen(true);
    try {
      const fullTask = await productivityApi.getTask(task.id);
      setSubtasks(fullTask.subtasks || []);
    } catch (err) {
      setError(productivityErrorMessage(err, "Could not load task checklist."));
    }
  };
  const closeDialog = () => { if (!saving) setDialogOpen(false); };
  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const saveTask = async () => {
    if (!draft.title.trim()) { setError("Enter a task title."); return; }
    const payload: TaskInput = {
      title: draft.title.trim(), description: draft.description.trim() || null,
      projectId: draft.projectId ? Number(draft.projectId) : null,
      status: draft.status, priority: draft.priority,
      dueDate: draft.dueDate || null, dueTime: draft.dueTime || null,
      scheduledDate: draft.scheduledDate || null, scheduledStartTime: draft.scheduledStartTime || null,
      estimatedMinutes: draft.estimatedMinutes ? Number(draft.estimatedMinutes) : null,
      isImportant: draft.isImportant, isUrgent: draft.isUrgent,
    };
    setSaving(true); setError("");
    try {
      if (editing) await productivityApi.updateTask(editing.id, payload);
      else await productivityApi.createTask(payload);
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(productivityErrorMessage(err, "Could not save the task."));
    } finally { setSaving(false); }
  };

  const toggleComplete = async (task: ProductivityTask) => {
    const status = task.status === "completed" ? "todo" : "completed";
    try { await productivityApi.updateTask(task.id, { status }); await load(); }
    catch (err) { setError(productivityErrorMessage(err, "Could not update the task.")); }
  };

  const removeTask = async (task: ProductivityTask) => {
    if (!window.confirm(`Delete “${task.title}” and its subtasks? This cannot be undone.`)) return;
    try { await productivityApi.deleteTask(task.id); await load(); }
    catch (err) { setError(productivityErrorMessage(err, "Could not delete the task.")); }
  };

  const addSubtask = async () => {
    if (!editing || !subtaskTitle.trim()) return;
    setSubtaskBusy(true);
    try {
      await productivityApi.createSubtask(editing.id, { title: subtaskTitle.trim() });
      const fullTask = await productivityApi.getTask(editing.id);
      setSubtasks(fullTask.subtasks || []);
      setSubtaskTitle("");
    } catch (err) { setError(productivityErrorMessage(err, "Could not add checklist item.")); }
    finally { setSubtaskBusy(false); }
  };

  const toggleSubtask = async (subtask: ProductivitySubtask) => {
    try {
      await productivityApi.updateSubtask(subtask.id, { isCompleted: !subtask.isCompleted });
      if (editing) {
        const fullTask = await productivityApi.getTask(editing.id);
        setSubtasks(fullTask.subtasks || []);
      }
    } catch (err) { setError(productivityErrorMessage(err, "Could not update checklist item.")); }
  };

  const removeSubtask = async (subtask: ProductivitySubtask) => {
    try {
      await productivityApi.deleteSubtask(subtask.id);
      if (editing) {
        const fullTask = await productivityApi.getTask(editing.id);
        setSubtasks(fullTask.subtasks || []);
      }
    } catch (err) { setError(productivityErrorMessage(err, "Could not delete checklist item.")); }
  };

  const activeProjectLabel = useMemo(() => projects.find((project) => String(project.id) === projectFilter)?.name, [projects, projectFilter]);

  return (
    <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h1" fontWeight={700}>Tasks</Typography>
            <Typography color="text.secondary">Capture work, set priorities and keep your projects moving.</Typography>
            {activeProjectLabel && <Chip size="small" sx={{ mt: 1 }} label={`Project: ${activeProjectLabel}`} onDelete={() => setProjectFilter("")} />}
          </Box>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>Add task</Button>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField size="small" fullWidth value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" InputProps={{ startAdornment: <SearchOutlinedIcon sx={{ mr: 1, color: "text.secondary" }} /> }} />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as string)}>
              <MenuItem value="open">Open tasks</MenuItem><MenuItem value="all">All tasks</MenuItem><MenuItem value="todo">To do</MenuItem><MenuItem value="in_progress">In progress</MenuItem><MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel>Project</InputLabel>
            <Select label="Project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value as string)}>
              <MenuItem value="">All projects</MenuItem>
              {projects.map((project) => <MenuItem key={project.id} value={String(project.id)}>{project.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>

        {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box> : tasks.length === 0 ? (
          <Card variant="outlined"><CardContent><Typography fontWeight={650}>No tasks found</Typography><Typography color="text.secondary" variant="body2" mt={0.5}>Create a task or adjust your filters. Your tasks will be saved in your FinTrack database.</Typography></CardContent></Card>
        ) : (
          <Stack spacing={1.25}>
            {tasks.map((task) => (
              <Card variant="outlined" key={task.id} sx={{ borderRadius: 2.5 }}>
                <CardContent sx={{ py: "12px !important" }}>
                  <Stack direction="row" alignItems="flex-start" spacing={1.25}>
                    <Checkbox checked={task.status === "completed"} onChange={() => void toggleComplete(task)} sx={{ mt: -0.5 }} inputProps={{ "aria-label": `Complete ${task.title}` }} />
                    <Box flex={1} minWidth={0}>
                      <Typography fontWeight={650} sx={{ textDecoration: task.status === "completed" ? "line-through" : "none", overflowWrap: "anywhere" }}>{task.title}</Typography>
                      {task.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{task.description}</Typography>}
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mt={1}>
                        <Chip size="small" label={task.priority === "none" ? "No priority" : `${task.priority} priority`} color={priorityColor(task.priority)} variant="outlined" />
                        <Chip size="small" label={task.status.replace("_", " ")} variant="outlined" />
                        {task.projectName && <Chip size="small" label={task.projectName} variant="outlined" />}
                        {task.dueDate && <Chip size="small" label={`Due ${dateLabel(task.dueDate)}`} color={task.dueDate < getKigaliDateInputValue() && task.status !== "completed" ? "error" : "default"} variant="outlined" />}
                        {task.scheduledDate && <Chip size="small" label={`Planned ${dateLabel(task.scheduledDate)}`} variant="outlined" />}
                        {task.estimatedMinutes && <Chip size="small" label={`${task.estimatedMinutes} min`} variant="outlined" />}
                        {task.isImportant && <Chip size="small" label="Important" color="warning" variant="outlined" />}
                        {task.isUrgent && <Chip size="small" label="Urgent" color="error" variant="outlined" />}
                      </Stack>
                    </Box>
                    <Tooltip title="Edit task"><IconButton size="small" onClick={() => openEdit(task)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete task"><IconButton size="small" color="error" onClick={() => void removeTask(task)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle>{editing ? "Edit task" : "Create task"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Task title" required fullWidth value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} autoFocus />
            <TextField label="Description" fullWidth multiline minRows={2} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small"><InputLabel>Project</InputLabel><Select label="Project" value={draft.projectId} onChange={(event) => updateDraft("projectId", event.target.value as string)}><MenuItem value="">No project</MenuItem>{projects.map((project) => <MenuItem key={project.id} value={String(project.id)}>{project.name}</MenuItem>)}</Select></FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small"><InputLabel>Priority</InputLabel><Select label="Priority" value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value as Draft["priority"])}><MenuItem value="none">None</MenuItem><MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem></Select></FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small"><InputLabel>Status</InputLabel><Select label="Status" value={draft.status} onChange={(event) => updateDraft("status", event.target.value as Draft["status"])}><MenuItem value="todo">To do</MenuItem><MenuItem value="in_progress">In progress</MenuItem><MenuItem value="completed">Completed</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem></Select></FormControl>
              </Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="number" label="Estimate (minutes)" value={draft.estimatedMinutes} onChange={(event) => updateDraft("estimatedMinutes", event.target.value)} inputProps={{ min: 1, max: 1440 }} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="date" label="Due date" InputLabelProps={{ shrink: true }} value={draft.dueDate} onChange={(event) => updateDraft("dueDate", event.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="time" label="Due time" InputLabelProps={{ shrink: true }} value={draft.dueTime} onChange={(event) => updateDraft("dueTime", event.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="date" label="Planned date" InputLabelProps={{ shrink: true }} value={draft.scheduledDate} onChange={(event) => updateDraft("scheduledDate", event.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="time" label="Planned start time" InputLabelProps={{ shrink: true }} value={draft.scheduledStartTime} onChange={(event) => updateDraft("scheduledStartTime", event.target.value)} /></Grid>
            </Grid>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Stack direction="row" alignItems="center"><Checkbox checked={draft.isImportant} onChange={(event) => updateDraft("isImportant", event.target.checked)} /><Typography variant="body2">Important</Typography></Stack>
              <Stack direction="row" alignItems="center"><Checkbox checked={draft.isUrgent} onChange={(event) => updateDraft("isUrgent", event.target.checked)} /><Typography variant="body2">Urgent</Typography></Stack>
            </Stack>
          </Stack>
          {editing && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={650} sx={{ mb: 1 }}>Checklist</Typography>
              <Stack direction="row" spacing={1}>
                <TextField size="small" fullWidth label="Add checklist item" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addSubtask(); } }} />
                <Button variant="outlined" onClick={() => void addSubtask()} disabled={subtaskBusy || !subtaskTitle.trim()}>Add</Button>
              </Stack>
              {subtasks.length > 0 && <Stack spacing={0.5} sx={{ mt: 1 }}>
                {subtasks.map((subtask) => (
                  <Stack key={subtask.id} direction="row" alignItems="center" spacing={1}>
                    <Checkbox size="small" checked={subtask.isCompleted} onChange={() => void toggleSubtask(subtask)} />
                    <Typography variant="body2" sx={{ flex: 1, textDecoration: subtask.isCompleted ? "line-through" : "none" }}>{subtask.title}</Typography>
                    <IconButton size="small" color="error" onClick={() => void removeSubtask(subtask)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  </Stack>
                ))}
              </Stack>}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={closeDialog} disabled={saving}>Cancel</Button><Button variant="contained" onClick={() => void saveTask()} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create task"}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
