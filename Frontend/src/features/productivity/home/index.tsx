import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControl,
  Grid, InputLabel, MenuItem, Select, Stack, Switch, TextField, Typography,
} from "@mui/material";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import RepeatOutlinedIcon from "@mui/icons-material/RepeatOutlined";
import SelfImprovementOutlinedIcon from "@mui/icons-material/SelfImprovementOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import HourglassBottomOutlinedIcon from "@mui/icons-material/HourglassBottomOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { productivityApi, productivityErrorMessage } from "../../../services/productivityApi";
import type { ProductivitySettings, ProductivitySummary } from "../../../services/productivityApi";

type EditableSettings = Omit<ProductivitySettings, "timeZone" | "updatedAt">;
type Feedback = { severity: "success" | "error"; message: string };

const defaultSettings: EditableSettings = {
  weekStartsOn: "monday", defaultCalendarView: "week", defaultFocusMinutes: 25,
  shortBreakMinutes: 5, longBreakMinutes: 15, longBreakAfterSessions: 4,
  remindersEnabled: true, focusSoundEnabled: false,
};

const quickLinks = [
  { title: "My Day", description: "See overdue tasks, today's plan and completed work.", path: "/productivity/my-day", icon: <TodayOutlinedIcon fontSize="large" /> },
  { title: "Tasks", description: "Create, prioritize and organize the work you need to do.", path: "/productivity/tasks", icon: <ChecklistOutlinedIcon fontSize="large" /> },
  { title: "Projects", description: "Group related tasks and track progress toward outcomes.", path: "/productivity/projects", icon: <FolderOpenOutlinedIcon fontSize="large" /> },
  { title: "Calendar", description: "Schedule appointments and see task dates and deadlines.", path: "/productivity/calendar", icon: <CalendarMonthOutlinedIcon fontSize="large" /> },
  { title: "Eisenhower Matrix", description: "Choose what to do, schedule, delegate or reconsider.", path: "/productivity/eisenhower", icon: <GridViewOutlinedIcon fontSize="large" /> },
  { title: "Habits", description: "Track daily routines, streaks and consistency.", path: "/productivity/habits", icon: <RepeatOutlinedIcon fontSize="large" /> },
  { title: "Focus Timer", description: "Run Pomodoro sessions and review focused time.", path: "/productivity/focus", icon: <SelfImprovementOutlinedIcon fontSize="large" /> },
  { title: "Personal Goals", description: "Set meaningful goals, track milestones and review progress.", path: "/productivity/goals", icon: <FlagOutlinedIcon fontSize="large" /> },
  { title: "Notes", description: "Capture ideas and keep useful information organized.", path: "/productivity/notes", icon: <NoteAltOutlinedIcon fontSize="large" /> },
  { title: "Countdowns", description: "Keep birthdays, holidays and important dates visible.", path: "/productivity/countdowns", icon: <HourglassBottomOutlinedIcon fontSize="large" /> },
  { title: "Daily & Weekly Reviews", description: "Reflect on what went well and prepare upcoming priorities.", path: "/productivity/reviews", icon: <RateReviewOutlinedIcon fontSize="large" /> },
  { title: "Productivity Insights", description: "Review real task, habit, focus, project and goal activity.", path: "/productivity/insights", icon: <InsightsOutlinedIcon fontSize="large" /> },
];

