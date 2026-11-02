import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  FormControlLabel, Grid, Stack, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type { ProductivityTask } from "../../../services/productivityApi";
import { formatKigaliDate, getKigaliDateInputValue } from "../../../utils/kigaliTime";

type Quadrant = {
  id: string;
  title: string;
  subtitle: string;
  urgent: boolean;
  important: boolean;
  color: "error" | "warning" | "info" | "default";
  recommendation: string;
};

const QUADRANTS: Quadrant[] = [
  { id: "q1", title: "Do first", subtitle: "Urgent and important", urgent: true, important: true, color: "error", recommendation: "Handle these tasks as soon as possible." },
  { id: "q2", title: "Schedule", subtitle: "Important, not urgent", urgent: false, important: true, color: "success", recommendation: "Protect time for these priorities before they become urgent." },
  { id: "q3", title: "Delegate", subtitle: "Urgent, not important", urgent: true, important: false, color: "warning", recommendation: "Consider whether someone else can handle these tasks." },
  { id: "q4", title: "Review or remove", subtitle: "Neither urgent nor important", urgent: false, important: false, color: "default", recommendation: "Question whether these tasks need to stay on your list." },
];

export default function ProductivityEisenhowerPage() {
  const [tasks, setTasks] = useState<ProductivityTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTasks(await productivityApi.getTasks());
    } catch (err) {
      setError(productivityErrorMessage(err, "Could not load the Eisenhower Matrix. Check the Phase 2 productivity migration."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const changeClassification = async (task: ProductivityTask, field: "isUrgent" | "isImportant", checked: boolean) => {
    setUpdatingId(task.id);
    setError("");
    try {
      const patch = field === "isUrgent" ? { isUrgent: checked } : { isImportant: checked };
      const updated = await productivityApi.updateTask(task.id, patch);
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(productivityErrorMessage(err, "Could not update task priority classification."));
    } finally {
      setUpdatingId(null);
    }
  };

  const today = getKigaliDateInputValue();

  return (
    <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
          <Box>
            <Typography variant="h1" fontWeight={700}>Eisenhower Matrix</Typography>
            <Typography color="text.secondary">Choose what needs attention by separating urgency from importance.</Typography>
          </Box>
          <Button component={RouterLink} to="/productivity/tasks" variant="contained" startIcon={<AddOutlinedIcon />}>Add or manage tasks</Button>
        </Stack>

        <Alert severity="info">Each task appears in one quadrant based on its saved Urgent and Important settings. Changing either setting updates the original task, not a separate copy.</Alert>
        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

        {loading ? <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box> : <Grid container spacing={2}>
          {QUADRANTS.map((quadrant) => {
            const quadrantTasks = tasks.filter((task) => task.isUrgent === quadrant.urgent && task.isImportant === quadrant.important);
            return <Grid item xs={12} md={6} key={quadrant.id}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: "100%", borderTop: 4, borderTopColor: quadrant.color === "default" ? "divider" : `${quadrant.color}.main` }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                      <Box><Typography variant="h5" fontWeight={750}>{quadrant.title}</Typography><Typography variant="body2" color="text.secondary">{quadrant.subtitle}</Typography></Box>
                      <Chip size="small" color={quadrant.color} label={quadrantTasks.length} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{quadrant.recommendation}</Typography>
                    {quadrantTasks.length === 0 ? <Box sx={{ py: 2 }}><Typography color="text.secondary" variant="body2">No open tasks in this quadrant.</Typography></Box> : <Stack spacing={1}>
                      {quadrantTasks.map((task) => <Card key={task.id} variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                          <Stack spacing={1}>
                            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                              <Box minWidth={0} flex={1}>
                                <Typography fontWeight={650} sx={{ overflowWrap: "anywhere" }}>{task.title}</Typography>
                                {task.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{task.description}</Typography>}
                              </Box>
                              {updatingId === task.id && <CircularProgress size={18} />}
                            </Stack>
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                              <Chip size="small" variant="outlined" label={task.priority === "none" ? "No priority" : `${task.priority} priority`} />
                              {task.projectName && <Chip size="small" variant="outlined" label={task.projectName} />}
                              {task.dueDate && <Chip size="small" color={task.dueDate < today ? "error" : "default"} variant="outlined" label={`Due ${formatKigaliDate(task.dueDate)}`} />}
                            </Stack>
                            <Stack direction="row" flexWrap="wrap" useFlexGap>
                              <FormControlLabel control={<Checkbox size="small" checked={task.isUrgent} disabled={updatingId === task.id} onChange={(event) => void changeClassification(task, "isUrgent", event.target.checked)} />} label={<Typography variant="caption">Urgent</Typography>} />
                              <FormControlLabel control={<Checkbox size="small" checked={task.isImportant} disabled={updatingId === task.id} onChange={(event) => void changeClassification(task, "isImportant", event.target.checked)} />} label={<Typography variant="caption">Important</Typography>} />
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>)}
                    </Stack>}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>;
          })}
        </Grid>}
        <Typography color="text.secondary" variant="caption">Completed and cancelled tasks are excluded. To change a task's other details, open Tasks.</Typography>
      </Stack>
    </Box>
  );
}
