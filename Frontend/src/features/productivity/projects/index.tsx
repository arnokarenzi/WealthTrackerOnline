import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardActions, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, Stack,
  TextField, Tooltip, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type { ProductivityProject, ProjectInput } from "../../../services/productivityApi";
import { formatKigaliDate } from "../../../utils/kigaliTime";

type Draft = { name: string; description: string; color: string; targetDate: string };
const blankDraft: Draft = { name: "", description: "", color: "#1976d2", targetDate: "" };

export default function ProductivityProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProductivityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductivityProject | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);

  const load = async () => {
    setLoading(true); setError("");
    try { setProjects(await productivityApi.getProjects()); }
    catch (err) { setError(productivityErrorMessage(err, "Could not load projects. Apply the productivity tasks migration and retry.")); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setEditing(null); setDraft(blankDraft); setDialogOpen(true); };
  const openEdit = (project: ProductivityProject) => {
    setEditing(project); setDraft({ name: project.name, description: project.description, color: project.color, targetDate: project.targetDate || "" }); setDialogOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) { setError("Project name is required."); return; }
    const payload: ProjectInput = { name: draft.name.trim(), description: draft.description.trim() || null, color: draft.color, targetDate: draft.targetDate || null };
    setSaving(true); setError("");
    try {
      if (editing) await productivityApi.updateProject(editing.id, payload);
      else await productivityApi.createProject(payload);
      setDialogOpen(false); await load();
    } catch (err) { setError(productivityErrorMessage(err, "Could not save project.")); }
    finally { setSaving(false); }
  };

  const archive = async (project: ProductivityProject) => {
    if (!window.confirm(`Archive “${project.name}”? Its tasks will be retained and will no longer be assigned to new tasks.`)) return;
    try { await productivityApi.archiveProject(project.id); await load(); }
    catch (err) { setError(productivityErrorMessage(err, "Could not archive project.")); }
  };

  return (
    <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Box><Typography variant="h1" fontWeight={700}>Projects</Typography><Typography color="text.secondary">Group related tasks and keep track of meaningful outcomes.</Typography></Box>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>New project</Button>
        </Stack>
        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
        {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box> : projects.length === 0 ? (
          <Card variant="outlined"><CardContent><Typography fontWeight={650}>No projects yet</Typography><Typography color="text.secondary" variant="body2" mt={0.5}>Create a project for a personal goal, learning plan, home activity or other area of work.</Typography><Button sx={{ mt: 1.5 }} startIcon={<AddOutlinedIcon />} onClick={openCreate}>Create your first project</Button></CardContent></Card>
        ) : (
          <Grid container spacing={2}>
            {projects.map((project) => {
              const progress = project.taskCount > 0 ? Math.round((project.completedTaskCount / project.taskCount) * 100) : 0;
              return (
                <Grid item xs={12} sm={6} lg={4} key={project.id}>
                  <Card variant="outlined" sx={{ height: "100%", borderRadius: 3, borderTop: `4px solid ${project.color}` }}>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1} alignItems="center" minWidth={0}><FolderOutlinedIcon sx={{ color: project.color }} /><Typography variant="h5" fontWeight={650} noWrap>{project.name}</Typography></Stack>
                        <Chip size="small" label={project.status} variant="outlined" />
                      </Stack>
                      {project.description && <Typography color="text.secondary" variant="body2" sx={{ mt: 1.25, minHeight: 42 }}>{project.description}</Typography>}
                      <Stack spacing={0.75} sx={{ mt: 2 }}>
                        <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Task progress</Typography><Typography variant="caption" fontWeight={650}>{progress}%</Typography></Stack>
                        <Box sx={{ height: 8, borderRadius: 10, bgcolor: "action.hover", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${progress}%`, bgcolor: project.color, borderRadius: 10 }} /></Box>
                        <Typography variant="caption" color="text.secondary">{project.completedTaskCount} of {project.taskCount} tasks completed</Typography>
                      </Stack>
                      {project.targetDate && <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Target: {formatKigaliDate(project.targetDate)}</Typography>}
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2 }}>
                      <Button size="small" onClick={() => navigate(`/productivity/tasks?projectId=${project.id}`)}>View tasks</Button>
                      <Box flex={1} />
                      <Tooltip title="Edit project"><IconButton size="small" onClick={() => openEdit(project)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Archive project"><IconButton size="small" onClick={() => void archive(project)}><ArchiveOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
        <Button component={RouterLink} to="/productivity/tasks" variant="text" sx={{ alignSelf: "flex-start" }}>Open all tasks</Button>
      </Stack>
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit project" : "Create project"}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Project name" required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} autoFocus />
          <TextField label="Description" multiline minRows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          <Stack direction="row" spacing={2} alignItems="center"><TextField label="Project color" type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} sx={{ width: 150 }} InputLabelProps={{ shrink: true }} /><TextField label="Target date" type="date" value={draft.targetDate} onChange={(event) => setDraft((current) => ({ ...current, targetDate: event.target.value }))} InputLabelProps={{ shrink: true }} fullWidth /></Stack>
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create project"}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