export default function ProductivityHome() {
  const [settings, setSettings] = useState<EditableSettings>(defaultSettings);
  const [summary, setSummary] = useState<ProductivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([productivityApi.getSettings(), productivityApi.getSummary()])
      .then(([saved, stats]) => {
        if (!active) return;
        setSettings({
          weekStartsOn: saved.weekStartsOn, defaultCalendarView: saved.defaultCalendarView,
          defaultFocusMinutes: saved.defaultFocusMinutes, shortBreakMinutes: saved.shortBreakMinutes,
          longBreakMinutes: saved.longBreakMinutes, longBreakAfterSessions: saved.longBreakAfterSessions,
          remindersEnabled: saved.remindersEnabled, focusSoundEnabled: saved.focusSoundEnabled,
        });
        setSummary(stats);
      })
      .catch((error: unknown) => { if (active) setLoadError(productivityErrorMessage(error, "Could not load productivity data.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saveSettings = async () => {
    setSaving(true); setFeedback(null);
    try {
      const saved = await productivityApi.updateSettings(settings);
      setSettings({
        weekStartsOn: saved.weekStartsOn, defaultCalendarView: saved.defaultCalendarView,
        defaultFocusMinutes: saved.defaultFocusMinutes, shortBreakMinutes: saved.shortBreakMinutes,
        longBreakMinutes: saved.longBreakMinutes, longBreakAfterSessions: saved.longBreakAfterSessions,
        remindersEnabled: saved.remindersEnabled, focusSoundEnabled: saved.focusSoundEnabled,
      });
      setFeedback({ severity: "success", message: "Productivity preferences saved." });
    } catch (error) {
      setFeedback({ severity: "error", message: productivityErrorMessage(error, "Could not save productivity preferences.") });
    } finally { setSaving(false); }
  };

  const updateNumber = (field: "defaultFocusMinutes" | "shortBreakMinutes" | "longBreakMinutes" | "longBreakAfterSessions", value: string) => {
    const number = Number(value);
    setSettings((current) => ({ ...current, [field]: Number.isFinite(number) ? number : 0 }));
  };

  return <Box m={{ xs: 1.5, sm: 2.5, md: 3 }}>
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" fontWeight={700} sx={{ mb: 0.75 }}>Personal Productivity</Typography>
        <Typography color="text.secondary">Plan your days, organize projects and build consistent routines in one workspace.</Typography>
      </Box>
      <Alert severity="warning">Your current FinTrack installation does not have user accounts or per-user ownership. Productivity records and preferences are shared within this existing single-workspace application.</Alert>
      {loadError && <Alert severity="error">{loadError} Confirm that both productivity migrations have been applied and refresh the page.</Alert>}

      <Box>
        <Typography variant="h3" fontWeight={650} sx={{ mb: 1.5 }}>Your productivity at a glance</Typography>
        {loading ? <CircularProgress size={24} /> : summary && <Grid container spacing={1.5}>
          {[
            { label: "Open tasks", value: summary.openTasks },
            { label: "Overdue", value: summary.overdueTasks },
            { label: "Due or planned today", value: summary.dueTodayTasks },
            { label: "Active projects", value: summary.activeProjects },
            { label: "Completed tasks", value: summary.completedTasks },
          ].map((item) => <Grid item xs={6} sm={4} md={2.4} key={item.label}>
            <Card variant="outlined" sx={{ height: "100%", borderRadius: 2.5 }}><CardContent><Typography color="text.secondary" variant="body2">{item.label}</Typography><Typography variant="h3" fontWeight={750} sx={{ mt: 0.5 }}>{item.value}</Typography></CardContent></Card>
          </Grid>)}
        </Grid>}
      </Box>

      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}><Typography variant="h3" fontWeight={650}>Get things done</Typography><Chip size="small" color="success" variant="outlined" label="Tasks and projects ready" /></Stack>
        <Grid container spacing={2}>
          {quickLinks.map((item) => <Grid item xs={12} md={4} key={item.path}>
            <Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}><CardContent><Stack spacing={1.25}><Box color="primary.main">{item.icon}</Box><Typography variant="h5" fontWeight={650}>{item.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ minHeight: 42 }}>{item.description}</Typography><Button component={RouterLink} to={item.path} variant="outlined" sx={{ alignSelf: "flex-start" }}>Open {item.title}</Button></Stack></CardContent></Card>
          </Grid>)}
        </Grid>
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Stack spacing={2.5}>
        <Box><Typography variant="h3" fontWeight={650}>Productivity preferences</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>These defaults will be used by the calendar and focus features as they are introduced.</Typography></Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}><FormControl fullWidth size="small"><InputLabel>Week starts on</InputLabel><Select label="Week starts on" value={settings.weekStartsOn} onChange={(event) => setSettings((current) => ({ ...current, weekStartsOn: event.target.value as EditableSettings["weekStartsOn"] }))}><MenuItem value="monday">Monday</MenuItem><MenuItem value="sunday">Sunday</MenuItem></Select></FormControl></Grid>
          <Grid item xs={12} sm={6}><FormControl fullWidth size="small"><InputLabel>Default calendar view</InputLabel><Select label="Default calendar view" value={settings.defaultCalendarView} onChange={(event) => setSettings((current) => ({ ...current, defaultCalendarView: event.target.value as EditableSettings["defaultCalendarView"] }))}><MenuItem value="day">Day</MenuItem><MenuItem value="week">Week</MenuItem><MenuItem value="month">Month</MenuItem></Select></FormControl></Grid>
          <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="number" label="Focus session (minutes)" value={settings.defaultFocusMinutes} onChange={(event) => updateNumber("defaultFocusMinutes", event.target.value)} inputProps={{ min: 5, max: 180 }} /></Grid>
          <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="number" label="Short break (minutes)" value={settings.shortBreakMinutes} onChange={(event) => updateNumber("shortBreakMinutes", event.target.value)} inputProps={{ min: 1, max: 60 }} /></Grid>
          <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="number" label="Long break (minutes)" value={settings.longBreakMinutes} onChange={(event) => updateNumber("longBreakMinutes", event.target.value)} inputProps={{ min: 1, max: 90 }} /></Grid>
          <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="number" label="Long break after sessions" value={settings.longBreakAfterSessions} onChange={(event) => updateNumber("longBreakAfterSessions", event.target.value)} inputProps={{ min: 2, max: 8 }} /></Grid>
        </Grid>
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography>Enable productivity reminders</Typography><Switch checked={settings.remindersEnabled} onChange={(event) => setSettings((current) => ({ ...current, remindersEnabled: event.target.checked }))} /></Stack>
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography>Play sound when a focus session ends</Typography><Switch checked={settings.focusSoundEnabled} onChange={(event) => setSettings((current) => ({ ...current, focusSoundEnabled: event.target.checked }))} /></Stack>
        {feedback && <Alert severity={feedback.severity}>{feedback.message}</Alert>}
        <Button variant="contained" onClick={() => void saveSettings()} disabled={saving || loading}>{saving ? "Saving…" : "Save preferences"}</Button>
      </Stack></CardContent></Card>
      <Typography color="text.secondary" variant="caption">Workspace time zone: Africa/Kigali. Summary is calculated from saved tasks and projects, not sample data.</Typography>
    </Stack>
  </Box>;
}
