import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import {
  productivityApi,
  productivityErrorMessage,
} from "../../../services/productivityApi";
import type { ProductivityInsights } from "../../../services/productivityApi";

const todayInKigali = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(
    new Date(),
  );
const shiftDate = (value: string, amount: number) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const dateLabel = (value: string) =>
  new Date(`${value}T00:00:00.000Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const numberLabel = (value: number | null, suffix = "") =>
  value == null ? "—" : `${value.toLocaleString()}${suffix}`;

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  progress?: number | null;
};
function MetricCard({ label, value, detail, progress }: MetricCardProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 2.5 }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography color="text.secondary" variant="body2">
            {label}
          </Typography>
          <Typography variant="h3" fontWeight={750}>
            {value}
          </Typography>
          <Typography
            color="text.secondary"
            variant="caption"
            sx={{ minHeight: 34 }}
          >
            {detail}
          </Typography>
          {progress !== undefined && progress !== null && (
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, progress))}
              sx={{ height: 7, borderRadius: 4 }}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ProductivityInsightsPage() {
  const today = todayInKigali();
  const [endDate, setEndDate] = useState(today);
  const [startDate, setStartDate] = useState(shiftDate(today, -29));
  const [insights, setInsights] = useState<ProductivityInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    productivityApi
      .getInsights(startDate, endDate)
      .then((data) => {
        if (active) setInsights(data);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setInsights(null);
          setError(
            productivityErrorMessage(
              requestError,
              "Could not load productivity insights.",
            ),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [startDate, endDate, requestKey]);

  const maxFocusMinutes = useMemo(
    () =>
      Math.max(1, ...(insights?.trend.map((day) => day.focusMinutes) || [1])),
    [insights],
  );
  const last14Days = useMemo(
    () => insights?.trend.slice(-14) || [],
    [insights],
  );

  const loadPeriod = () => {
    setRequestKey((value) => value + 1);
  };
  const setPreset = (days: number) => {
    setEndDate(todayInKigali());
    setStartDate(shiftDate(todayInKigali(), -(days - 1)));
  };

  return (
    <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <InsightsOutlinedIcon color="primary" sx={{ fontSize: 34 }} />
            <Typography variant="h1" fontWeight={700}>
              Productivity Insights
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            Review measurable activity from your saved tasks, habits, focus
            sessions, projects and goals.
          </Typography>
        </Box>
        <Alert severity="info">
          These are activity measures, not a judgment or prediction of personal
          performance. Habit completion is calculated from saved habit logs
          only; days without a log are not counted as missed.
        </Alert>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h3" fontWeight={650}>
                Reporting period
              </Typography>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth
                    type="date"
                    size="small"
                    label="Start date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth
                    type="date"
                    size="small"
                    label="End date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={loadPeriod}
                    disabled={loading}
                  >
                    Apply
                  </Button>
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPreset(7)}
                >
                  Last 7 days
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPreset(30)}
                >
                  Last 30 days
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPreset(90)}
                >
                  Last 90 days
                </Button>
                <Chip size="small" label="Maximum range: 92 days" />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        {error && <Alert severity="error">{error}</Alert>}
        {loading ? (
          <CircularProgress size={28} />
        ) : (
          insights && (
            <>
              <Box>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1.5 }}
                >
                  <Typography variant="h3" fontWeight={650}>
                    Task activity
                  </Typography>
                  <Chip
                    size="small"
                    label={`${dateLabel(insights.startDate)} – ${dateLabel(insights.endDate)}`}
                  />
                </Stack>
                <Grid container spacing={1.5}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Tasks due"
                      value={numberLabel(insights.metrics.dueTasks)}
                      detail="Non-cancelled tasks with a due date in this period."
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Due-task completion"
                      value={numberLabel(
                        insights.metrics.dueTaskCompletionRate,
                        "%",
                      )}
                      detail={`${insights.metrics.completedDueTasks} completed from ${insights.metrics.dueTasks} due tasks.`}
                      progress={insights.metrics.dueTaskCompletionRate}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Tasks completed"
                      value={numberLabel(
                        insights.metrics.tasksCompletedInPeriod,
                      )}
                      detail="Tasks marked completed during this period."
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Currently overdue"
                      value={numberLabel(
                        insights.metrics.currentlyOverdueDueTasks,
                      )}
                      detail="Still-open tasks from this selected due-date period that are past due today."
                    />
                  </Grid>
                </Grid>
              </Box>
              <Box>
                <Typography variant="h3" fontWeight={650} sx={{ mb: 1.5 }}>
                  Habits and focus
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Habit entries"
                      value={numberLabel(insights.metrics.loggedHabitEntries)}
                      detail={`${insights.metrics.completedHabitEntries} completed entries across ${insights.metrics.trackedHabits} habits.`}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Logged habit completion"
                      value={numberLabel(
                        insights.metrics.habitLoggedEntryCompletionRate,
                        "%",
                      )}
                      detail="Completed logs divided by all saved logs; unlogged days excluded."
                      progress={insights.metrics.habitLoggedEntryCompletionRate}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Completed focus sessions"
                      value={numberLabel(
                        insights.metrics.completedFocusSessions,
                      )}
                      detail={`${insights.metrics.averageFocusMinutes} minutes average per completed focus session.`}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Focus time"
                      value={`${numberLabel(insights.metrics.focusMinutes)} min`}
                      detail="Actual duration from completed focus sessions."
                    />
                  </Grid>
                </Grid>
              </Box>
              <Box>
                <Typography variant="h3" fontWeight={650} sx={{ mb: 1.5 }}>
                  Projects and goals
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Active projects"
                      value={numberLabel(insights.metrics.activeProjects)}
                      detail="Projects currently active."
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Completed projects"
                      value={numberLabel(insights.metrics.completedProjects)}
                      detail="Projects currently marked completed."
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Active goals"
                      value={numberLabel(insights.metrics.activeGoals)}
                      detail={`${insights.metrics.goalsWithTargetInPeriod} active goals have a target date in this period.`}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Average goal progress"
                      value={numberLabel(
                        insights.metrics.averageActiveGoalProgress,
                        "%",
                      )}
                      detail="Current average across active goals; not a historical snapshot."
                      progress={insights.metrics.averageActiveGoalProgress}
                    />
                  </Grid>
                </Grid>
              </Box>
              <Box>
                <Typography variant="h3" fontWeight={650} sx={{ mb: 1.5 }}>
                  Daily activity — last 14 days of selected period
                </Typography>
                {last14Days.length === 0 ? (
                  <Typography color="text.secondary">
                    No trend data for this period.
                  </Typography>
                ) : (
                  <Card variant="outlined" sx={{ borderRadius: 3 }}>
                    <CardContent>
                      <Stack spacing={1.75}>
                        {last14Days.map((day) => (
                          <Box key={day.date}>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mb: 0.5 }}
                            >
                              <Typography variant="body2" fontWeight={600}>
                                {dateLabel(day.date)}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {day.focusMinutes} focus min ·{" "}
                                {day.tasksCompleted} tasks completed ·{" "}
                                {day.habitsCompleted}/{day.habitEntries} habit
                                logs
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(
                                100,
                                (day.focusMinutes / maxFocusMinutes) * 100,
                              )}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </Box>
                        ))}
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 1.5 }}
                      >
                        Bars represent focus minutes relative to the busiest day
                        shown. Task and habit counts are shown alongside them.
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Box>
              <Box>
                <Typography variant="h3" fontWeight={650} sx={{ mb: 1.5 }}>
                  Review activity
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}>
                    <MetricCard
                      label="Daily reviews saved"
                      value={numberLabel(insights.metrics.dailyReviewsSaved)}
                      detail="Saved daily reflection records in this period."
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <MetricCard
                      label="Weekly reviews"
                      value={numberLabel(
                        insights.metrics.weeklyReviewsOverlappingPeriod,
                      )}
                      detail="Saved weekly review periods overlapping the selected dates."
                    />
                  </Grid>
                </Grid>
              </Box>
              <Accordion variant="outlined">
                <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
                  <Typography fontWeight={650}>
                    How these metrics are calculated
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.25}>
                    {Object.entries(insights.definitions).map(
                      ([key, definition]) => (
                        <Box key={key}>
                          <Typography variant="body2" fontWeight={650}>
                            {key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (value) => value.toUpperCase())}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {definition}
                          </Typography>
                        </Box>
                      ),
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
              <Typography variant="caption" color="text.secondary">
                Generated {new Date(insights.generatedAt).toLocaleString()}.
                Insights are calculated from the saved productivity records in
                this workspace.
              </Typography>
            </>
          )
        )}
      </Stack>
    </Box>
  );
}
