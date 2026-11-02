import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Divider, Stack, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type { ProductivityMyDay, ProductivityTask } from "../../../services/productivityApi";
import { formatKigaliDate } from "../../../utils/kigaliTime";

const formatDate = (value: string) => formatKigaliDate(value);
const TaskGroup = ({ title, tasks, color, onToggle }: { title: string; tasks: ProductivityTask[]; color: "error" | "primary" | "success"; onToggle: (task: ProductivityTask) => void }) => (
  <Card variant="outlined" sx={{ borderRadius: 3 }}>
    <CardContent>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="h5" fontWeight={650}>{title}</Typography><Chip size="small" color={color} label={tasks.length} />
      </Stack>
      {tasks.length === 0 ? <Typography color="text.secondary" variant="body2">Nothing here.</Typography> : <Stack divider={<Divider flexItem />}>
        {tasks.map((task) => <Stack key={task.id} direction="row" spacing={1} alignItems="flex-start" sx={{ py: 1 }}>
          <Checkbox size="small" checked={task.status === "completed"} onChange={() => onToggle(task)} sx={{ mt: -0.5 }} />
          <Box flex={1} minWidth={0}>
            <Typography fontWeight={600} sx={{ textDecoration: task.status === "completed" ? "line-through" : "none", overflowWrap: "anywhere" }}>{task.title}</Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {task.projectName && <Chip size="small" variant="outlined" label={task.projectName} />}
              {task.dueDate && <Chip size="small" variant="outlined" label={`Due ${formatKigaliDate(task.dueDate)}`} />}
              {task.scheduledStartTime && <Chip size="small" variant="outlined" label={`Starts ${task.scheduledStartTime.slice(0, 5)}`} />}
            </Stack>
          </Box>
        </Stack>)}
      </Stack>}
    </CardContent>
  </Card>
);

export default function ProductivityMyDayPage() {
  const [day, setDay] = useState<ProductivityMyDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { setDay(await productivityApi.getMyDay()); }
    catch (err) { setError(productivityErrorMessage(err, "Could not load My Day. Check that the productivity task migration is applied.")); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = async (task: ProductivityTask) => {
    try { await productivityApi.updateTask(task.id, { status: task.status === "completed" ? "todo" : "completed" }); await load(); }
    catch (err) { setError(productivityErrorMessage(err, "Could not update task status.")); }
  };

  return <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
        <Box><Typography variant="h1" fontWeight={700}>My Day</Typography><Typography color="text.secondary">{day ? formatDate(day.date) : "Your daily plan and priorities."}</Typography></Box>
        <Button component={RouterLink} to="/productivity/tasks" variant="contained" startIcon={<AddOutlinedIcon />}>Add or manage tasks</Button>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box> : day ? <>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip icon={<EventAvailableOutlinedIcon />} label={`${day.totals.today} planned or due today`} color="primary" variant="outlined" />
          <Chip label={`${day.totals.overdue} overdue`} color={day.totals.overdue ? "error" : "default"} variant="outlined" />
          <Chip label={`${day.totals.completed} completed today`} color="success" variant="outlined" />
        </Stack>
        <TaskGroup title="Overdue" tasks={day.overdue} color="error" onToggle={toggle} />
        <TaskGroup title="Today's plan" tasks={day.today} color="primary" onToggle={toggle} />
        <TaskGroup title="Completed today" tasks={day.completed} color="success" onToggle={toggle} />
      </> : null}
    </Stack>
  </Box>;
}
